try { require('dotenv').config(); } catch {}

const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'docs')));

app.get('/api/tasks', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('focus_data')
      .select('data')
      .eq('id', 'tasks')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data?.data ?? []);
  } catch {
    res.json([]);
  }
});

app.put('/api/tasks', async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'body must be an array' });
  try {
    const { error } = await supabase
      .from('focus_data')
      .upsert({ id: 'tasks', data: req.body });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Chat endpoint — streams Claude CLI responses via SSE
app.post('/api/claude', (req, res) => {
  const { message, tasks } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const taskList = (tasks || []).map(t =>
    `• "${t.name}" [${t.priority}]${t.deadline ? `, due ${new Date(t.deadline).toLocaleDateString()}` : ''}${t.totalMs ? `, ${Math.round(t.totalMs / 60000)}min logged` : ''}`
  ).join('\n');

  const systemPrompt = `You are a concise deep-work productivity assistant inside FocusFinder, a task-bundling tool.\nUser's current task bundles:\n${taskList || '(no tasks yet)'}\nBe direct and actionable. Under 120 words unless asked for more.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const proc = spawn('claude', ['-p', '--output-format', 'text', '--append-system-prompt', systemPrompt, message]);

  proc.stdout.on('data', chunk => {
    res.write(`data: ${JSON.stringify({ text: chunk.toString() })}\n\n`);
  });

  proc.on('close', () => {
    res.write('data: [DONE]\n\n');
    res.end();
  });

  proc.on('error', err => {
    res.write(`data: ${JSON.stringify({ error: 'Claude not available: ' + err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

// Safety blocklist applied after Claude generates a command
const FORBIDDEN_PATTERN = /\b(rm\s|rmdir|sudo|chmod|chown|mkfs|fdisk|dd\s|deltree)\b|curl[^|]*\||\bwget[^|]*\||>\s*\/etc|>\s*\/usr|>\s*\/bin/i;

function makeActionPrompt(cmd) {
  const safe = cmd.replace(/[\\\"]/g, '\\$&');
  return `Convert this macOS request into a safe shell command. Respond with valid JSON only — no markdown, no explanation, no code fences.

Request: "${safe}"

ALLOWED operations:
- Open app: open -a "AppName"
- Open URL: open "https://example.com"
- Open folder in Finder: open ~/Desktop
- Set volume 0-100: osascript -e 'set volume output volume 50'
- Mute: osascript -e 'set volume with output muted'
- Unmute: osascript -e 'set volume without output muted'
- Screenshot: screencapture ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png
- Text to speech: say "message"
- Desktop notification: osascript -e 'display notification "body" with title "Title"'
- Copy text to clipboard: printf '%s' 'text' | pbcopy
- Create folder: mkdir -p ~/Desktop/FolderName
- Create empty file: touch ~/Desktop/filename.txt

FORBIDDEN — never generate: rm, rmdir, sudo, chmod, chown, curl piped to shell, wget piped to shell, anything that deletes or overwrites existing files.

Safe request response format (JSON only):
{"command":"the shell command","description":"plain English description","safe":true}

Unsafe/unmappable response format (JSON only):
{"command":null,"description":"brief reason why not","safe":false}`;
}

// Action endpoint — only works locally where Claude CLI is available
app.post('/api/action', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });

  let out = '';
  const proc = spawn('claude', ['-p', '--output-format', 'json', makeActionPrompt(command)]);

  proc.stdout.on('data', d => { out += d.toString(); });
  proc.stderr.on('data', () => {});

  proc.on('close', () => {
    let parsed;
    try {
      const outer = JSON.parse(out.trim());
      parsed = JSON.parse(outer.result);
    } catch {
      return res.status(500).json({ error: 'Failed to parse response', raw: out.slice(0, 300) });
    }

    if (!parsed.safe || !parsed.command) {
      return res.json({ ok: false, description: parsed.description || 'Blocked', command: null });
    }

    if (FORBIDDEN_PATTERN.test(parsed.command)) {
      return res.json({ ok: false, description: 'Blocked by safety filter', command: parsed.command });
    }

    exec(parsed.command, { timeout: 12000, shell: '/bin/zsh' }, (execErr, stdout, stderr) => {
      res.json({
        ok: !execErr,
        command: parsed.command,
        description: parsed.description,
        output: (stdout || stderr || (execErr ? execErr.message : '')).trim()
      });
    });
  });

  proc.on('error', err => {
    res.status(500).json({ error: 'Claude CLI not available: ' + err.message });
  });
});

// One-time migration: seeds Supabase from local tasks.json if cloud is empty
async function maybeMigrateLocal() {
  const localFile = path.join(__dirname, 'data', 'tasks.json');
  if (!fs.existsSync(localFile)) return;
  try {
    const { data } = await supabase.from('focus_data').select('data').eq('id', 'tasks').single();
    if (data?.data?.length > 0) return;
    const local = JSON.parse(fs.readFileSync(localFile, 'utf8'));
    if (Array.isArray(local) && local.length > 0) {
      await supabase.from('focus_data').upsert({ id: 'tasks', data: local });
      console.log(`Migrated ${local.length} tasks from local file to Supabase`);
    }
  } catch {}
}

app.listen(PORT, async () => {
  console.log(`Focus running at http://localhost:${PORT}`);
  await maybeMigrateLocal();
});

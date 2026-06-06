const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const PORT = 3000;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/tasks', (_req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(Array.isArray(data) ? data : []);
  } catch {
    res.json([]);
  }
});

app.put('/api/tasks', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'body must be an array' });
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/claude', (req, res) => {
  const { message, tasks } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const taskList = (tasks || []).map(t =>
    `• "${t.name}" [${t.priority}]${t.deadline ? `, due ${new Date(t.deadline).toLocaleDateString()}` : ''}${t.totalMs ? `, ${Math.round(t.totalMs / 60000)}min logged` : ''}`
  ).join('\n');

  const body = JSON.stringify({
    model: OLLAMA_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a concise deep-work productivity assistant inside FocusFinder, a task-bundling tool.\nUser's current task bundles:\n${taskList || '(no tasks yet)'}\nBe direct and actionable. Under 120 words unless asked for more.`
      },
      { role: 'user', content: message }
    ],
    stream: true
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const ollamaReq = http.request({
    hostname: 'localhost',
    port: 11434,
    path: '/api/chat',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, ollamaRes => {
    let buf = '';
    ollamaRes.on('data', chunk => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) res.write(`data: ${JSON.stringify({ text: data.message.content })}\n\n`);
          if (data.done) { res.write('data: [DONE]\n\n'); res.end(); }
        } catch {}
      }
    });
    ollamaRes.on('end', () => { res.write('data: [DONE]\n\n'); res.end(); });
  });

  ollamaReq.on('error', () => {
    res.write(`data: ${JSON.stringify({ error: 'Ollama not running — open a terminal and run: ollama serve' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  ollamaReq.write(body);
  ollamaReq.end();
});

app.listen(PORT, () => console.log(`Focus running at http://localhost:${PORT}`));

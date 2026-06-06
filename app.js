const PRIO={high:{label:"Urgent",c:"#c0392b",tc:"#fff"},medium:{label:"Soon",c:"#d4a017",tc:"#1a0e00"},low:{label:"Whenever",c:"#2e7d32",tc:"#fff"}};
const RANK={high:0,medium:1,low:2};
let uid=0;const id=()=>"t"+Date.now().toString(36)+(uid++).toString(36)+Math.random().toString(36).slice(2,5);const now=()=>Date.now();
let tasks=[],mode="manual",firstPaint=true;

function seed(){const H=36e5;tasks=[
  {id:id(),name:"Ship the onboarding redesign",priority:"high",deadline:now()+5*H,createdAt:now()-26*H,totalMs:64*60000,activeStart:null,links:[
    {id:"l1",url:"https://www.figma.com/file/onboarding",label:"Figma — flows",clicks:4},
    {id:"l2",url:"https://github.com/team/app/pull/812",label:"PR #812",clicks:2},
    {id:"l3",url:"https://www.notion.so/spec",label:"Spec doc",clicks:1}]},
  {id:id(),name:"Research grant draft",priority:"medium",deadline:now()+3*24*H,createdAt:now()-50*H,totalMs:0,activeStart:null,links:[
    {id:"l4",url:"https://scholar.google.com",label:"Sources",clicks:6},
    {id:"l5",url:"https://docs.google.com/document/grant",label:"Working draft",clicks:3}]},
  {id:id(),name:"Read the saved long-reads",priority:"low",deadline:null,createdAt:now()-8*H,totalMs:22*60000,activeStart:null,links:[
    {id:"l6",url:"https://www.newyorker.com/long-read",label:"",clicks:0},
    {id:"l7",url:"https://aeon.co/essays/attention",label:"",clicks:1},
    {id:"l8",url:"https://stratechery.com/2024/post",label:"",clicks:0}]}
];}

const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch{return u}};
const pad2=n=>String(n).padStart(2,"0");
const fmt=ts=>new Date(ts).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
function rel(ts){if(ts==null)return null;const d=ts-now(),past=d<0,a=Math.abs(d),h=a/36e5,day=h/24;
  let s=day>=1?Math.round(day)+"d":h>=1?Math.round(h)+"h":Math.max(1,Math.round(a/6e4))+"m";
  return{past,soon:!past&&h<24,text:past?s+" overdue":"due in "+s}}
function esc(s){return(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function fmtClock(ms){const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60),ss=s%60;
  if(m>=60){const h=Math.floor(m/60);return h+":"+pad2(m%60)+":"+pad2(ss)}return pad2(m)+":"+pad2(ss)}
function fmtDur(ms){const m=Math.round(ms/60000);if(m<1)return"under a minute";if(m<60)return m+" min";const h=Math.floor(m/60);return h+"h "+pad2(m%60)+"m"}
function elapsed(t){return(t.totalMs||0)+(t.activeStart?now()-t.activeStart:0)}
function totalFocus(){return tasks.reduce((n,t)=>n+elapsed(t),0)}

function setNum(el,str){const chars=[...String(str)];
  if(el._chars&&el._chars.length===chars.length){
    chars.forEach((c,i)=>{const slot=el.children[i],cur=slot.firstChild;
      if(cur.textContent!==c){cur.textContent=c;slot.classList.remove("ch");void slot.offsetWidth;slot.classList.add("ch")}});
  }else{el.innerHTML="";chars.forEach(c=>{const s=document.createElement("span");s.className="slot";
    const cu=document.createElement("span");cu.className="cur";cu.textContent=c;s.appendChild(cu);el.appendChild(s)})}
  el._chars=chars}

const linkRows=document.getElementById("linkRows");
function addRow(){const i=linkRows.children.length+1;const row=document.createElement("div");row.className="linkrow";
  row.innerHTML=`<span class="idx">${pad2(i)}</span><input class="in url" placeholder="https://…" /><input class="in lab" placeholder="label" /><button class="x">✕</button>`;
  const u=row.querySelector(".url");u.addEventListener("input",refresh);
  row.querySelector(".x").addEventListener("click",()=>{row.remove();renumber();refresh()});
  u.addEventListener("paste",e=>{const t=(e.clipboardData||window.clipboardData).getData("text");
    const urls=t.split(/[\s,]+/).filter(x=>/^https?:\/\//i.test(x));
    if(urls.length>1){e.preventDefault();u.value=urls[0];urls.slice(1).forEach(v=>{addRow();linkRows.lastChild.querySelector(".url").value=v});renumber();refresh()}});
  linkRows.appendChild(row)}
function renumber(){[...linkRows.children].forEach((r,i)=>r.querySelector(".idx").textContent=pad2(i+1))}
addRow();
document.getElementById("addLink").addEventListener("click",addRow);

let prio="high";
document.querySelectorAll("#prio button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("#prio button").forEach(x=>x.dataset.on="false");b.dataset.on="true";prio=b.dataset.v}));

const taskName=document.getElementById("taskName"),btn=document.getElementById("bundleBtn");
function refresh(){const n=taskName.value.trim().length>0,l=[...linkRows.querySelectorAll(".url")].some(i=>i.value.trim());
  btn.disabled=!(n&&l);document.getElementById("formno").textContent="REF "+(n?taskName.value.trim().slice(0,14).toUpperCase():"—")}
taskName.addEventListener("input",refresh);

btn.addEventListener("click",()=>{
  const rows=[...linkRows.children].map(r=>{const ins=r.querySelectorAll(".in");return{url:ins[0].value.trim(),label:ins[1].value.trim()}}).filter(x=>x.url);
  const dl=document.getElementById("deadline").value;
  tasks.unshift({id:id(),name:taskName.value.trim(),priority:prio,deadline:dl?new Date(dl).getTime():null,createdAt:now(),totalMs:0,activeStart:null,
    links:rows.map((x,i)=>({id:"n"+id()+i,url:x.url,label:x.label,clicks:0}))});
  taskName.value="";linkRows.innerHTML="";addRow();document.getElementById("deadline").value="";refresh();render();save();
  document.getElementById("cards").scrollIntoView({behavior:"smooth",block:"start"})});

function startSession(t){if(!t.activeStart)t.activeStart=now()}
function endSession(t){if(t.activeStart){t.totalMs=(t.totalMs||0)+(now()-t.activeStart);t.activeStart=null}}

const cardsEl=document.getElementById("cards");
function ordered(){return mode==="priority"?[...tasks].sort((a,b)=>RANK[a.priority]-RANK[b.priority]||(a.deadline??Infinity)-(b.deadline??Infinity)):tasks}
function render(){renderCards();renderStats();renderTimeline();firstPaint=false}

function sessionRow(t){
  if(t.activeStart)return `<div class="sess live">
    <span class="pulse"></span><span class="clk" data-clock="${t.id}">${fmtClock(now()-t.activeStart)}</span>
    <span class="slabel">in session · ${fmtDur(t.totalMs||0)} banked</span>
    <button class="enddone" data-end="${t.id}">✓ Done — log time</button></div>`;
  return `<div class="sess">
    <span class="logged">⏲ ${(t.totalMs||0)>0?fmtDur(t.totalMs)+" logged":"no time logged yet"}</span>
    <button class="begin" data-begin="${t.id}">▷ Begin focus</button></div>`;
}

function renderCards(){const list=ordered();
  cardsEl.innerHTML=list.length?"":`<div class="empty">No dockets on file — start a bundle above.</div>`;
  list.forEach((t,idx)=>{const p=PRIO[t.priority],r=rel(t.deadline);
    const dueColor=r?(r.past||r.soon?"hsl(var(--clay))":"hsl(var(--ink))"):"hsl(var(--ink-faint))";
    const el=document.createElement("div");el.className="docket";
    if(firstPaint){el.classList.add("rv");el.style.animationDelay=(idx*70)+"ms"}
    el.innerHTML=`
      <span class="tab">Nº ${pad2(idx+1)}</span>
      <div class="file ruled" style="background-position:0 26px">
        <span class="stamp" data-cyc="${t.id}" style="background:${p.c};color:${p.tc}">${p.label}</span>
        <h3>${esc(t.name)}</h3>
        <span class="due" style="color:${dueColor}">⏱ ${r?`${fmt(t.deadline)} · ${r.text}`:"no deadline set"}</span>
        <ul class="links">${t.links.map((l,i)=>`<li>
            <span class="ln">${pad2(i+1)}</span>
            <button class="lnk" data-t="${t.id}" data-l="${l.id}"><span class="nm">${esc(l.label||host(l.url))}</span><span class="hst">${esc(host(l.url))}</span></button>
            <span class="leader"></span><span class="cnt" data-cnt="${t.id}-${l.id}">↗ ${pad2(l.clicks)}</span></li>`).join("")}</ul>
        ${sessionRow(t)}
        <div class="acts">
          <button class="openall" data-open="${t.id}">⇲ Open all ${pad2(t.links.length)}</button>
          <button class="del" data-del="${t.id}">discard</button>
          ${mode==="manual"?`<div class="move"><button data-up="${t.id}" ${idx===0?"disabled":""}>↑</button><button data-down="${t.id}" ${idx===list.length-1?"disabled":""}>↓</button></div>`:""}
        </div>
        <div class="pinned">Filed ${fmt(t.createdAt)}</div>
      </div>`;
    cardsEl.appendChild(el)});

  cardsEl.querySelectorAll(".lnk").forEach(b=>b.addEventListener("click",()=>{
    const t=tasks.find(x=>x.id===b.dataset.t),l=t.links.find(x=>x.id===b.dataset.l);
    l.clicks++;startSession(t);window.open(l.url,"_blank","noopener");render();save()}));
  cardsEl.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>{
    const t=tasks.find(x=>x.id===b.dataset.open);t.links.forEach(l=>window.open(l.url,"_blank","noopener"));startSession(t);render();save()}));
  cardsEl.querySelectorAll("[data-begin]").forEach(b=>b.addEventListener("click",()=>{startSession(tasks.find(x=>x.id===b.dataset.begin));render();save()}));
  cardsEl.querySelectorAll("[data-end]").forEach(b=>b.addEventListener("click",()=>{endSession(tasks.find(x=>x.id===b.dataset.end));render();save()}));
  cardsEl.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{tasks=tasks.filter(x=>x.id!==b.dataset.del);render();save()}));
  cardsEl.querySelectorAll("[data-cyc]").forEach(b=>b.addEventListener("click",()=>{
    const t=tasks.find(x=>x.id===b.dataset.cyc),o=["high","medium","low"];t.priority=o[(o.indexOf(t.priority)+1)%3];render();save()}));
  cardsEl.querySelectorAll("[data-up]").forEach(b=>b.addEventListener("click",()=>mv(b.dataset.up,-1)));
  cardsEl.querySelectorAll("[data-down]").forEach(b=>b.addEventListener("click",()=>mv(b.dataset.down,1)));}
function mv(tid,d){const i=tasks.findIndex(x=>x.id===tid),j=i+d;if(j<0||j>=tasks.length)return;[tasks[i],tasks[j]]=[tasks[j],tasks[i]];render();save()}

function renderStats(){
  setNum(document.getElementById("sBundles"),tasks.length);
  setNum(document.getElementById("sTabs"),tasks.reduce((n,t)=>n+t.links.length,0));
  setNum(document.getElementById("sReopen"),tasks.reduce((n,t)=>n+t.links.reduce((m,l)=>m+l.clicks,0),0));
  setNum(document.getElementById("sFocus"),Math.round(totalFocus()/60000));
  const ft=document.getElementById("focusTotal");if(ft)ft.textContent=totalFocus()>0?fmtDur(totalFocus())+" logged":"no time logged";}

/* ── ORBITAL TIMELINE ── */
const _ORB_R={high:80,medium:135,low:190};
const _ORB_SPEED={high:1.8,medium:1.0,low:0.5};
let _orbTimer=null,_orbAngle=0,_orbExpandedId=null;

function renderTimeline(){
  const track=document.getElementById("tlTrack");
  const dated=tasks.filter(t=>t.deadline!=null).sort((a,b)=>a.deadline-b.deadline);
  const without=tasks.length-dated.length;
  document.getElementById("tlHint").textContent=dated.length
    ?(without?`${dated.length} dated · ${without} undated`:`${dated.length} on the line`)
    :"no deadlines yet";
  if(_orbTimer){clearInterval(_orbTimer);_orbTimer=null}
  if(_orbExpandedId&&!dated.find(t=>t.id===_orbExpandedId))_orbExpandedId=null;

  if(!dated.length){
    track.innerHTML=`<div class="orbital-stage"><div class="orbital-empty">Give a bundle a deadline to place it on the line.</div></div>`;
    return;
  }

  const groups={
    high:dated.filter(t=>t.priority==="high"),
    medium:dated.filter(t=>t.priority==="medium"),
    low:dated.filter(t=>t.priority==="low")
  };
  const sel=_orbExpandedId?dated.find(t=>t.id===_orbExpandedId):null;
  const selP=sel?PRIO[sel.priority]:null,selR=sel?rel(sel.deadline):null;

  const nodeHtml=Object.values(groups).flat().map(t=>{
    const p=PRIO[t.priority],r=rel(t.deadline);
    const hot=r&&(r.past||r.soon),isExp=_orbExpandedId===t.id;
    return `<div class="orbital-node" id="on-${t.id}">
      <div class="orbital-dot${hot?" hot":""}${isExp?" exp":""}" style="background:${p.c};border-color:${p.c}" data-oid="${t.id}"></div>
      <div class="orbital-lbl" id="lbl-${t.id}">${esc(t.name.split(" ").slice(0,2).join(" "))}</div>
    </div>`;
  }).join("");

  track.innerHTML=`
    <div class="orbital-stage" id="orbStage">
      <div class="orb-ring" style="width:${_ORB_R.high*2}px;height:${_ORB_R.high*2}px;border-color:rgba(192,57,43,.28)"></div>
      <div class="orb-ring" style="width:${_ORB_R.medium*2}px;height:${_ORB_R.medium*2}px;border-color:rgba(212,160,23,.28)"></div>
      <div class="orb-ring" style="width:${_ORB_R.low*2}px;height:${_ORB_R.low*2}px;border-color:rgba(46,125,50,.22)"></div>
      <div class="orbital-hub"><div class="orbital-hub-ring"></div><div class="orbital-hub-ring2"></div><div class="orbital-hub-core"></div></div>
      <div class="orb-legend">
        <span class="orb-leg" style="--lc:#c0392b">● Urgent · fast</span>
        <span class="orb-leg" style="--lc:#d4a017">● Soon · mid</span>
        <span class="orb-leg" style="--lc:#2e7d32">● Whenever · slow</span>
      </div>
      ${nodeHtml}
    </div>
    ${sel?`<div class="orbital-info">
      <span class="oi-badge" style="background:${selP.c};color:${selP.tc}">${selP.label}</span>
      <div class="oi-name">${esc(sel.name)}</div>
      <div class="oi-dl">${fmt(sel.deadline)} · <span${(selR.past||selR.soon)?' style="color:#c0392b"':''}>${selR.past?"overdue":selR.text}</span></div>
      <button class="oi-close" id="orbClose">✕ close</button>
    </div>`:""}`;

  const stage=document.getElementById("orbStage");

  function posNodes(){
    const cx=stage.offsetWidth/2,cy=stage.offsetHeight/2;
    Object.entries(groups).forEach(([prio,gtasks])=>{
      const R=_ORB_R[prio],speed=_ORB_SPEED[prio],n=Math.max(gtasks.length,1);
      gtasks.forEach((t,i)=>{
        const node=document.getElementById("on-"+t.id);if(!node)return;
        const angle=(_orbAngle*speed+(i/n)*360)*Math.PI/180;
        node.style.left=(cx+R*Math.cos(angle))+"px";
        node.style.top=(cy+R*Math.sin(angle))+"px";
        const lbl=document.getElementById("lbl-"+t.id);
        if(lbl){
          const ox=Math.cos(angle)*26,oy=Math.sin(angle)*26;
          lbl.style.left=`calc(50% + ${ox}px)`;
          lbl.style.top=`calc(50% + ${oy}px)`;
        }
      });
    });
  }

  requestAnimationFrame(posNodes);
  _orbTimer=setInterval(()=>{
    if(!_orbExpandedId)_orbAngle=(_orbAngle+0.25)%360;
    posNodes();
  },50);

  track.querySelectorAll("[data-oid]").forEach(dot=>dot.addEventListener("click",e=>{
    e.stopPropagation();
    _orbExpandedId=_orbExpandedId===dot.dataset.oid?null:dot.dataset.oid;
    renderTimeline();
  }));
  const closeBtn=document.getElementById("orbClose");
  if(closeBtn)closeBtn.addEventListener("click",()=>{_orbExpandedId=null;renderTimeline()});
  stage.addEventListener("click",()=>{if(_orbExpandedId){_orbExpandedId=null;renderTimeline()}});
}

document.querySelectorAll("#modes button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("#modes button").forEach(x=>x.dataset.on="false");b.dataset.on="true";mode=b.dataset.m;renderCards()}));

/* clock tick + auto-escalation: Soon → Urgent when deadline ≤ 24 h */
setInterval(()=>{
  let dirty=false;
  tasks.forEach(t=>{if(t.activeStart){dirty=true;
    const el=cardsEl.querySelector(`[data-clock="${t.id}"]`);if(el)el.textContent=fmtClock(now()-t.activeStart)}});
  if(dirty){const ft=document.getElementById("focusTotal");if(ft)ft.textContent=fmtDur(totalFocus())+" logged";
    setNum(document.getElementById("sFocus"),Math.round(totalFocus()/60000))}
  let escalated=false;
  tasks.forEach(t=>{
    if(t.priority==="medium"&&t.deadline){
      const h=(t.deadline-now())/36e5;
      if(h>0&&h<=24){t.priority="high";escalated=true}
    }
  });
  if(escalated){render();save()}
},1000);

/* eyes + circuit settle */
const pupils=[...document.querySelectorAll(".pupil")];
window.addEventListener("mousemove",e=>pupils.forEach(p=>{const r=p.parentElement.getBoundingClientRect();
  const a=Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2));
  p.style.transform=`translate(${Math.cos(a)*18}px,${Math.sin(a)*18}px)`}));
const board=document.getElementById("board");
if("IntersectionObserver"in window){new IntersectionObserver((es,o)=>es.forEach(en=>{if(en.isIntersecting){board.classList.add("in");o.disconnect()}}),{threshold:.25}).observe(board)}
else board.classList.add("in");

/* backend persistence */
let saveTimer=null;
function setStatus(html){const el=document.getElementById("status");if(el)el.innerHTML=html}
async function persist(){
  setStatus("○ SAVING…");
  try{
    const r=await fetch("/api/tasks",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(tasks)});
    setStatus(r.ok?'<span class="dotok">●</span> SAVED':"⚠ NOT SAVED");
  }catch{setStatus("⚠ NOT SAVED")}
}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,250)}
function migrate(arr){return arr.map(t=>({totalMs:0,activeStart:null,...t,links:(t.links||[]).map(l=>({clicks:0,...l}))}))}
async function load(){
  try{
    const r=await fetch("/api/tasks");const data=await r.json();
    if(Array.isArray(data)&&data.length){tasks=migrate(data);setStatus('<span class="dotok">●</span> SAVED')}
    else{seed();await persist()}
  }catch{seed();setStatus("⚠ OFFLINE")}
}
document.getElementById("resetBtn").addEventListener("click",()=>{firstPaint=true;seed();render();save()});
(async()=>{await load();render()})();

/* custom cursor */
(()=>{const ring=document.getElementById("cur-ring"),dot=document.getElementById("cur-dot");
  let cx=window.innerWidth/2,cy=window.innerHeight/2,rx=cx,ry=cy,dx=cx,dy=cy;
  function tick(){
    rx+=(cx-rx)*.26;ry+=(cy-ry)*.26;
    dx+=(cx-dx)*.55;dy+=(cy-dy)*.55;
    ring.style.transform=`translate(calc(${rx}px - 50%),calc(${ry}px - 50%))`;
    dot.style.transform=`translate(calc(${dx}px - 50%),calc(${dy}px - 50%))`;
    requestAnimationFrame(tick)}
  tick();
  window.addEventListener("mousemove",e=>{cx=e.clientX;cy=e.clientY});
  window.addEventListener("mousedown",()=>document.body.classList.add("cur-press"));
  window.addEventListener("mouseup",()=>document.body.classList.remove("cur-press"));
  document.addEventListener("mouseover",e=>{if(e.target.closest("button,a,input,label,[role=button]"))document.body.classList.add("cur-hover");else document.body.classList.remove("cur-hover")});
})();

/* Claude AI bar */
(()=>{
  const panel=document.getElementById("ai-panel");
  const input=document.getElementById("ai-input");
  const send=document.getElementById("ai-send");
  const resp=document.getElementById("ai-response");
  const clearBtn=document.getElementById("ai-clear");

  clearBtn.addEventListener("click",()=>{resp.textContent="";panel.classList.remove("open")});

  async function ask(){
    const msg=input.value.trim();
    if(!msg||send.disabled)return;
    input.value="";
    panel.classList.add("open");
    resp.innerHTML=`<span class="ai-thinking">thinking…</span>`;
    send.disabled=true;
    try{
      const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg,tasks})});
      if(!res.ok){const err=await res.json().catch(()=>({}));resp.textContent="⚠ "+(err.error||"Error");send.disabled=false;return}
      resp.textContent="";
      const reader=res.body.getReader(),dec=new TextDecoder();let buf="";
      while(true){
        const{done,value}=await reader.read();if(done)break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n");buf=lines.pop();
        for(const line of lines){
          if(!line.startsWith("data: "))continue;
          const d=line.slice(6);if(d==="[DONE]")break;
          try{const{text,error}=JSON.parse(d);if(error){resp.textContent+="⚠ "+error;break}if(text)resp.textContent+=text}catch{}
        }
      }
    }catch(e){resp.textContent="⚠ "+e.message}
    send.disabled=false;
  }

  send.addEventListener("click",ask);
  input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask()}});
})();

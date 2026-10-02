/* AuroLIFE app (ported from the Claude artifact). Expects window.__backend = {use(name)} */

(function(){
const CAL="Google Calendar";
const COLORS=["a1","a2","a3","a4","a5","a6"];
const MOODS=["だるい","不安","焦り","空っぽ","迷い"];
const MOODL=["沈む","低め","普通","良い","最高"];
const WD="日月火水木金土";
const S={areas:[],tasks:[],triggers:[],journal:[],habits:[],diary:[],vision:null,view:"now",space:"all",showDone:false,cal:{state:"loading",events:[]},mood:null,newColor:"a1",dDate:null,dMood:0,dLoaded:null,diaryReady:false,theme:"system",synced:false};
let db=null,mcp=null,sample=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const dkey=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today=()=>dkey(new Date());
const addDays=(k,n)=>{const d=new Date(k+"T00:00:00");d.setDate(d.getDate()+n);return dkey(d)};
const daysUntil=k=>Math.round((new Date(k+"T00:00:00")-new Date(today()+"T00:00:00"))/864e5);
const md=k=>{const d=new Date(k+"T00:00:00");return (d.getMonth()+1)+"/"+d.getDate()};
const fmtDate=k=>{const d=new Date(k+"T00:00:00");return (d.getMonth()+1)+"/"+d.getDate()+"（"+WD[d.getDay()]+"）"};
const short=(s,n)=>{s=String(s||"");return s.length>n?s.slice(0,n)+"…":s};
const areaOf=id=>S.areas.find(a=>a.id===id);
const aKey=c=>COLORS.includes(c)?c.slice(1):"4";
const areaColor=id=>{const a=areaOf(id);return `var(--area-${a?aKey(a.color):4})`};
const areaTint=id=>{const a=areaOf(id);return `var(--tint-${a?aKey(a.color):4})`};
const areaName=id=>{const a=areaOf(id);return a?a.name:"未分類"};
const sortedAreas=()=>[...S.areas].sort((a,b)=>(a.order??0)-(b.order??0));
const STAR=(fill,sz=14)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z" fill="${fill}"/></svg>`;
const CHECK=`<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
let gid=0;
function mark(w,h){const t="mkT"+(++gid),l="mkL"+gid;return `<svg class="wave" width="${w}" height="${h}" viewBox="0 0 120 90" aria-hidden="true"><defs><linearGradient id="${t}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1FD8B0"/><stop offset="1" stop-color="#5FE3F2"/></linearGradient><linearGradient id="${l}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#36D5C8"/><stop offset=".5" stop-color="#7E8CF5"/><stop offset="1" stop-color="#A47CF7"/></linearGradient></defs><path d="M8 44C22 20 40 18 56 36S84 56 96 42" fill="none" stroke="url(#${t})" stroke-width="12" stroke-linecap="round"/><path d="M14 70C28 48 46 46 62 62S96 80 112 52" fill="none" stroke="url(#${l})" stroke-width="12" stroke-linecap="round"/><circle cx="104" cy="17" r="9" fill="#3FE0C5"/></svg>`}
$("logoSide").innerHTML=mark(28,21);$("logoTop").innerHTML=mark(24,18);

const ICONS={
  now:c=>`<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><circle cx="12" cy="12" r="3" fill="${c}"/><circle cx="12" cy="12" r="7" opacity=".6"/><circle cx="12" cy="12" r="10.5" opacity=".3"/></svg>`,
  moves:c=>`<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.5l6 3.5 2 15H4l2-15z"/><path d="M9 12h6M12 9v6"/></svg>`,
  polaris:(c,on)=>`<svg viewBox="0 0 24 24" fill="${on?"#E8C66A":"none"}" stroke="#E8C66A" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z"/></svg>`,
  spark:c=>`<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.2 1-3.6 2-4.5.3 1.8 1.2 2.6 2 3 0-3 .2-5.5 1-8.5z"/><path d="M19.5 4.5l-1 1M21 9h-1.5" opacity=".7"/></svg>`,
  trace:c=>`<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M4 20c3-1 4-4 7-6s5-1 7-4 1-5 2-6" stroke-dasharray="1.5 3.5"/><circle cx="4" cy="20" r="1.8" fill="${c}"/><circle cx="20" cy="4" r="2.2" fill="${c}"/></svg>`,
  base:c=>`<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z"/><circle cx="12" cy="12" r="2.6"/></svg>`
};
const VIEWS=[["now","Now","いま"],["moves","Moves","一手"],["polaris","Polaris","北極星"],["spark","Spark","着火"],["trace","Trace","足跡"]];
function renderNav(){
  const ic=(id,on)=>ICONS[id](on?"#34D6B6":"#8FB0B4",on);
  $("sideNav").innerHTML=VIEWS.map(([id,en,ja])=>`<button data-go="${id}" class="${S.view===id?"on":""}" ${S.view===id?'aria-current="page"':""}>${ic(id,S.view===id)}<span class="en">${en}</span><span class="ja">${ja}</span></button>`).join("");
  $("sideBase").innerHTML=`<button data-go="base" class="${S.view==="base"?"on":""}">${ic("base",S.view==="base")}<span class="en">Base</span><span class="ja">基地・設定</span></button>`;
  const fb=[["now","Now"],["moves","Moves"],["spark",""],["polaris","Polaris"],["trace","Trace"]];
  $("fbarNav").innerHTML=fb.map(([id,l])=>id==="spark"?`<button class="sp" data-go="spark" aria-label="Spark 着火"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.2 1-3.6 2-4.5.3 1.8 1.2 2.6 2 3 0-3 .2-5.5 1-8.5z"/></svg></button>`:`<button class="it ${S.view===id?"on":""}" data-go="${id}"><span class="ic">${ic(id,S.view===id)}</span>${l}</button>`).join("");
  document.querySelector(".mtop .gear").classList.toggle("on",S.view==="base");
}
function go(v){S.view=v;document.querySelectorAll("section[data-view]").forEach(s=>s.hidden=s.dataset.view!==v);renderNav();try{localStorage.setItem("view",v)}catch(e){}window.scrollTo(0,0)}

function toast(m){document.querySelectorAll(".toast").forEach(t=>t.remove());const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2400)}
function banner(m){$("banner").textContent=m||"";$("banner").hidden=!m}
async function guard(p,msg){try{return await p}catch(e){console.error(e);toast(msg||"保存できませんでした。通信状態を確認して、もう一度お試しください。")}}
const col=n=>db.collection(n);
function need(){if(!db){toast("保存機能を読み込み中です。少し待ってからもう一度どうぞ。");return false}return true}
const addTask=d=>need()&&guard(col("tasks").add({title:d.title,area:d.area||"",due:d.due||"",note:d.note||"",today:!!d.today,done:false,createdAt:Date.now()}));
const upd=(c,id,p)=>need()&&guard(col(c).doc(id).update(p));
const del=(c,id)=>need()&&guard(col(c).doc(id).delete());
const habitDoc=k=>S.habits.find(h=>h.id===k)||{};
const diaryOf=k=>S.diary.find(x=>x.id===k);
const doneOn=k=>S.tasks.filter(t=>t.done&&t.doneAt&&dkey(new Date(t.doneAt))===k);
const open=()=>S.tasks.filter(t=>!t.done);
const inSpace=(t,sp)=>sp==="all"||(areaOf(t.area)?t.area:"")===sp;

// ---------- shared pieces ----------
function taskRow(t,o={}){
  const due=t.due?(()=>{const n=daysUntil(t.due);return `<span class="badge ${n<=2?"warn":"plain"}">${n<0?"期限切れ "+md(t.due):n===0?"今日まで":md(t.due)+" まで"}</span>`})():"";
  return `<div class="trow ${o.cardish?"cardish":""} ${t.done?"done":""}">
    <button class="chk ${t.done?"on":""}" data-act="done" data-id="${esc(t.id)}" aria-label="${t.done?"完了を取り消す":"完了にする"}">${t.done?CHECK:""}</button>
    <div class="tbody"><span class="ttl">${esc(t.title)}</span><span class="meta"><span class="dot" style="background:${areaColor(t.area)}"></span>${esc(areaName(t.area))}${due}${o.showToday&&t.today?'<span class="badge today">今日</span>':""}</span></div>
    <div class="tact">${o.todayBtn?`<button class="tbtn ${t.today?"on":""}" data-act="today" data-id="${esc(t.id)}" aria-pressed="${!!t.today}">今日</button>`:""}<button class="ibtn" data-act="edit" data-id="${esc(t.id)}" aria-label="編集">編集</button></div></div>`;
}
function spacesHTML(){
  const defs=[["all","すべて"]].concat(sortedAreas().map(a=>[a.id,a.name]));
  return defs.map(([id,name])=>{
    const on=S.space===id;
    const list=open().filter(t=>inSpace(t,id)).sort((a,b)=>(b.today?1:0)-(a.today?1:0)||((a.due||"9")>(b.due||"9")?1:-1));
    const color=id==="all"?"var(--aurora)":areaColor(id);
    const next=id==="all"?"今日の三手と、全スペースの締切":(list[0]?list[0].title:"次の一手はまだありません");
    const bar=on?`background:${color};box-shadow:0 0 12px ${color}`:`background:${id==="all"?"var(--aurora-soft)":areaTint(id)}`;
    return `<button class="space ${on?"on":""}" data-act="space" data-id="${esc(id)}" aria-pressed="${on}"><span class="top"><span class="nm">${esc(name)}</span><span class="ct num">${list.length}</span></span><span class="nx">${esc(next)}</span><span class="bar" style="${bar}"></span></button>`}).join("");
}

// ---------- NOW ----------
function nextDeadline(){const c=open().filter(t=>t.due&&daysUntil(t.due)>=0).sort((a,b)=>a.due.localeCompare(b.due))[0];return c}
function renderNow(){
  const d=new Date();
  $("nowDate").textContent=`${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const bed=new Date(d);bed.setHours(24,0,0,0);const mins=Math.max(0,Math.round((bed-d)/6e4));
  const nd=nextDeadline();const ndTxt=nd?(daysUntil(nd.due)===0?`今日が期限：${short(nd.title,12)}`:`${short(nd.title,12)}まで${daysUntil(nd.due)}日`):"期限の近い一手はありません";
  $("nowSub").textContent=`${ndTxt} · 就寝まで${Math.floor(mins/60)}時間${mins%60}分`;
  $("spacesNow").innerHTML=spacesHTML();
  const sp=S.space;
  const stage=$("stageNow");stage.classList.toggle("tinted",sp!=="all");stage.style.background=sp==="all"?"transparent":areaTint(sp);stage.style.borderTop=sp==="all"?"0":`3px solid ${areaColor(sp)}`;
  const list=sp==="all"?S.tasks.filter(t=>t.today&&(!t.done||(t.doneAt&&dkey(new Date(t.doneAt))===today()))):S.tasks.filter(t=>inSpace(t,sp)&&!t.done);
  list.sort((a,b)=>(a.done?1:0)-(b.done?1:0)||((a.due||"9")>(b.due||"9")?1:-1));
  $("todayTitle").textContent=sp==="all"?"今日の三手":`${areaName(sp)} の一手`;
  $("todayMeta").textContent=sp==="all"?`${list.filter(t=>t.done).length} / ${Math.max(3,list.length)}`:`${list.length}件`;
  $("todayList").innerHTML=list.length?list.map(t=>taskRow(t,{showToday:sp!=="all"})).join(""):`<div class="empty">${sp==="all"?"Moves で「今日」を押すと、ここに並びます。三手まで選ぶのがおすすめです。":"このスペースの次の一手はまだありません。"}</div>`;
  $("todayAdd").textContent=sp==="all"?(list.length>=3?"Moves を開く":`${list.length?"次の":"最初の"}一手を Moves から選ぶ`):`${areaName(sp)} に一手を足す`;
  const radar=open().filter(t=>t.due&&daysUntil(t.due)<=14&&inSpace(t,sp)).sort((a,b)=>a.due.localeCompare(b.due));
  $("radarList").innerHTML=radar.length?radar.map(t=>{const n=daysUntil(t.due);return `<div class="rrow"><span class="d num">${md(t.due)}</span><span>${esc(short(t.title,30))}</span><span class="badge ${n<=2?"warn":"plain"}" style="${n<=2?"":"background:var(--row)"}">${n<0?"期限切れ":n===0?"今日":"あと"+n+"日"}</span></div>`}).join(""):`<div class="rrow" style="grid-template-columns:1fr"><span class="muted small">14日以内の締切はありません。</span></div>`;
  renderArc();renderCal();renderBubble();renderRhythm();
}
function arcPoint(h){const f=Math.max(0,Math.min(1,(h-7.5)/16.5));const a=Math.PI*(1-f);return [160+130*Math.cos(a),140-130*Math.sin(a),f]}
function renderArc(){
  const d=new Date(),h=d.getHours()+d.getMinutes()/60;const [x,y,f]=arcPoint(h);const [mx,my]=arcPoint(Math.min(12,Math.max(7.5,h)));
  const evs=(S.cal.events||[]).filter(e=>e.start&&e.start.dateTime).map(e=>{const s=new Date(e.start.dateTime);return {h:s.getHours()+s.getMinutes()/60,t:e.start.dateTime.slice(11,16)}}).filter(e=>e.h>=7.5&&e.h<=24&&e.h>h);
  const dots=evs.map((e,i)=>{const [ex,ey]=arcPoint(e.h);return `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.5" fill="#9C8CF0"/>${i<3?`<text x="${(ex-8).toFixed(1)}" y="${(ey-9).toFixed(1)}" text-anchor="end" fill="#83A2A7" font-size="10" font-family="Inter,sans-serif">${e.t}</text>`:""}`}).join("");
  $("arcBox").innerHTML=`<svg viewBox="0 0 320 150" role="img" aria-label="起床から就寝までのうち、今は${Math.round(f*100)}%の位置">
  <path d="M30 140 A130 130 0 0 1 290 140" fill="none" stroke="#173549" stroke-width="8" stroke-linecap="round"/>
  ${h>7.5?`<path d="M30 140 A130 130 0 0 1 ${mx.toFixed(1)} ${my.toFixed(1)}" fill="none" stroke="#34C9A5" stroke-width="8" stroke-linecap="round" opacity=".55"/>`:""}
  ${dots}
  <circle class="pulse" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="#34C9A5" opacity=".3"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="#34D6B6"/>
  <text x="160" y="112" text-anchor="middle" fill="#E2F1F0" font-family="Inter,sans-serif" font-size="30" font-weight="700">${Math.round(f*100)}%</text>
  <text x="160" y="132" text-anchor="middle" fill="#83A2A7" font-family="Noto Sans JP,sans-serif" font-size="11">${h<12?"午前の集中枠":"今日の進み具合"}</text></svg>`;
}
function calErr(err){const c=err&&err.code;return c==="needs_reauth"?"Googleカレンダーの再接続が必要です（Base から再ログイン）":c==="server_not_connected"?"Googleカレンダーが未接続です（Base から再ログイン）":c==="not_granted"?"カレンダーへのアクセスが許可されていません":"カレンダーに登録できませんでした。もう一度お試しください"}
function renderCal(){
  const c=S.cal,box=$("flowList");
  if(c.state==="loading"){box.innerHTML=`<span class="small muted">予定を読み込み中…</span>`;return}
  if(c.state==="off"){box.innerHTML=`<span class="small muted">${esc(c.msg||"Googleカレンダーに接続すると、今日の予定がここに出ます。")}</span>`;return}
  const now=new Date(),nowT=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const rows=c.events.map(e=>{const s=e.start||{},en=e.end||{};const t=s.dateTime?s.dateTime.slice(11,16):"終日";const past=en.dateTime&&new Date(en.dateTime)<now;return {t,title:e.summary||"（無題）",cls:past?"past":"",sort:s.dateTime?new Date(s.dateTime).getTime():0}});
  rows.push({t:nowT,title:"いまここ",cls:"now",sort:now.getTime()});
  rows.sort((a,b)=>a.sort-b.sort);
  box.innerHTML=rows.map(r=>`<div class="frow ${r.cls}"><span class="t num">${r.t}</span><span class="fdot ${r.cls}"></span><span class="x">${esc(r.title)}</span></div>`).join("");
}
function renderBubble(){
  const now=new Date(),h=now.getHours();
  const todayOpen=S.tasks.filter(t=>t.today&&!t.done);
  const late=(S.cal.events||[]).find(e=>e.start&&e.start.dateTime&&new Date(e.start.dateTime)>now&&(new Date(e.start.dateTime).getHours()>=23||(e.end&&e.end.dateTime&&dkey(new Date(e.end.dateTime))!==today()&&new Date(e.end.dateTime).getHours()>0)));
  let msg,btn=null;
  if(late){msg=`${late.start.dateTime.slice(11,16)}からの「${short(late.summary||"予定",16)}」が、就寝目標の24:00に近いです。残りの用事は前倒しにしませんか。`}
  else if(todayOpen.length>3){msg=`今日の一手が${todayOpen.length}件あります。三手に絞ると、集中して終えやすくなります。`;btn=["Moves で絞る","moves"]}
  else if(!S.tasks.some(t=>t.today)){msg="今日の一手がまだありません。Moves から三手だけ選びましょう。";btn=["三手を選ぶ","moves"]}
  else if(h>=12&&!doneOn(today()).length&&todayOpen.length){msg=`午前の集中枠が過ぎました。「${short(todayOpen[0].title,18)}」を15分だけ進めませんか。`;btn=["Spark で着火","spark"]}
  else if(!todayOpen.length&&S.tasks.some(t=>t.today)){msg="今日の一手はすべて指しました。足跡を残して、早めに休みましょう。";btn=["Trace を書く","trace"]}
  else{const r=(S.vision&&S.vision.root)||"自分と家族の幸せ";msg=`いまの一手は「${short(r,20)}」につながっています。焦らず、一手ずつ。`}
  $("bubble").innerHTML=`<div class="av">${STAR("#E8C66A",18)}</div><div class="col" style="gap:6px"><span class="who"><b>Polaris</b> · 軸チェック</span><div class="msg">${esc(msg)}</div>${btn?`<div class="acts"><button class="chip violet" data-go="${btn[1]}">${esc(btn[0])}</button></div>`:""}</div>`;
}
function renderRhythm(){
  const k=today(),h=habitDoc(k);
  $("rhythmBox").innerHTML=[["sleep","24:00","就寝（昨夜）"],["wake","7:30","起床"],["run","RUN","ランニング"]].map(([f,b,l])=>`<button class="rh ${h[f]?"on":""}" data-act="habit" data-id="${f}" aria-pressed="${!!h[f]}"><b class="num">${b}</b><span>${l}</span></button>`).join("");
  const w=[];for(let i=6;i>=0;i--){const dk=addDays(k,-i);const d=new Date(dk+"T00:00:00");w.push(`<span class="${habitDoc(dk).run?"on":""}" title="${dk}">${WD[d.getDay()]}</span>`)}
  $("runWeek").innerHTML=w.join("");
}

// ---------- MOVES ----------
function renderMoves(){
  $("spacesMoves").innerHTML=spacesHTML();
  $("showActive").classList.toggle("on",!S.showDone);$("showAll").classList.toggle("on",S.showDone);
  $("showAll").textContent=`完了も表示（${S.tasks.filter(t=>t.done).length}）`;
  const vis=S.tasks.filter(t=>inSpace(t,S.space)&&(S.showDone||!t.done)).sort((a,b)=>(a.done?1:0)-(b.done?1:0)||((a.due||"9")>(b.due||"9")?1:-1)||(a.createdAt||0)-(b.createdAt||0));
  const cols=[["today","今日","var(--aurora)",t=>t.today],["soon","2週間以内","#9C8CF0",t=>!t.today&&t.due&&daysUntil(t.due)<=14],["later","その先・期限なし","var(--polar-muted)",t=>!t.today&&(!t.due||daysUntil(t.due)>14)]];
  $("board").innerHTML=cols.map(([id,title,c,fn])=>{const items=vis.filter(fn);return `<div class="bcol ${id==="today"?"today":""}"><div class="hd"><span class="inline" style="gap:8px"><span class="dot ${id==="today"?"breathe":""}" style="background:${c};box-shadow:0 0 10px ${c}"></span>${title}</span><span class="small muted num">${items.length}</span></div>${items.map(t=>taskRow(t,{cardish:true,todayBtn:true})).join("")||`<div class="empty" style="text-align:center">${id==="today"?"「今日」を押した一手がここに並びます":"ここに次の一手を置けます"}</div>`}</div>`}).join("");
  $("statMoves").textContent=`Moves ${open().length}`;$("statSpace").textContent=`Space: ${S.space==="all"?"すべて":areaName(S.space)}`;
}

// ---------- POLARIS ----------
function context(){
  const v=S.vision||{};
  const o=open().slice(0,25).map(t=>`- [${areaName(t.area)}] ${t.title}${t.due?`（期限 ${t.due}）`:""}${t.today?"（今日やる）":""}`).join("\n");
  return `【根っこ】${v.root||"未設定"}\n【価値観の核】${v.core||"未設定"}\n【目指す未来】${v.future||"未設定"}\n【判断の優先順位】${v.priorities||"未設定"}\n【スペース】${sortedAreas().map(a=>a.name).join("、")||"未設定"}\n【進行中の一手】\n${o||"（なし）"}\n【今日】${today()}`;
}
function parseSecs(text){return text.split(/^##\s*/m).filter(s=>s.trim()).map(p=>{const [h,...r]=p.split("\n");return {k:h.trim(),v:r.join("\n").trim()}})}
function stepOf(text,head){const s=parseSecs(text).find(x=>x.k.includes(head));return s?(s.v.split("\n").map(x=>x.replace(/^[-・*\s]+/,"").trim()).filter(Boolean)[0]||""):""}
function constellationHTML(text){
  const secs=parseSecs(text);if(!secs.length)return `<p class="thinking">${esc(text)}</p>`;
  return `<div class="steps">${secs.map((s,i)=>{const last=/次の一歩/.test(s.k);const fill=last?"#E8C66A":i===0?"#34D6B6":"#9C8CF0";return `<div class="step ${last?"last":""}"><div class="rail"><span class="st ${last?"pulse":""}">${STAR(fill)}</span><span class="ln"></span></div><div class="bd"><span class="k">${esc(s.k)}</span><span class="v">${esc(s.v)}</span></div></div>`}).join("")}</div>`;
}
function answerHTML(text){const secs=parseSecs(text);if(!secs.length)return `<p class="small">${esc(text)}</p>`;return `<div class="answer">${secs.map((s,i)=>`<div class="${i===secs.length-1?"last":""}"><h3>${esc(s.k)}</h3><p>${esc(s.v)}</p></div>`).join("")}</div>`}
function renderPolaris(){
  const v=S.vision||{};
  $("sideRoot").textContent=v.root||"自分と家族の幸せ";
  $("axisBox").innerHTML=`<div class="row-between"><h2>わたしの軸</h2><button class="ibtn" data-go="base">編集</button></div>
    <div class="rootcard"><span class="lbl">POLARIS · 根っこ</span><span class="v">${esc(v.root||"未設定")}</span></div>
    ${[["価値観の核",v.core],["目指す未来",v.future],["判断の優先順位",v.priorities]].filter(x=>x[1]).map(([k,val])=>`<div class="axis"><span class="k">${k}</span><span class="v">${esc(val)}</span></div>`).join("")||`<span class="small muted">Base で軸を書くと、Polaris がそこへ向かってたどります。</span>`}`;
  const j=[...S.journal].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,20);
  const lab={compass:["Polaris",""],ignite:["Spark","gold"],review:["週の振り返り","green"]};
  $("journalList").innerHTML=j.length?j.map(e=>{const d=new Date(e.at||0);const [l,c]=lab[e.kind]||["記録",""];return `<details class="rec"><summary><span class="meta"><span class="num">${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}</span><span class="pill ${c}">${l}</span></span><span class="small">${esc(short(e.feeling||e.step||"",60))}</span></summary><div class="body">${e.answer?esc(e.answer.replace(/^##\s*/gm,"■ ")):""}${e.step?`\n次の一歩：${esc(e.step)}`:""}</div></details>`}).join(""):`<div class="empty">たどった記録がここに並びます。読み返すと、悩みの変化と積んだ一手が見えます。</div>`;
}
let compassCtl=null;
$("compassGo").onclick=async()=>{
  const feel=$("feel").value.trim();if(!feel){toast("いま感じていることを一言でも書いてください");return}
  const out=$("constellation");out.hidden=false;
  const head=`<div class="row-between" style="margin-bottom:10px"><span style="font-weight:700;font-size:15px">星座のみちすじ</span><span class="cap muted">${esc(short(feel,24))}</span></div>`;
  if(!sample){const v=S.vision||{};out.innerHTML=head+constellationHTML(`## いま\n${feel}\n## 根っこ\n${v.root||"（Baseで書く）"}\n## 目指す未来\n${v.future||""}\n## 次の一歩\nMoves で、この悩みに関係する一手を1つだけ選ぶ`);return}
  compassCtl?.abort();compassCtl=new AbortController();
  $("compassGo").disabled=true;out.innerHTML=head+`<p class="thinking">北極星までたどっています…</p>`;
  const prompt=`あなたはMasaの「Polaris（北極星）」役です。慶應SFCの学生で、受託開発の営業兼PM、デベロッパー志望、北海道に貢献したい人です。
目的：今の悩みや感情から出発し、本人が決めた軸まで段階的に考えをたどらせ、今やっている一手の意味をはっきりさせ、動ける状態に戻すこと。
ルール：日本語で簡潔に。結論ベース。励ましだけで終わらせず、ズレがあれば率直に指摘する。本人の軸の言葉を引用してつなぐ。説教しない。

${context()}

【いま感じていること】
${feel}

次の形式だけで答えてください（見出しはそのまま、各1〜2文）。
## いま
感情をそのまま受け止め、状況を言語化
## 根っこ
この悩みが、根っこ・価値観のどれに触れているか
## 北極星までの道筋
「今の悩み → 価値観 → 目指す未来」を矢印で3段
## いまの一手の意味
進行中の一手のうち関係するものを1〜2個挙げ、軸のどこにつながるか
## ズレ
判断の優先順位とのズレがあれば率直に。なければ「なし」
## 次の一歩
5分以内に始められる具体的な行動を1つだけ、1行で`;
  let text="";
  try{const r=await sample(prompt,{cache:false,signal:compassCtl.signal,onText:({text:t})=>{text=t;out.innerHTML=head+constellationHTML(t)}});text=r.text}
  catch(err){$("compassGo").disabled=false;if(err.code==="cancelled")return;
    if(!err.text){out.innerHTML=head+`<p class="thinking">${err.code==="not_granted"?"AIを使えるのは登録したアカウントだけです。":err.code==="rate_limited"?"少し時間をおいてから、もう一度たどってください。":"うまく返答を受け取れませんでした。もう一度お試しください。"}</p>`;return}
    text=err.text}
  $("compassGo").disabled=false;
  const step=stepOf(text,"次の一歩");
  out.innerHTML=head+constellationHTML(text)+`<div class="inline" style="margin-top:6px">${step?`<button class="btn primary sm" id="stepAdd">今日の一手にする</button>`:""}<button class="btn ghost-dark" data-go="spark">それでも動けない → Spark</button></div>`;
  if(step)$("stepAdd").onclick=async e=>{e.currentTarget.disabled=true;await addTask({title:step,today:true});toast("今日の一手に入れました")};
  if(db)guard(col("journal").add({kind:"compass",at:Date.now(),feeling:feel,answer:text,step}));
  $("feel").value="";try{localStorage.removeItem("feelDraft")}catch(e){}
};
$("feel").addEventListener("input",()=>{try{localStorage.setItem("feelDraft",$("feel").value)}catch(e){}});

// ---------- SPARK ----------
let timerId=null,lastIgnite=null;
function renderSpark(){
  $("moodChips").innerHTML=MOODS.map(m=>`<button class="mchip ${S.mood===m?"on":""}" data-act="mood" data-id="${m}" aria-pressed="${S.mood===m}">${m}</button>`).join("");
  const hit=lastIgnite&&lastIgnite.triggerTitle;
  $("trigList").innerHTML=S.triggers.map(x=>`<div class="card trig ${hit&&hit===x.title?"hit":""}"><div class="row-between" style="align-items:center"><span style="font-weight:700;font-size:16px">${esc(x.title)}</span><span class="badge plain num" style="background:var(--row)">${x.minutes||5}分</span></div>${x.story?`<span class="small muted">${esc(x.story)}</span>`:""}${x.action?`<span class="act"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:3px"><path d="M5 12h14M13 6l6 6-6 6"/></svg>${esc(x.action)}</span>`:""}</div>`).join("")+
    `<button class="addtrig" data-act="trig-new"><span style="font-weight:700">＋ ${S.triggers.length?"動いて燃えた体験を足す":"最初の火種を登録する"}</span><span class="small muted">${S.triggers.length?"5〜15分で動けた体験が1つあると、着火の精度が上がります。":"本気で燃えた体験と、そのとき効いた最初の行動を書いておきます。"}</span></button>`;
}
$("igniteGo").onclick=async()=>{
  const out=$("igniteOut");out.hidden=false;clearInterval(timerId);
  const fallback=()=>{const t=S.triggers;const tk=S.tasks.find(x=>x.today&&!x.done)||open()[0];if(!t.length)return {line:"まず1分だけ。",action:(tk?tk.title:"今日の一手を1つ書く")+" を1分だけ触る",minutes:5};const x=t[Math.floor(Math.random()*t.length)];return {triggerTitle:x.title,line:`あのときの自分を思い出す：${x.title}`,action:x.action||"同じ一歩を、今日の一手でやる",minutes:Math.min(15,x.minutes||5)}};
  let r;
  if(sample){$("igniteGo").disabled=true;out.innerHTML=`<p class="small muted">火種を探しています…</p>`;
    const trig=S.triggers.map(x=>`- ${x.title}：${x.story||""}（効いた行動：${x.action||"未記入"}、${x.minutes||5}分）`).join("\n")||"（未登録）";
    try{r=await sample.json(`あなたはMasaの「着火役」です。本人の過去の強烈な体験を思い出させ、いますぐ体が動く行動を1つだけ提案します。
${context()}
【火種（着火体験）】
${trig}
【いまの気分】${S.mood||"未選択"}
条件：行動は5〜15分で終わり、進行中の一手（今日やる優先）に直結させる。火種が登録されていればその体験を必ず1つ使い、そのときの感覚を思い出させる一言にする。未登録なら軸を使う。
JSONのみで返す：{"triggerTitle":"使った体験名 または null","line":"体験を想起させる一言（25字以内）","action":"いますぐやる具体行動1つ（45字以内）","minutes":数値,"taskTitle":"一手として登録するときの名前（25字以内）"}`,{cache:false,modelTier:"quick"})}
    catch(err){r=fallback();if(err.code==="not_granted")toast("AIが使えないため、登録済みの火種から選びました")}
    $("igniteGo").disabled=false}else r=fallback();
  lastIgnite=r;renderSpark();
  const mins=Math.max(1,Math.min(60,+r.minutes||5));let left=mins*60,running=false;
  out.innerHTML=`${r.triggerTitle?`<span class="pill" style="align-self:flex-start;display:inline-flex;gap:6px;align-items:center;padding:3px 10px;font-size:12px">${STAR("var(--violet)",12)}${esc(r.triggerTitle)}</span>`:""}
    <span class="line">${esc(r.line||"")}</span><span>${esc(r.action||"")}</span>
    <div class="timerbar"><span class="timer num" id="tm">${pad(mins)}:00</span><span class="inline"><button class="btn primary sm" id="igStart">${mins}分だけ始める</button><button class="btn ghost-dark" id="igTask">一手にする</button><button class="btn ghost-dark" id="igAgain">別の案</button></span></div>`;
  $("igStart").onclick=e=>{const b=e.currentTarget;
    if(running){clearInterval(timerId);running=false;b.textContent="再開";$("tm").classList.remove("pulse");return}
    if(left<=0)return;running=true;b.textContent="一時停止";$("tm").classList.add("pulse");
    if(left===mins*60&&db)guard(col("journal").add({kind:"ignite",at:Date.now(),feeling:S.mood||"",step:r.action||"",answer:""}));
    timerId=setInterval(()=>{left--;$("tm").textContent=`${pad(Math.floor(left/60))}:${pad(left%60)}`;if(left<=0){clearInterval(timerId);running=false;$("tm").textContent="火がついた";$("tm").classList.remove("pulse");b.textContent="完了";b.disabled=true;toast("おつかれさま。このまま続けてもOK")}},1000)};
  $("igTask").onclick=async e=>{e.currentTarget.disabled=true;await addTask({title:r.taskTitle||r.action,today:true});toast("今日の一手に入れました")};
  $("igAgain").onclick=()=>$("igniteGo").click();
};

// ---------- TRACE ----------
function loadDiary(){const k=S.dDate,e=diaryOf(k)||{};$("dDate").value=k;$("dBody").value=e.body||"";$("dGood").value=e.good||"";$("dLearn").value=e.learn||"";$("dNext").value=e.next||"";S.dMood=e.mood||0;S.dLoaded=k;$("dSaved").textContent=e.updatedAt?"保存済み":"";renderMood()}
function renderMood(){$("dMood").innerHTML=MOODL.map((l,i)=>`<button class="${S.dMood===i+1?"on":""}" data-act="dmood" data-id="${i+1}" role="radio" aria-checked="${S.dMood===i+1}">${l}</button>`).join("");renderWeekGraph()}
function renderWeekGraph(){
  const end=today();const out=[];
  for(let i=6;i>=0;i--){const k=addDays(end,-i);const e=diaryOf(k)||{};const m=k===S.dDate?S.dMood:(e.mood||0);const run=habitDoc(k).run;const d=new Date(k+"T00:00:00");
    out.push(`<div class="wday ${k===end?"today":""}"><div class="h"><span class="p ${m?"on":""} ${run?"run":""} ${k===S.dDate&&m?"breathe":""}" style="margin-bottom:${m?(m-1)*13:0}px" title="${k}${m?" "+MOODL[m-1]:""}"></span></div><span class="d">${k===end?"今日":WD[d.getDay()]}</span></div>`)}
  $("weekGraph").innerHTML=out.join("");
}
function renderTrace(){
  if(!S.dDate)S.dDate=today();
  if(S.dLoaded!==S.dDate&&S.diaryReady)loadDiary();else if(!S.dLoaded){$("dDate").value=S.dDate;renderMood()}else renderWeekGraph();
  const h=habitDoc(S.dDate),n=doneOn(S.dDate).length;
  $("dStats").innerHTML=`<span class="pill green" style="font-size:12px;padding:2px 10px">完了 ${n}件</span>${h.wake?'<span class="pill green" style="font-size:12px;padding:2px 10px">7:30 起床</span>':""}${h.run?'<span class="pill green" style="font-size:12px;padding:2px 10px">ランニング</span>':""}<span class="small muted">${fmtDate(S.dDate)}</span>`;
  const list=[...S.diary].sort((a,b)=>b.id.localeCompare(a.id)).slice(0,30);
  $("diaryList").innerHTML=list.length?list.map(e=>`<button class="mrow" style="width:100%;text-align:left" data-act="diary" data-id="${esc(e.id)}"><span class="grow"><span class="meta"><span class="num">${fmtDate(e.id)}</span>${e.mood?`<span class="pill">${MOODL[e.mood-1]}</span>`:""}</span><span class="small" style="display:block">${esc(short((e.body||e.good||"").split("\n")[0],48))}</span></span></button>`).join(""):`<div class="empty">残した日記がここに並びます。続けるほど、振り返りが具体的になります。</div>`;
}
$("dPrev").onclick=()=>{S.dDate=addDays(S.dDate,-1);loadDiary();renderTrace()};
$("dNextDay").onclick=()=>{S.dDate=addDays(S.dDate,1);loadDiary();renderTrace()};
$("dDate").onchange=()=>{if($("dDate").value){S.dDate=$("dDate").value;loadDiary();renderTrace()}};
$("dSave").onclick=async()=>{if(!need())return;await guard(db.doc("diary/"+S.dDate).set({mood:S.dMood||0,body:$("dBody").value,good:$("dGood").value.trim(),learn:$("dLearn").value.trim(),next:$("dNext").value.trim(),updatedAt:Date.now()}));$("dSaved").textContent="保存しました";toast("足跡を残しました")};
$("dNextTask").onclick=async e=>{const t=$("dNext").value.trim();if(!t){toast("明日の一歩を書いてください");return}const b=e.currentTarget;b.disabled=true;await addTask({title:t,due:addDays(S.dDate,1)});b.disabled=false;toast(`${fmtDate(addDays(S.dDate,1))}の一手に入れました`)};
$("weekGo").onclick=async()=>{const out=$("weekOut");out.hidden=false;
  const lines=[];for(let i=6;i>=0;i--){const k=addDays(today(),-i),e=diaryOf(k)||{},h=habitDoc(k);lines.push(`${k}：調子${e.mood?MOODL[e.mood-1]:"未記入"}／完了${doneOn(k).map(t=>t.title).join("、")||"なし"}／ラン${h.run?"○":"×"}／起床${h.wake?"○":"×"}${e.body?`／日記：${e.body.slice(0,300)}`:""}${e.good?`／良かった：${e.good}`:""}${e.learn?`／気づき：${e.learn}`:""}`)}
  if(!sample){out.innerHTML=`<p class="small muted">AIが使えない環境のため、振り返りを作れません。</p>`;return}
  $("weekGo").disabled=true;out.innerHTML=`<p class="small muted">1週間をたどっています…</p>`;
  const prompt=`あなたはMasaの週次レビュー役です。日本語・簡潔・結論ベース。褒めるだけで終わらせず、軸とのズレは率直に。\n${context()}\n【直近7日】\n${lines.join("\n")}\n次の形式だけで答える。\n## 今週の流れ\n2〜3文\n## 積めた証\n具体的に1〜3個\n## 軸とのズレ\n優先順位・生活リズムとのズレ。なければ「なし」\n## 来週の一歩\n来週の午前中に最優先でやる行動を1つ、1行で`;
  let text="";
  try{const r=await sample(prompt,{cache:false,onText:({text:t})=>{text=t;out.innerHTML=answerHTML(t)}});text=r.text}
  catch(err){text=err.text||"";if(!text){out.innerHTML=`<p class="small muted">${err.code==="not_granted"?"AIを使えるのは登録したアカウントだけです。":"うまく返答を受け取れませんでした。もう一度お試しください。"}</p>`;$("weekGo").disabled=false;return}}
  $("weekGo").disabled=false;const step=stepOf(text,"来週の一歩");
  out.innerHTML=answerHTML(text)+(step?`<button class="btn primary sm" id="weekTask" style="margin-top:12px">来週の一歩を一手にする</button>`:"");
  if(step)$("weekTask").onclick=async e=>{e.currentTarget.disabled=true;await addTask({title:step,due:addDays(today(),7)});toast("一手に入れました")};
  if(db)guard(col("journal").add({kind:"review",at:Date.now(),feeling:"週の振り返り",answer:text,step}));
};

// ---------- BASE ----------
const TH={system:["自動",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/></svg>'],light:["ライト",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/></svg>'],dark:["ダーク",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>']};
function setTheme(t){S.theme=t;if(t==="system")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("theme",t)}catch(e){}
  $("themeSeg").innerHTML=Object.entries(TH).map(([k,[l,ic]])=>`<button class="${t===k?"on":""}" data-act="theme" data-id="${k}" role="radio" aria-checked="${t===k}">${ic}${l}</button>`).join("")}
function renderBase(){
  const a=sortedAreas();
  $("areaMaster").innerHTML=a.length?a.map((x,i)=>`<div class="mrow"><span class="dot" style="width:12px;height:12px;background:${areaColor(x.id)}"></span><span class="grow"><span style="font-weight:600">${esc(x.name)}</span> <span class="cap muted">${open().filter(t=>t.area===x.id).length}件</span></span><button class="ibtn" data-act="area-up" data-id="${esc(x.id)}" ${i===0?"disabled":""} aria-label="上へ">↑</button><button class="ibtn" data-act="area-down" data-id="${esc(x.id)}" ${i===a.length-1?"disabled":""} aria-label="下へ">↓</button><button class="ibtn" data-act="area-edit" data-id="${esc(x.id)}">編集</button></div>`).join(""):`<div class="empty">スペースを追加すると、一手を分けて管理できます。</div>`;
  $("areaSw").innerHTML=COLORS.map(c=>`<button class="sw ${S.newColor===c?"on":""}" style="background:var(--area-${c.slice(1)})" data-act="newcolor" data-id="${c}" aria-label="色"></button>`).join("");
  $("trigMaster").innerHTML=S.triggers.length?S.triggers.map(x=>`<div class="mrow"><span class="grow"><span style="font-weight:600">${esc(x.title)}</span><span class="cap muted" style="display:block">${esc(x.action||"")}</span></span><button class="ibtn" data-act="trig-edit" data-id="${esc(x.id)}">編集</button></div>`).join(""):`<div class="empty">本気で燃えた体験を登録すると、Spark の精度が上がります。</div>`;
  const v=S.vision||{};
  if(!document.activeElement||!document.activeElement.closest("section[data-view=base]")){$("vRoot").value=v.root||"";$("vCore").value=v.core||"";$("vFuture").value=v.future||"";$("vPri").value=v.priorities||""}
  const opts=`<option value="">未分類</option>`+a.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
  ["capArea","newArea"].forEach(id=>{const v=$(id).value;$(id).innerHTML=opts;$(id).value=areaOf(v)?v:(S.space!=="all"&&areaOf(S.space)?S.space:"")});
}
function swap(i,j){const a=sortedAreas();if(j<0||j>=a.length||!need())return;a.forEach((x,k)=>x._o=k);[a[i]._o,a[j]._o]=[a[j]._o,a[i]._o];a.forEach(x=>{if((x.order??-1)!==x._o)upd("areas",x.id,{order:x._o})})}

// ---------- sheets ----------
function sheet(title,body,mount){const bg=document.createElement("div");bg.className="sheet-bg";bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${body}</div>`;
  const close=()=>{bg.remove();document.removeEventListener("keydown",esc_)};const esc_=e=>{if(e.key==="Escape")close()};document.addEventListener("keydown",esc_);
  bg.onclick=e=>{if(e.target===bg)close()};document.body.appendChild(bg);mount(bg,close);const f=bg.querySelector("input,textarea");if(f)f.focus()}
function armDelete(btn,fn){btn.onclick=()=>{if(btn.dataset.armed){fn()}else{btn.dataset.armed=1;btn.textContent="本当に削除する";setTimeout(()=>{delete btn.dataset.armed;btn.textContent="削除"},3000)}}}
function editTask(t){
  sheet("一手を編集",`<label class="field"><span>次の行動</span><input class="in" type="text" id="eT" value="${esc(t.title)}"></label>
    <div class="inline"><label class="field" style="flex:1 1 140px"><span>スペース</span><select class="in" id="eA"></select></label><label class="field" style="flex:1 1 140px"><span>期限</span><input class="in" type="date" id="eD" value="${esc(t.due||"")}"></label></div>
    <label class="field"><span>メモ</span><textarea class="in" id="eN" style="min-height:70px">${esc(t.note||"")}</textarea></label>
    <div class="card" style="background:var(--row);padding:14px;gap:10px"><span class="small muted">Googleカレンダーに時間枠として入れる</span>
      <div class="inline"><input class="in" type="date" id="cD" value="${esc(t.due||today())}" aria-label="日付"><input class="in" type="time" id="cS" value="09:00" aria-label="開始"><select class="in" id="cL" aria-label="長さ"><option value="30">30分</option><option value="60" selected>60分</option><option value="90">90分</option><option value="120">120分</option></select></div>
      <button class="btn ghost" id="cAdd" style="align-self:flex-start">カレンダーに入れる</button></div>
    <div class="acts"><button class="btn danger" id="eDel">削除</button><button class="btn primary" id="eSave">保存</button></div>`,(bg,close)=>{
    const s=bg.querySelector("#eA");s.innerHTML=`<option value="">未分類</option>`+sortedAreas().map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");s.value=areaOf(t.area)?t.area:"";
    bg.querySelector("#eSave").onclick=async()=>{const title=bg.querySelector("#eT").value.trim();if(!title){toast("次の行動を入れてください");return}await upd("tasks",t.id,{title,area:s.value,due:bg.querySelector("#eD").value,note:bg.querySelector("#eN").value});close();toast("保存しました")};
    armDelete(bg.querySelector("#eDel"),async()=>{await del("tasks",t.id);close();toast("削除しました")});
    bg.querySelector("#cAdd").onclick=async e=>{const b=e.currentTarget;b.disabled=true;const ok=await calAdd(bg.querySelector("#eT").value.trim()||t.title,bg.querySelector("#cD").value,bg.querySelector("#cS").value,+bg.querySelector("#cL").value);b.disabled=false;if(ok)close()};
  });
}
function editArea(a){let color=COLORS.includes(a.color)?a.color:"a4";
  sheet("スペースを編集",`<label class="field"><span>名前</span><input class="in" type="text" id="aN" value="${esc(a.name)}"></label><div class="swatches" id="aSw"></div><span class="small muted">削除すると、このスペースの一手は「未分類」に移ります。</span><div class="acts"><button class="btn danger" id="aDel">削除</button><button class="btn primary" id="aSave">保存</button></div>`,(bg,close)=>{
    const sw=()=>{bg.querySelector("#aSw").innerHTML=COLORS.map(c=>`<button class="sw ${color===c?"on":""}" style="background:var(--area-${c.slice(1)})" data-c="${c}" aria-label="色"></button>`).join("");bg.querySelectorAll("#aSw [data-c]").forEach(b=>b.onclick=()=>{color=b.dataset.c;sw()})};sw();
    bg.querySelector("#aSave").onclick=async()=>{const n=bg.querySelector("#aN").value.trim();if(!n){toast("名前を入れてください");return}await upd("areas",a.id,{name:n,color});close();toast("保存しました")};
    armDelete(bg.querySelector("#aDel"),async()=>{for(const t of S.tasks.filter(t=>t.area===a.id))await upd("tasks",t.id,{area:""});await del("areas",a.id);if(S.space===a.id)S.space="all";close();toast("削除しました")});
  })}
function editTrigger(x){x=x||{};
  sheet(x.id?"火種を編集":"火種を追加",`<label class="field"><span>名前</span><input class="in" type="text" id="gT" value="${esc(x.title||"")}" placeholder="例：初めて自分で案件を受注した日"></label>
    <label class="field"><span>そのときの体験・感情</span><textarea class="in" id="gS" placeholder="何があって、どう燃えたか">${esc(x.story||"")}</textarea></label>
    <label class="field"><span>そのとき効いた最初の行動</span><input class="in" type="text" id="gA" value="${esc(x.action||"")}" placeholder="例：とりあえず提案書のタイトルだけ書いた"></label>
    <label class="field"><span>目安（分）</span><input class="in" type="number" id="gM" min="1" max="120" value="${esc(x.minutes||10)}"></label>
    <div class="acts">${x.id?`<button class="btn danger" id="gDel">削除</button>`:"<span></span>"}<button class="btn primary" id="gSave">保存</button></div>`,(bg,close)=>{
    bg.querySelector("#gSave").onclick=async()=>{if(!need())return;const d={title:bg.querySelector("#gT").value.trim(),story:bg.querySelector("#gS").value.trim(),action:bg.querySelector("#gA").value.trim(),minutes:+bg.querySelector("#gM").value||10};if(!d.title){toast("名前を入れてください");return}
      if(x.id)await upd("triggers",x.id,d);else await guard(col("triggers").add({...d,createdAt:Date.now()}));close();toast("保存しました")};
    if(x.id)armDelete(bg.querySelector("#gDel"),async()=>{await del("triggers",x.id);close();toast("削除しました")});
  })}

// ---------- calendar ----------
async function calAdd(summary,date,start,mins){
  if(!mcp){toast("Googleカレンダーに接続できない状態です");return false}
  const s=new Date(`${date}T${start}:00`),e=new Date(s.getTime()+mins*6e4);const iso=d=>`${dkey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00+09:00`;
  try{await mcp.callTool(CAL,"create_event",{summary,startTime:iso(s),endTime:iso(e),timeZone:"Asia/Tokyo",description:"AuroLIFE から登録"});toast(`${fmtDate(date)} ${start} に入れました`);if(date===today()&&mcp.invalidate)mcp.invalidate(CAL,"list_events");return true}
  catch(err){toast(calErr(err));return false}
}
function watchCal(){
  const d=new Date();d.setHours(0,0,0,0);const e=new Date(d);e.setDate(e.getDate()+1);const iso=x=>`${dkey(x)}T00:00:00+09:00`;
  mcp.watchTool(CAL,"list_events",{startTime:iso(d),endTime:iso(e),orderBy:"startTime",timeZone:"Asia/Tokyo",pageSize:50},ev=>{
    if(ev.type==="data"){const p=ev.result.payload||{};S.cal={state:"ok",events:(p.events||[]).filter(x=>x.status!=="cancelled")}}
    else{const c=ev.error&&ev.error.code;if(["not_granted","server_not_connected","needs_reauth","blocked_by_policy","not_in_manifest"].includes(c))S.cal={state:"off",events:[],msg:calErr(ev.error)};else if(S.cal.state==="loading")S.cal={state:"off",events:[],msg:"予定を読み込めませんでした。少し後で開き直してください。"}}
    renderCal();renderArc();renderBubble();
  },{refetchInterval:300000});
}

// ---------- events ----------
document.addEventListener("click",async e=>{
  const g=e.target.closest("[data-go]");if(g){go(g.dataset.go);return}
  const b=e.target.closest("[data-act]");if(!b)return;
  const act=b.dataset.act,id=b.dataset.id;const t=S.tasks.find(x=>x.id===id);
  if(act==="space"){S.space=id;render();return}
  if(act==="done"&&t){upd("tasks",id,{done:!t.done,doneAt:t.done?null:Date.now()});return}
  if(act==="today"&&t){upd("tasks",id,{today:!t.today});return}
  if(act==="edit"&&t){editTask(t);return}
  if(act==="habit"){if(!need())return;const k=today(),h=habitDoc(k);const d={sleep:!!h.sleep,wake:!!h.wake,run:!!h.run};d[id]=!d[id];guard(col("habits").doc(k).set(d));return}
  if(act==="mood"){S.mood=S.mood===id?null:id;renderSpark();return}
  if(act==="dmood"){const v=+id;S.dMood=S.dMood===v?0:v;renderMood();return}
  if(act==="diary"){S.dDate=id;loadDiary();renderTrace();window.scrollTo(0,0);return}
  if(act==="theme"){setTheme(id);return}
  if(act==="newcolor"){S.newColor=id;renderBase();return}
  if(act==="area-edit"){const a=areaOf(id);if(a)editArea(a);return}
  if(act==="area-up"||act==="area-down"){const a=sortedAreas(),i=a.findIndex(x=>x.id===id);swap(i,act==="area-up"?i-1:i+1);return}
  if(act==="trig-edit"){editTrigger(S.triggers.find(x=>x.id===id));return}
  if(act==="trig-new"){editTrigger(null);return}
});
$("showActive").onclick=()=>{S.showDone=false;renderMoves()};
$("showAll").onclick=()=>{S.showDone=true;renderMoves()};
$("capText").addEventListener("keydown",async e=>{if(e.key==="Enter"&&!e.isComposing){const v=$("capText").value.trim();if(!v)return;await addTask({title:v,area:$("capArea").value});$("capText").value="";toast("Moves に入れました")}});
const addNew=async()=>{const v=$("newTitle").value.trim();if(!v){toast("次の行動を1つ書いてください");return}await addTask({title:v,area:$("newArea").value,due:$("newDue").value});$("newTitle").value="";$("newDue").value="";toast("追加しました")};
$("newAdd").onclick=addNew;$("newTitle").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing)addNew()});
$("areaAdd").onclick=async()=>{const n=$("areaName").value.trim();if(!n||!need())return;await guard(col("areas").add({name:n,color:S.newColor,order:S.areas.length?Math.max(...S.areas.map(a=>a.order??0))+1:0}));$("areaName").value="";toast("スペースを追加しました")};
$("trigNew").onclick=()=>editTrigger(null);
$("vSave").onclick=async()=>{if(!need())return;await guard(db.doc("vision/main").set({root:$("vRoot").value.trim(),core:$("vCore").value.trim(),future:$("vFuture").value.trim(),priorities:$("vPri").value.trim(),updatedAt:Date.now()}));$("vSaved").textContent="保存しました";toast("軸を保存しました")};

function render(){renderNav();renderNow();renderMoves();renderPolaris();renderSpark();renderTrace();renderBase()}
setInterval(()=>{if(S.view==="now"){const d=new Date();if(d.getSeconds()<30){renderNow()}}},30000);

// ---------- boot ----------
try{setTheme(localStorage.getItem("theme")||"system")}catch(e){setTheme("system")}
try{const qv=new URLSearchParams(location.search).get("view");const v=qv||localStorage.getItem("view");if(qv)history.replaceState(null,"","/");go(["now","moves","polaris","spark","trace","base"].includes(v)?v:"now");const f=localStorage.getItem("feelDraft");if(f)$("feel").value=f}catch(e){go("now")}
render();
const C=window.__backend;
const setSync=(txt,ok)=>{$("syncState").innerHTML=`<span class="syncdot ${ok?"":"pulse"}" style="${ok?"":"background:var(--muted)"}"></span>${txt}`};
if(!C||!C.use){S.cal={state:"off",events:[],msg:"ログインすると、予定が表示されます。"};banner("ログインすると、データの保存とGoogleカレンダー連携が使えます。");setSync("保存は無効",false);render();return}
C.use("db").then(d=>{db=d;if(!db){banner("サインインするとデータが保存されます。");setSync("保存は無効",false);return}
  ["areas","tasks","triggers","journal","habits","diary"].forEach(n=>col(n).onSnapshot(s=>{S[n]=s.docs.map(x=>({...x.data(),id:x.id}));if(n==="diary")S.diaryReady=true;setSync("同期済み",true);render()},err=>{console.error(err);setSync("同期が止まりました",false);banner("データの読み込みが止まりました。ページを開き直してください。")}));
  db.doc("vision/main").onSnapshot(s=>{S.vision=s.data()||null;renderPolaris();renderBase();renderBubble()},()=>{});
});
C.use("mcp").then(m=>{mcp=m;if(!mcp){S.cal={state:"off",events:[]};renderCal();return}watchCal()});
C.use("sample").then(s=>{sample=s;if(!s){$("compassNote").textContent="AIが使えない環境のため、自分の軸を並べて表示します。";$("igniteNote").textContent="登録した火種から1つ選びます。"}});
})();

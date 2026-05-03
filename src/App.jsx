import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

/* ── Firebase setup ── */
const firebaseConfig = {
  apiKey: "AIzaSyAajoteZIuZSB8LsM87wzaPtg43xiI92b8",
  authDomain: "komu-timeflow.firebaseapp.com",
  projectId: "komu-timeflow",
  storageBucket: "komu-timeflow.firebasestorage.app",
  messagingSenderId: "698782559506",
  appId: "1:698782559506:web:6de2beed65ba325c0957cb",
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(fbApp);
const uuid = () => Math.random().toString(36).slice(2,10);

/* ── Push Notification System ── */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
async function getSW() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.ready; } catch { return null; }
}
async function requestNotifPermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
// Schedule a single notification
function scheduleNotif(id, title, body, fireAt) {
  if (fireAt <= Date.now()) return;
  getSW().then(sw => {
    sw?.active?.postMessage({ type: "SCHEDULE", id, title, body, fireAt });
  });
}
function cancelNotif(id) {
  getSW().then(sw => { sw?.active?.postMessage({ type: "CANCEL", id }); });
}
// Schedule all notifs for an event on a specific date
function scheduleEventNotifs(ev, dateStr) {
  if (!ev.startTime || !ev.notif) return;
  const [h, m] = ev.startTime.split(":").map(Number);
  const startMs = new Date(dateStr + "T" + pad(h) + ":" + pad(m) + ":00").getTime();
  if (ev.notif.onStart) {
    const mins = ev.notif.startMins ?? 15;
    const fireAt = startMs - mins * 60000;
    const label = mins === 0 ? "现在开始" : mins + " 分钟后开始";
    scheduleNotif(ev.id + "_" + dateStr + "_start", ev.title || "日程提醒", label + " · " + ev.startTime, fireAt);
  }
  if (ev.notif.onEnd && ev.endTime) {
    const [eh, em] = ev.endTime.split(":").map(Number);
    let endMs = new Date(dateStr + "T" + pad(eh) + ":" + pad(em) + ":00").getTime();
    if (endMs <= startMs) endMs += 86400000;
    const mins = ev.notif.endMins ?? 0;
    const fireAt = endMs - mins * 60000;
    const label = mins === 0 ? "任务即将结束" : mins + " 分钟后结束";
    scheduleNotif(ev.id + "_" + dateStr + "_end", ev.title || "日程提醒", label, fireAt);
  }
}
function rescheduleAll(events) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  getSW().then(sw => {
    if (!sw?.active) return;
    sw.active.postMessage({ type: "CANCEL_ALL" });
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const ds = fmtDate(d);
      events.forEach(ev => {
        if (!ev.startTime || !ev.notif?.onStart && !ev.notif?.onEnd) return;
        if (occursOn(ev, ds)) scheduleEventNotifs(ev, ds);
      });
    }
  });
}
function useNotifPermission() {
  const [perm, setPerm] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const ask = useCallback(async () => {
    const p = await requestNotifPermission();
    setPerm(p);
    return p;
  }, []);
  return [perm, ask];
}
const pad = n => String(n).padStart(2,"0");
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const isSameDay = (a,b) => fmtDate(new Date(a))===fmtDate(new Date(b));
const todayStr = () => fmtDate(new Date());
const parseMins = s => { if(!s) return 0; const [h,m]=s.split(":").map(Number); return h*60+(m||0); };
const fmtMins = m => { if(!m&&m!==0) return "—"; const h=Math.floor(Math.abs(m)/60),mn=Math.abs(m)%60; return h>0?(mn>0?`${h}h${mn}m`:`${h}h`):(mn+"m"); };
const fmtSecs = s => { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60; return h>0?`${pad(h)}:${pad(m)}:${pad(sc)}`:`${pad(m)}:${pad(sc)}`; };
const daysInMon =(y,m)=>new Date(y,m+1,0).getDate();
const WD = ["日","一","二","三","四","五","六"];
const WDF = ["周日","周一","周二","周三","周四","周五","周六"];
const MONTHS= ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];

/* ── holidays ── */
const HOLIDAYS = (() => {
  const h={};
  const add=(d,n)=>{ h[d]=h[d]?h[d]+" · "+n:n; };
  [["2025-01-01","元旦🎊"],["2025-01-28","春节🧧"],["2025-01-29","春节🧧"],["2025-01-30","春节🧧"],
   ["2025-01-31","春节🧧"],["2025-02-01","春节🧧"],["2025-02-02","春节🧧"],["2025-02-03","春节🧧"],
   ["2025-04-04","清明🌿"],["2025-04-05","清明🌿"],["2025-04-06","清明🌿"],
   ["2025-05-01","劳动节🌹"],["2025-05-02","劳动节🌹"],["2025-05-03","劳动节🌹"],["2025-05-04","劳动节🌹"],
   ["2025-05-31","端午🎋"],["2025-06-01","端午🎋"],["2025-06-02","端午🎋"],
   ["2025-10-01","国庆🇨🇳"],["2025-10-02","国庆🇨🇳"],["2025-10-03","国庆🇨🇳"],["2025-10-04","国庆🇨🇳"],
   ["2025-10-05","国庆🇨🇳"],["2025-10-06","国庆🇨🇳"],["2025-10-07","国庆🇨🇳"],["2025-10-08","国庆🇨🇳"],
   ["2026-01-01","元旦🎊"],["2026-02-17","春节🧧"],["2026-02-18","春节🧧"],["2026-02-19","春节🧧"],
   ["2026-02-20","春节🧧"],["2026-02-21","春节🧧"],["2026-02-22","春节🧧"],["2026-02-23","春节🧧"],
   ["2025-01-01","元日🎌"],["2025-01-13","成人の日🎓"],["2025-02-11","建国記念日📅"],["2025-02-23","天皇誕生日👑"],
   ["2025-03-20","春分の日🌸"],["2025-04-29","昭和の日"],["2025-05-03","憲法記念日"],["2025-05-04","みどりの日"],
   ["2025-05-05","こどもの日🎏"],["2025-07-21","海の日⛵"],["2025-08-11","山の日🏔"],["2025-09-15","敬老の日👴"],
   ["2025-09-23","秋分の日🍂"],["2025-10-13","スポーツの日"],["2025-11-03","文化の日"],["2025-11-23","勤労感謝の日"],
   ["2026-01-01","元日🎌"],["2026-01-12","成人の日🎓"],
  ].forEach(([d,n])=>add(d,n));
  return h;
})();

/* ── storage (Firebase Firestore + localStorage fallback) ── */
const _syncListeners = new Set();
let _syncStatus = "init";
function setSyncStatus(s){ _syncStatus=s; _syncListeners.forEach(fn=>fn(s)); }
function useSyncStatus(){ const [s,set]=useState(_syncStatus); useEffect(()=>{ set(_syncStatus); _syncListeners.add(set); return()=>_syncListeners.delete(set); },[]); return s; }

function useDebounce(fn, delay){
  const timerRef=useRef(null);
  const fnRef=useRef(fn);
  useEffect(()=>{ fnRef.current=fn; },[fn]);
  return useCallback((...args)=>{
    if(timerRef.current) clearTimeout(timerRef.current);
    timerRef.current=setTimeout(()=>{ fnRef.current(...args); },delay);
  },[delay]);
}

const USER_DOC = "shared_user";

function useFirestore(key, def) {
  const [v, set] = useState(() => {
    try { const s=localStorage.getItem(key); return s?JSON.parse(s):def; } catch { return def; }
  });
  const remoteReadRef = useRef(false);
  const localWriteRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key, v]);

  const writeToFirestore = useDebounce((val) => {
    setSyncStatus("saving");
    localWriteRef.current = true;
    setDoc(doc(db, "komu_data", USER_DOC), { [key]: JSON.stringify(val) }, { merge: true })
      .then(() => { setSyncStatus("ok"); })
      .catch(() => { setSyncStatus("error"); localWriteRef.current = false; });
  }, 800);

  useEffect(() => {
    setSyncStatus("init");
    const ref = doc(db, "komu_data", USER_DOC);
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const raw = snap.data()[key];
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            set(parsed);
            try { localStorage.setItem(key, raw); } catch {}
          } catch {}
        }
      }
      remoteReadRef.current = true;
      setSyncStatus("ok");
    }).catch(() => {
      remoteReadRef.current = true;
      setSyncStatus("error");
    });

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists() || !remoteReadRef.current) return;
      if (localWriteRef.current) { localWriteRef.current = false; return; }
      const raw = snap.data()[key];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          set(parsed);
          try { localStorage.setItem(key, raw); } catch {}
        } catch {}
      }
    }, () => { setSyncStatus("error"); });

    return () => unsub();
  }, [key]);

  const setAndSync = useCallback((updater) => {
    set(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (remoteReadRef.current) writeToFirestore(next);
      return next;
    });
  }, [writeToFirestore]);

  return [v, setAndSync];
}
const useStore = useFirestore;

/* ── default labels ── */
const DEF_LABELS=[
  {id:"sleep",name:"Sleep",emoji:"😴",color:"#7DC97B",keywords:["睡觉","sleep","午休","午睡"],children:[]},
  {id:"work",name:"Work",emoji:"💼",color:"#9E9E9E",keywords:["工作","会议","汇报","项目","加班"],children:[
    {id:"work_ot",name:"加班",emoji:"⏰",color:"#757575",keywords:["加班","overtime"]},
  ]},
  {id:"relax",name:"Relax",emoji:"😎",color:"#F5C842",keywords:["放松","看剧","游戏","电影","休闲"],children:[
    {id:"relax_show",name:"看剧",emoji:"📺",color:"#E8A500",keywords:["看剧","追剧","电视"]},
  ]},
  {id:"life",name:"日常",emoji:"🌤",color:"#E8A23A",keywords:["吃饭","午饭","晚饭","购物","打扫"],children:[]},
  {id:"health",name:"健康",emoji:"💚",color:"#4CAF85",keywords:["健身","运动","瑜伽","跑步","锻炼"],children:[]},
  {id:"study",name:"学习",emoji:"📚",color:"#4A90D9",keywords:["学习","读书","英语","日语","复习"],children:[]},
];

const makeSamples=()=>{
  const t=todayStr();const d=(n)=>fmtDate(addDays(new Date(),n));
  return [
    {id:uuid(),title:"🧘 晨间冥想",labelId:"health",autoTags:[],date:t,startTime:"07:00",endTime:"07:30",done:false},
    {id:uuid(),title:"💼 团队周会",labelId:"work",autoTags:[],date:t,startTime:"10:00",endTime:"11:00",done:false},
    {id:uuid(),title:"🍱 午饭",labelId:"life",autoTags:[],date:t,startTime:"12:30",endTime:"13:00",done:true},
    {id:uuid(),title:"📖 英语学习",labelId:"study",autoTags:[],date:t,startTime:"21:00",endTime:"22:00",done:false},
    {id:uuid(),title:"😴 Sleep",labelId:"sleep",autoTags:[],date:t,startTime:"23:00",endTime:"07:00",endDate:d(1),done:false},
    {id:uuid(),title:"🏃 晨跑",labelId:"health",autoTags:[],date:d(1),startTime:"06:30",endTime:"07:30",done:false},
    {id:uuid(),title:"📊 项目汇报",labelId:"work",autoTags:[],date:d(2),startTime:"14:00",endTime:"15:30",done:false},
    {id:uuid(),title:"🎬 看电影",labelId:"relax",autoTags:[],date:d(-1),startTime:"19:00",endTime:"21:00",done:true},
    {id:uuid(),title:"📚 读书",labelId:"study",autoTags:[],date:d(-2),startTime:"20:00",endTime:"21:30",done:true},
    {id:uuid(),title:"🛒 采购清单",labelId:"life",autoTags:[],date:t,done:false},
  ];
};

/* ── helpers ── */
function autoTag(ev,labels){
  const text=((ev.title||"")+" "+(ev.notes||"")).toLowerCase();
  const matched=[];
  labels.forEach(lb=>{
    (lb.keywords||[]).forEach(kw=>{if(kw&&text.includes(kw.toLowerCase())&&!matched.includes(lb.id))matched.push(lb.id);});
    (lb.children||[]).forEach(ch=>{(ch.keywords||[]).forEach(kw=>{if(kw&&text.includes(kw.toLowerCase())&&!matched.includes(ch.id))matched.push(ch.id);});});
  });
  return matched;
}

/* ── Cross-day aware occursOn ── */
function occursOn(ev,ds){
  if(ev.exceptions&&ev.exceptions.includes(ds)) return false;
  // Unscheduled tasks (no startTime, not allDay, no repeat) show on creation date and every day after
  if(!ev.allDay&&!ev.startTime&&(!ev.repeat||ev.repeat==="none")&&!ev.endDate){
    return ds>=ev.date;
  }
  if(ev.endDate&&ev.endDate!==ev.date){
    return ds>=ev.date&&ds<=ev.endDate;
  }
  if(!ev.repeat||ev.repeat==="none") return ev.date===ds;
  const base=new Date(ev.date),tgt=new Date(ds);
  if(tgt<base) return false;
  // respect repeat window
  const rStart=ev.repeatStart||ev.date;
  const rEnd=ev.repeatEnd||null;
  if(ds<rStart) return false;
  if(rEnd&&ds>rEnd) return false;
  if(ev.repeat==="daily") return true;
  if(ev.repeat==="weekly"){const dow=tgt.getDay();return ev.repeatDays?.length>0?ev.repeatDays.includes(dow):dow===base.getDay();}
  if(ev.repeat==="monthly") return tgt.getDate()===base.getDate();
  if(ev.repeat==="yearly") return tgt.getDate()===base.getDate()&&tgt.getMonth()===base.getMonth();
  return false;
}

const isUnscheduled=e=>!e.allDay&&!e.startTime&&(!e.repeat||e.repeat==="none")&&!e.endDate;
const getForDate=(evs,ds,{includeUnscheduled=true}={})=>evs.filter(e=>(!isUnscheduled(e)||includeUnscheduled)&&occursOn(e,ds));
const getDur=(ev)=>{if(ev.allDay||!ev.startTime||!ev.endTime)return 0;const d=parseMins(ev.endTime)-parseMins(ev.startTime);return d<=0?d+1440:d;};
// Returns whether an event is "done" for a specific date (handles repeat tasks with doneOverrides)
const isDoneOn=(ev,ds)=>{
  const isRepeat=ev.repeat&&ev.repeat!=="none";
  if(isRepeat) return !!(ev.doneOverrides&&ev.doneOverrides[ds]);
  return !!ev.done;
};
const flattenLabels=ls=>{const r=[];ls.forEach(l=>{r.push(l);(l.children||[]).forEach(c=>r.push({...c,_parent:l.id}));});return r;};
function useBP(){const [bp,set]=useState(()=>window.innerWidth<768?"phone":window.innerWidth<1100?"tablet":"desktop");useEffect(()=>{const h=()=>set(window.innerWidth<768?"phone":window.innerWidth<1100?"tablet":"desktop");window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);return bp;}

/* ── shared styles ── */
const INP={border:"1.5px solid #EBEBEB",borderRadius:10,padding:"8px 11px",fontSize:14,outline:"none",background:"white",color:"#111",WebkitTextFillColor:"#111"};
const PRESETS=["#7DC97B","#9E9E9E","#F5C842","#E8A23A","#4CAF85","#4A90D9","#E74C3C","#9B59B6","#1ABC9C","#E67E22","#FF6B9D","#34C759"];

/* ══════ CUSTOM SELECT (iPad/Mac safe) ══════ */
function CustomSelect({value, onChange, options, style={}}){
  const [open,setOpen]=useState(false);
  const ref=useRef();
  const chosen=options.find(o=>o.value===value)||options[0];
  useEffect(()=>{
    if(!open) return;
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h,true);
    document.addEventListener("touchstart",h,{passive:true,capture:true});
    return()=>{document.removeEventListener("mousedown",h,true);document.removeEventListener("touchstart",h,true);};
  },[open]);
  return <div ref={ref} style={{position:"relative",display:"inline-block",...style}}>
    <button onClick={e=>{e.stopPropagation();setOpen(p=>!p);}}
      style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px 4px 10px",border:"1.5px solid #e5e7eb",background:"white",fontSize:13,color:"#333",cursor:"pointer",borderRadius:8,whiteSpace:"nowrap",minWidth:72}}>
      <span style={{flex:1}}>{chosen?.label}</span>
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{flexShrink:0}}><path d="M1 1l4 4 4-4" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round"/></svg>
    </button>
    {open&&<div style={{position:"fixed",background:"white",borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:99999,minWidth:140,overflow:"hidden",border:"1px solid #ebebeb",top:"auto",right:"auto"}}
      ref={el=>{
        if(!el||!ref.current) return;
        const btn=ref.current.querySelector("button");
        if(!btn) return;
        const r=btn.getBoundingClientRect();
        el.style.top=(r.bottom+6)+"px";
        el.style.left=Math.max(8,r.right-el.offsetWidth)+"px";
      }}>
      {options.map((o,i)=><button key={o.value} onClick={()=>{onChange(o.value);setOpen(false);}}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"12px 16px",border:"none",borderTop:i>0?"1px solid #f5f5f5":"none",background:o.value===value?"#f5f5f5":"white",color:"#111",fontSize:14,cursor:"pointer",textAlign:"left",gap:10,whiteSpace:"nowrap"}}>
        <span>{o.label}</span>
        {o.value===value&&<svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l4 4 8-8" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>)}
    </div>}
  </div>;
}

/* ══════ COLOR PICKER ══════ */
function ColorPicker({value,onChange}){
  const [hex,setHex]=useState(value||"#4A90D9");
  const ok=h=>/^#[0-9A-Fa-f]{6}$/.test(h);
  return <div>
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
      {PRESETS.map(c=><div key={c} onClick={()=>{setHex(c);onChange(c);}} style={{width:22,height:22,borderRadius:6,background:c,cursor:"pointer",border:hex===c?"2.5px solid #333":"2px solid transparent"}}/>)}
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <div style={{width:26,height:26,borderRadius:6,background:ok(hex)?hex:"#ccc",border:"1px solid #eee"}}/>
      <input value={hex} onChange={e=>{setHex(e.target.value);if(ok(e.target.value))onChange(e.target.value);}} className="color-hex-input" style={{...INP,width:90,fontFamily:"monospace"}} placeholder="#000000"/>
    </div>
  </div>;
}

/* ══════ MODAL ══════ */
function Modal({title,onClose,children,width=440,hideHeader=false}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.36)",zIndex:3000,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <style>{`@media(min-height:600px) and (min-width:480px){.komu-modal-sheet{border-radius:22px!important;margin:16px!important;max-height:92vh!important;align-self:center!important;}}@media(max-width:479px){.komu-modal-sheet{max-height:95vh!important;}}`}</style>
    <div className="komu-modal-sheet" style={{background:"white",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:width,maxHeight:"88vh",overflowY:"auto",padding:"20px 20px max(28px,env(safe-area-inset-bottom))",boxShadow:"0 -4px 40px rgba(0,0,0,0.18)",flexShrink:0}}>
      {!hideHeader&&title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,paddingBottom:12,borderBottom:"1px solid #f2f2f2"}}>
        <span style={{fontSize:17,fontWeight:700,color:"#111"}}>{title}</span>
        <button onClick={onClose} style={{border:"none",background:"#f2f2f7",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14,color:"#666",textAlign:"center"}}>✕</button>
      </div>}
      {children}
    </div>
  </div>;
}

/* ══════ TIME SCROLL PICKER ══════ */
function TimeScrollPicker({value, onChange, label, compact}){
  const [h,m] = value ? value.split(":").map(Number) : [9,0];
  const hourRef = useRef();
  const minRef = useRef();
  const hours = Array.from({length:24},(_,i)=>i);
  const mins = Array.from({length:12},(_,i)=>i*5);
  const ITEM_H = compact ? 28 : 36;

  useEffect(()=>{
    if(hourRef.current) hourRef.current.scrollTop = h * ITEM_H;
    if(minRef.current) minRef.current.scrollTop = Math.floor(m/5) * ITEM_H;
  },[]);

  const onHourScroll = e => {
    const idx = Math.round(e.target.scrollTop / ITEM_H);
    const newH = Math.min(23, Math.max(0, idx));
    onChange(`${pad(newH)}:${pad(m)}`);
  };
  const onMinScroll = e => {
    const idx = Math.round(e.target.scrollTop / ITEM_H);
    const newM = (Math.min(11, Math.max(0, idx))) * 5;
    onChange(`${pad(h)}:${pad(newM)}`);
  };

  const scrollStyle = {height: ITEM_H*3, overflowY:"scroll", scrollSnapType:"y mandatory", scrollbarWidth:"none", msOverflowStyle:"none"};
  const itemStyle = (selected) => ({
    height: ITEM_H, display:"flex", alignItems:"center", justifyContent:"center",
    scrollSnapAlign:"center", fontSize: compact ? (selected?14:11) : (selected ? 18 : 14),
    fontWeight: selected ? 700 : 400, color: selected ? "#111" : "#c0c0c0",
    cursor:"pointer", transition:"all 0.1s", flexShrink:0,
  });
  const itemClass = (selected) => selected ? "time-picker-selected" : "time-picker-unselected";

  if(compact){
    return <div style={{display:"flex",alignItems:"center",gap:0,background:"#f0f0f0",borderRadius:10,padding:"0 4px",position:"relative"}}>
      <div style={{position:"absolute",left:0,right:0,top:"50%",transform:"translateY(-50%)",height:ITEM_H,background:"rgba(0,0,0,0.07)",borderRadius:6,pointerEvents:"none",zIndex:1}}/>
      <div ref={hourRef} onScroll={onHourScroll} style={{...scrollStyle,width:38}}>
        <div style={{height:ITEM_H}}/>
        {hours.map(hv=><div key={hv} style={itemStyle(hv===h)} onClick={()=>{if(hourRef.current)hourRef.current.scrollTop=hv*ITEM_H;onChange(`${pad(hv)}:${pad(m)}`);}}>{pad(hv)}</div>)}
        <div style={{height:ITEM_H}}/>
      </div>
      <div style={{fontSize:14,fontWeight:700,color:"#555",padding:"0 2px",zIndex:2}}>:</div>
      <div ref={minRef} onScroll={onMinScroll} style={{...scrollStyle,width:38}}>
        <div style={{height:ITEM_H}}/>
        {mins.map(mv=><div key={mv} style={itemStyle(mv===m||mv===Math.floor(m/5)*5)} onClick={()=>{if(minRef.current)minRef.current.scrollTop=Math.floor(mv/5)*ITEM_H;onChange(`${pad(h)}:${pad(mv)}`);}}>{pad(mv)}</div>)}
        <div style={{height:ITEM_H}}/>
      </div>
    </div>;
  }

  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}} className="time-scroll-picker">
    {label && <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:4}}>{label}</div>}
    <div style={{display:"flex",alignItems:"center",gap:0,background:"#f8f8f8",borderRadius:14,padding:"0 8px",position:"relative"}}>
      {/* selection band */}
      <div style={{position:"absolute",left:0,right:0,top:"50%",transform:"translateY(-50%)",height:ITEM_H,background:"rgba(0,0,0,0.06)",borderRadius:8,pointerEvents:"none",zIndex:1}}/>
      <div ref={hourRef} onScroll={onHourScroll} style={{...scrollStyle,width:56}}>
        <div style={{height:ITEM_H}}/>
        {hours.map(hv=><div key={hv} className={itemClass(hv===h)} style={itemStyle(hv===h)} onClick={()=>{if(hourRef.current)hourRef.current.scrollTop=hv*ITEM_H;onChange(`${pad(hv)}:${pad(m)}`);}}>{pad(hv)}</div>)}
        <div style={{height:ITEM_H}}/>
      </div>
      <div style={{fontSize:20,fontWeight:700,color:"#555",padding:"0 4px",zIndex:2}}>:</div>
      <div ref={minRef} onScroll={onMinScroll} style={{...scrollStyle,width:56}}>
        <div style={{height:ITEM_H}}/>
        {mins.map(mv=><div key={mv} className={itemClass(mv===m||mv===Math.floor(m/5)*5)} style={itemStyle(mv===m||mv===Math.floor(m/5)*5)} onClick={()=>{if(minRef.current)minRef.current.scrollTop=Math.floor(mv/5)*ITEM_H;onChange(`${pad(h)}:${pad(mv)}`);}}>{pad(mv)}</div>)}
        <div style={{height:ITEM_H}}/>
      </div>
    </div>
    <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}@media(min-width:768px){.time-scroll-picker .time-picker-selected{font-size:13px!important;}.time-scroll-picker .time-picker-unselected{font-size:10px!important;}}`}</style>
  </div>;
}

/* ══════ LABEL MANAGER ══════ */
function LabelManager({labels,onSave,initialLabelId}){
  const [list,setList]=useState(()=>labels.map(l=>({...l,children:(l.children||[]).map(c=>({...c}))})));
  const [ed,setEd]=useState(null);
  const [ced,setCed]=useState(null);
  const [selLabel,setSelLabel]=useState(initialLabelId||null); // selected label for detail view
  // syncList: persist labels to parent WITHOUT closing modal
  const syncList=(next)=>{onSave(next,/*noClose=*/true);};

  // Drag-sort state
  const dragSrc=useRef(null);
  const [dragOver,setDragOver]=useState(null);

  const handleDragStart=(e,idx,parentId)=>{dragSrc.current={idx,parentId};e.dataTransfer.effectAllowed="move";};
  const handleDragOver=(e,idx,parentId)=>{e.preventDefault();if(dragSrc.current&&dragSrc.current.parentId===parentId&&dragSrc.current.idx!==idx)setDragOver({idx,parentId});};
  const handleDrop=(e,idx,parentId)=>{
    e.preventDefault();
    if(!dragSrc.current||dragSrc.current.parentId!==parentId){setDragOver(null);return;}
    const from=dragSrc.current.idx;
    if(from===idx){setDragOver(null);return;}
    if(!parentId){
      const next=[...list];const [item]=next.splice(from,1);next.splice(idx,0,item);
      setList(next);syncList(next);
    } else {
      const next=list.map(l=>{
        if(l.id!==parentId) return l;
        const ch=[...(l.children||[])];const [item]=ch.splice(from,1);ch.splice(idx,0,item);
        return {...l,children:ch};
      });
      setList(next);syncList(next);
    }
    setDragOver(null);dragSrc.current=null;
  };
  const handleDragEnd=()=>{setDragOver(null);dragSrc.current=null;};

  // Long-press for touch drag-sort
  const touchDrag=useRef({active:false,src:null,parentId:null,timer:null,startY:0,items:null,ghost:null});
  const handleTouchStart=(e,idx,parentId,itemsGetter)=>{
    const touch=e.touches[0];
    // Prevent text selection during long-press drag
    e.currentTarget.style.userSelect="none";
    e.currentTarget.style.webkitUserSelect="none";
    touchDrag.current.timer=setTimeout(()=>{
      touchDrag.current.active=true;
      touchDrag.current.src=idx;
      touchDrag.current.parentId=parentId;
      touchDrag.current.startY=touch.clientY;
      touchDrag.current.items=itemsGetter();
      setDragOver({idx,parentId});
      if(navigator.vibrate) navigator.vibrate(30);
    },400);
    touchDrag.current.startY=touch.clientY;
  };
  const handleTouchMove=(e,parentId)=>{
    if(!touchDrag.current.active) return;
    e.preventDefault();
    const touch=e.touches[0];
    const el=document.elementFromPoint(touch.clientX,touch.clientY);
    const row=el?.closest('[data-sortable-idx]');
    if(row){
      const overIdx=parseInt(row.dataset.sortableIdx,10);
      const overParent=row.dataset.sortableParent||null;
      if(overParent===parentId&&overIdx!==touchDrag.current.src) setDragOver({idx:overIdx,parentId});
    }
  };
  const handleTouchEnd=(e,parentId)=>{
    clearTimeout(touchDrag.current.timer);
    e.currentTarget.style.userSelect="";
    e.currentTarget.style.webkitUserSelect="";
    if(!touchDrag.current.active){touchDrag.current={active:false,src:null,parentId:null,timer:null,startY:0,items:null,ghost:null};return;}
    const from=touchDrag.current.src;
    const to=dragOver?.parentId===parentId?dragOver.idx:from;
    if(from!==to){
      if(!parentId){
        const next=[...list];const [item]=next.splice(from,1);next.splice(to,0,item);
        setList(next);syncList(next);
      } else {
        const next=list.map(l=>{
          if(l.id!==parentId) return l;
          const ch=[...(l.children||[])];const [item]=ch.splice(from,1);ch.splice(to,0,item);
          return {...l,children:ch};
        });
        setList(next);syncList(next);
      }
    }
    touchDrag.current={active:false,src:null,parentId:null,timer:null,startY:0,items:null,ghost:null};
    setDragOver(null);
  };

  // Compute preview list during drag
  const previewList=useMemo(()=>{
    if(!dragOver||dragSrc.current==null) return null;
    const from=dragSrc.current.idx;
    const to=dragOver.idx;
    const parentId=dragOver.parentId;
    if(parentId===null){
      if(from===to) return null;
      const next=[...list];const [item]=next.splice(from,1);next.splice(to,0,item);
      return next;
    } else {
      const parentLb=list.find(l=>l.id===parentId);
      if(!parentLb||from===to) return null;
      const ch=[...(parentLb.children||[])];const [item]=ch.splice(from,1);ch.splice(to,0,item);
      return list.map(l=>l.id===parentId?{...l,children:ch}:l);
    }
  },[dragOver,list]);
  const displayList=previewList||list;

  const Form=({data,setData,title:t,onOk,onCancel,onDelete})=>{
    // Use uncontrolled refs to avoid IME/emoji input bugs
    const emojiRef=useRef();
    const nameRef=useRef();
    const kwRef=useRef();
    // Sync ref values when data changes externally (e.g. new form opened)
    useEffect(()=>{if(emojiRef.current)emojiRef.current.value=data.emoji||"";},[data.id]);
    useEffect(()=>{if(nameRef.current)nameRef.current.value=data.name||"";},[data.id]);
    useEffect(()=>{if(kwRef.current)kwRef.current.value=(data.keywords||[]).join("，");},[data.id]);
    const flush=()=>{
      setData(p=>({
        ...p,
        emoji:emojiRef.current?emojiRef.current.value:p.emoji,
        name:nameRef.current?nameRef.current.value:p.name,
        keywords:kwRef.current?kwRef.current.value.split(/[，,]/).map(s=>s.trim()).filter(Boolean):p.keywords,
      }));
    };
    const getLatest=()=>({
      emoji:emojiRef.current?emojiRef.current.value:data.emoji,
      name:nameRef.current?nameRef.current.value:data.name,
      keywords:kwRef.current?kwRef.current.value.split(/[，,]/).map(s=>s.trim()).filter(Boolean):data.keywords,
    });
    return <div style={{background:"#f8f8f8",borderRadius:14,padding:"14px 16px",marginTop:10}}>
      <div style={{fontSize:13,fontWeight:700,color:"#555",marginBottom:10}}>{t}</div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input
          ref={emojiRef}
          defaultValue={data.emoji||""}
          placeholder="🏷"
          className="label-edit-input"
          style={{...INP,width:54,fontSize:22,textAlign:"center",padding:"4px 6px"}}
          title="输入表情符号"
        />
        <input
          ref={nameRef}
          defaultValue={data.name||""}
          placeholder="标签名称"
          className="label-edit-input"
          style={{...INP,flex:1}}
        />
      </div>
      <ColorPicker value={data.color} onChange={c=>setData(p=>({...p,color:c}))}/>
      <div style={{marginTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:5}}>自动分类关键词（顿号分隔）</div>
        <input
          ref={kwRef}
          defaultValue={(data.keywords||[]).join("，")}
          placeholder="关键词1，关键词2"
          className="label-edit-input"
          style={{...INP,width:"100%"}}
        />
        <div style={{fontSize:11,color:"#aaa",marginTop:3}}>检测到关键词时自动打标签</div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button onClick={onCancel} style={{flex:1,padding:"8px",border:"1.5px solid #e5e7eb",borderRadius:10,background:"white",cursor:"pointer",fontSize:13,textAlign:"center"}}>取消</button>
        {onDelete&&<button onClick={onDelete} style={{padding:"8px 14px",border:"none",borderRadius:10,background:"#FFF0F0",color:"#FF3B30",cursor:"pointer",fontSize:13,fontWeight:600,textAlign:"center"}}>删除</button>}
        <button onClick={()=>{const latest=getLatest();setData(p=>({...p,...latest}));onOk(latest);}} style={{flex:2,padding:"8px",border:"none",borderRadius:10,background:"#333",color:"white",cursor:"pointer",fontSize:13,fontWeight:600,textAlign:"center"}}>保存</button>
      </div>
    </div>;
  };

  // If a label is selected, show detail view with inline edit form like children
  if(selLabel){
    const lb = list.find(l=>l.id===selLabel);
    if(!lb) { setSelLabel(null); return null; }
    return <div>
      <button onClick={()=>{setSelLabel(null);setEd(null);}} style={{border:"none",background:"none",color:"#555",fontSize:13,cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",gap:4}}>‹ 返回</button>
      <div onClick={()=>{ if(!ed||ed.id!==lb.id) setEd({...lb,children:[...(lb.children||[])],isNew:false}); else setEd(null); setCed(null); }}
        style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:ed?.id===lb.id?"#f0f7ff":"#f8f8f8",borderRadius:12,cursor:"pointer",marginBottom:4,border:ed?.id===lb.id?"1.5px solid #555":"1.5px solid transparent"}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:lb.color}}/>
        <span style={{fontSize:20}}>{lb.emoji}</span>
        <span style={{fontSize:15,fontWeight:700,flex:1}}>{lb.name}</span>
        <span style={{fontSize:14,color:"#c0c0c0"}}>{ed?.id===lb.id?"▲":"▼"}</span>
      </div>
      {ed?.id===lb.id&&<Form data={ed} setData={setEd} title="编辑标签"
        onCancel={()=>setEd(null)}
        onDelete={()=>{const updated=list.filter(x=>x.id!==lb.id);setList(updated);syncList(updated);setEd(null);setSelLabel(null);}}
        onOk={(latest)=>{const updated=list.map(x=>x.id===lb.id?{...ed,...latest}:x);setList(updated);syncList(updated);setEd(null);setSelLabel(null);}}/>}
      <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:8}}>子标签</div>
      {(()=>{
        const displayLb=displayList.find(x=>x.id===lb.id)||lb;
        return (displayLb.children||[]).map((c,cidx)=><div key={c.id}
        draggable
        data-sortable-idx={cidx}
        data-sortable-parent={lb.id}
        onDragStart={e=>handleDragStart(e,cidx,lb.id)}
        onDragOver={e=>handleDragOver(e,cidx,lb.id)}
        onDrop={e=>handleDrop(e,cidx,lb.id)}
        onDragEnd={handleDragEnd}
        onTouchStart={e=>handleTouchStart(e,cidx,lb.id,()=>lb.children||[])}
        onTouchMove={e=>handleTouchMove(e,lb.id)}
        onTouchEnd={e=>handleTouchEnd(e,lb.id)}
        style={{opacity:dragOver?.parentId===lb.id&&dragSrc.current?.idx===cidx&&!previewList?0.4:1,transition:"opacity 0.15s",borderRadius:10,marginBottom:4,outline:dragOver?.parentId===lb.id&&dragOver?.idx===cidx&&dragSrc.current?.idx!==cidx?"2px solid #007AFF":"none"}}>
        <div onClick={()=>{ setCed({parentId:lb.id,child:{...c},isNew:false}); setEd(null); }}
          style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:ced?.child?.id===c.id?"#f0f7ff":"#f8f8f8",borderRadius:10,cursor:"pointer",border:ced?.child?.id===c.id?"1.5px solid #555":"1.5px solid transparent"}}>
          <span style={{fontSize:12,color:"#c0c0c0",cursor:"grab",touchAction:"none"}}>⠿</span>
          <div style={{width:8,height:8,borderRadius:"50%",background:c.color||lb.color}}/>
          <span style={{fontSize:13,flex:1}}>{c.emoji} {c.name}</span>
        </div>
        {ced?.parentId===lb.id&&ced?.child?.id===c.id&&<Form data={ced.child} setData={d=>setCed(p=>({...p,child:typeof d==="function"?d(p.child):d}))} title="编辑子标签"
          onCancel={()=>setCed(null)}
          onDelete={()=>{const updated=list.map(x=>x.id===lb.id?{...x,children:(x.children||[]).filter(ch=>ch.id!==c.id)}:x);setList(updated);syncList(updated);setCed(null);}}
          onOk={(latest)=>{const updated=list.map(x=>x.id===lb.id?{...x,children:(x.children||[]).map(ch=>ch.id===ced.child.id?{...ced.child,...latest}:ch)}:x);setList(updated);syncList(updated);setCed(null);}}/>}
      </div>)})()}
      <button onClick={()=>{setCed({parentId:lb.id,child:{id:uuid(),name:"",emoji:"🏷",color:lb.color,keywords:[]},isNew:true});setEd(null);}} style={{fontSize:12,color:"#555",border:"1.5px solid #e5e7eb",background:"white",cursor:"pointer",padding:"7px 14px",borderRadius:10,marginTop:6}}>+ 添加子标签</button>
      {ced?.isNew&&ced?.parentId===lb.id&&<Form data={ced.child} setData={d=>setCed(p=>({...p,child:typeof d==="function"?d(p.child):d}))} title="新建子标签"
        onCancel={()=>setCed(null)}
        onOk={(latest)=>{const updated=list.map(x=>x.id===lb.id?{...x,children:[...(x.children||[]),{...ced.child,...latest}]}:x);setList(updated);syncList(updated);setCed(null);}}/>}
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button onClick={()=>onSave(list)} style={{flex:1,padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontSize:13,fontWeight:700,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>完成</button>
      </div>
    </div>;
  }

  return <div>
    {displayList.map((l,idx)=><div key={l.id}
      draggable
      data-sortable-idx={idx}
      data-sortable-parent=""
      onDragStart={e=>handleDragStart(e,idx,null)}
      onDragOver={e=>handleDragOver(e,idx,null)}
      onDrop={e=>handleDrop(e,idx,null)}
      onDragEnd={handleDragEnd}
      onTouchStart={e=>handleTouchStart(e,idx,null,()=>list)}
      onTouchMove={e=>handleTouchMove(e,null)}
      onTouchEnd={e=>handleTouchEnd(e,null)}
      style={{marginBottom:4,opacity:dragSrc.current===idx&&!previewList?0.4:1,transition:"opacity 0.15s,transform 0.15s",borderRadius:12,outline:dragOver?.parentId===null&&dragOver?.idx===idx&&dragSrc.current?.idx!==idx?"2px solid #007AFF":"none"}}>
        <div
          onClick={()=>{ setSelLabel(l.id); setEd(null); setCed(null); }}
          style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#f8f8f8",borderRadius:12,cursor:"pointer",border:"1.5px solid transparent",transition:"all 0.15s"}}
        >
          <span style={{fontSize:13,color:"#c0c0c0",marginRight:2,cursor:"grab",touchAction:"none"}}>⠿</span>
          <div style={{width:9,height:9,borderRadius:"50%",background:l.color,flexShrink:0}}/>
          <span style={{fontSize:16,marginRight:2}}>{l.emoji}</span>
          <span style={{flex:1,fontSize:13,fontWeight:600}}>{l.name}</span>
          {(l.children||[]).length>0&&<span style={{fontSize:11,color:"#aaa"}}>{l.children.length}个子标签</span>}
          <span style={{fontSize:14,color:"#c0c0c0"}}>›</span>
        </div>
      </div>)}
    {!ed&&<div style={{display:"flex",gap:10,marginTop:8}}>
      <button onClick={()=>{setEd({id:uuid(),name:"",emoji:"🏷",color:"#4A90D9",keywords:[],children:[],isNew:true});setCed(null);}} style={{flex:1,padding:"10px",border:"1.5px solid #555",borderRadius:12,background:"white",color:"#333",cursor:"pointer",fontSize:13,fontWeight:600,textAlign:"center"}}>+ 新建标签</button>
      <button onClick={()=>onSave(list)} style={{flex:1,padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontSize:13,fontWeight:700,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>完成</button>
    </div>}
    {ed?.isNew&&<Form data={ed} setData={setEd} title="新建标签"
      onCancel={()=>setEd(null)}
      onOk={(latest)=>{const updated=[...list,{...ed,...latest}];setList(updated);syncList(updated);setEd(null);}}/>}
  </div>;
}

/* ══════ PUSH NOTIFICATION OPTIONS ══════ */
function NotifPicker({value, onChange}){
  const [perm, askPerm] = useNotifPermission();
  const v = value || {onStart:false, onEnd:false, startMins:15, endMins:0};
  const MINS_OPTS = [
    {label:"准时", value:0},
    {label:"提前5分钟", value:5},
    {label:"提前10分钟", value:10},
    {label:"提前15分钟", value:15},
    {label:"提前30分钟", value:30},
    {label:"提前1小时", value:60},
  ];
  const toggle = async (k) => {
    // If turning on a notif, ensure permission is granted first
    if (!v[k] && perm !== "granted") {
      const p = await askPerm();
      if (p !== "granted") return;
    }
    onChange({...v, [k]: !v[k]});
  };
  const Tog = ({label, k, children}) => <div style={{padding:"9px 0"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontSize:13,color:"#333"}}>{label}</span>
      <div onClick={()=>toggle(k)} style={{width:40,height:22,borderRadius:11,background:v[k]?"#333":"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:v[k]?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
      </div>
    </div>
    {v[k] && children && <div style={{marginTop:7}}>{children}</div>}
  </div>;
  const MinsRow = ({field, val}) => <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
    {MINS_OPTS.map(o=><button key={o.value} onClick={()=>onChange({...v,[field]:o.value})}
      style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid",borderColor:val===o.value?"#333":"#e5e7eb",background:val===o.value?"#333":"white",color:val===o.value?"white":"#555",fontSize:11,cursor:"pointer",fontWeight:val===o.value?700:400}}>
      {o.label}
    </button>)}
  </div>;
  return <div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",padding:"4px 14px"}}>
    <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",padding:"8px 0 4px",display:"flex",alignItems:"center",gap:6}}>
      推送通知
      {perm==="denied"&&<span style={{fontSize:10,color:"#FF3B30",fontWeight:400}}>· 系统已禁止，请在设置中开启</span>}
    </div>
    <Tog label="任务开始时通知" k="onStart">
      <MinsRow field="startMins" val={v.startMins??15}/>
    </Tog>
    <div style={{height:1,background:"#f0f0f0"}}/>
    <Tog label="任务结束时通知" k="onEnd">
      <MinsRow field="endMins" val={v.endMins??0}/>
    </Tog>
  </div>;
}

/* ══════ INLINE REPEAT DELETE (Modal popup) ══════ */
function InlineRepeatDelete({onRepeatDelete,open,onClose,title:sheetTitle,opts:customOpts}){
  const opts=customOpts||[
    {key:"this",label:"仅删除当前任务",danger:false,defaultSelected:true},
    {key:"before",label:"删除包括以前的全部任务",danger:false},
    {key:"after",label:"删除以后的所有任务（含当天）",danger:false},
    {key:"all",label:"删除所有任务",danger:true},
  ];
  if(!open) return null;
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.36)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:"white",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:440,padding:"20px 0 calc(max(20px,env(safe-area-inset-bottom)))",boxShadow:"0 -4px 40px rgba(0,0,0,0.18)"}}>
      <div style={{fontSize:15,fontWeight:700,color:"#111",padding:"0 20px 14px",borderBottom:"1px solid #f5f5f5"}}>{sheetTitle||"循环任务"}</div>
      {opts.map((o,i)=><button key={o.key} onClick={()=>{onClose();onRepeatDelete(o.key);}}
        style={{display:"flex",alignItems:"center",width:"100%",padding:"15px 20px",border:"none",borderTop:i>0?"1px solid #f5f5f5":"none",background:"white",color:o.danger?"#FF3B30":"#111",fontSize:15,cursor:"pointer",textAlign:"left"}}>
        <span style={{flex:1}}>{o.label}</span>
      </button>)}
      <div style={{borderTop:"8px solid #f2f2f7",marginTop:4}}>
        <button onClick={onClose} style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",padding:"15px 20px",border:"none",background:"white",color:"#8e8e93",fontSize:15,cursor:"pointer",fontWeight:600}}>取消</button>
      </div>
    </div>
  </div>;
}

/* ══════ EVENT FORM ══════ */
function EventForm({ev,instanceDate,labels,onSave,onDelete,onRepeatDelete,onClose,initialDate,initialHour}){
  const isNew=!ev;
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const dh=initialHour!=null?initialHour:9;
  // For repeat tasks opened from a non-original date, show that date in the form
  const displayDate=ev?.repeat&&ev.repeat!=="none"&&instanceDate?instanceDate:(ev?.date||initialDate||todayStr());
  const [form,setForm]=useState(()=>ev?{...ev,date:displayDate}:{id:uuid(),title:"",labelId:labels[0]?.id||"",autoTags:[],date:initialDate||todayStr(),startTime:null,endTime:null,allDay:false,repeat:"none",repeatDays:[],notes:"",timerSecs:0,done:false,notif:{onStart:false,onEnd:false}});
  const [tab,setTab]=useState(ev?._openTab||"info");
  const [running,setRunning]=useState(false);
  const [elapsed,setElapsed]=useState(form.timerSecs||0);
  const [hasTime,setHasTime]=useState(!!(ev?.startTime));
  const [labelLocked,setLabelLocked]=useState(!!ev); // manual selection locks auto-detect
  const [timerApplied,setTimerApplied]=useState(false);
  const [showRepeatDel,setShowRepeatDel]=useState(false);
  const [showRepeatSave,setShowRepeatSave]=useState(false);
  const [pendingSave,setPendingSave]=useState(null);
  const [openPicker,setOpenPicker]=useState(null); // "start" | "end" | null
  const timer=useRef();
  useEffect(()=>{if(running)timer.current=setInterval(()=>setElapsed(p=>p+1),1000);else clearInterval(timer.current);return()=>clearInterval(timer.current);},[running]);

  // Auto-tag + auto-label from title (new tasks only, unless user manually picked a label)
  useEffect(()=>{
    const tags=autoTag(form,labels);
    if(isNew&&!labelLocked&&tags.length>0){
      // Prefer child label over parent; pick first matched
      const childMatch=tags.find(tid=>flat.some(l=>l._parent&&l.id===tid));
      const bestId=childMatch||tags[0];
      setForm(p=>({...p,autoTags:tags,labelId:bestId}));
    } else {
      setForm(p=>({...p,autoTags:tags}));
    }
  },[form.title,form.notes]);
  const lb=flat.find(l=>l.id===form.labelId)||{color:"#007AFF",emoji:"📌"};
  const dur=!form.allDay&&form.startTime&&form.endTime?getDur(form):0;

  const T=({t,n})=><button onClick={()=>setTab(t)} style={{flex:1,padding:"7px",border:"none",borderRadius:8,background:tab===t?"white":"transparent",fontWeight:tab===t?700:400,fontSize:13,cursor:"pointer",color:tab===t?"#111":"#8e8e93",boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.08)":"",textAlign:"center"}}>{n}</button>;
  // Row: label 54px left, then content fills remaining space, children left-aligned by default
  const Row=({label:l,children,sep,rightAlign})=><div style={{display:"flex",alignItems:"center",padding:"9px 14px",borderBottom:sep?"1px solid #f5f5f5":"none"}}><span style={{fontSize:12,color:"#8e8e93",width:54,flexShrink:0}}>{l}</span><div style={{flex:1,display:"flex",justifyContent:rightAlign?"flex-end":"flex-start"}}>{children}</div></div>;

  const stopAndApply=()=>{
    setRunning(false);
    if(elapsed<=0) return;
    const elapsedMins=Math.max(1,Math.round(elapsed/60));
    let startM;
    if(form.startTime){
      startM=parseMins(form.startTime);
    } else {
      // No start time set — derive from current time minus elapsed
      const now=new Date();
      const nowM=now.getHours()*60+now.getMinutes();
      startM=((nowM-elapsedMins)+1440)%1440;
      const newStart=`${pad(Math.floor(startM/60))}:${pad(startM%60)}`;
      setHasTime(true);
      setForm(p=>({...p,startTime:newStart}));
    }
    const endM=(startM+elapsedMins)%1440;
    const newEnd=`${pad(Math.floor(endM/60))}:${pad(endM%60)}`;
    setForm(p=>({...p,endTime:newEnd,timerSecs:elapsed}));
    setTimerApplied(true);
  };

  // Handle hasTime toggle
  const toggleHasTime = () => {
    const next = !hasTime;
    setHasTime(next);
    if(next) {
      setForm(p=>({...p, startTime:`${pad(dh)}:00`, endTime:`${pad(dh+1)}:00`, allDay:false}));
    } else {
      setForm(p=>({...p, startTime:null, endTime:null, allDay:false}));
    }
  };

  // Styled date input
  const DateInput = ({label:lbl, value, onChange}) => (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <div style={{fontSize:11,fontWeight:700,color:"#8e8e93"}}>{lbl}</div>
      <input type="date" value={value} onChange={e=>onChange(e.target.value)}
        style={{...INP,fontSize:13,background:"white",border:"1.5px solid #e5e7eb",borderRadius:10}}/>
    </div>
  );

  const [showLabelPicker,setShowLabelPicker]=useState(false);

  return <div>
    {/* Title row with label emoji as clickable icon */}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
      <button onClick={()=>setShowLabelPicker(p=>!p)} style={{width:36,height:36,borderRadius:10,border:`2px solid ${lb.color}`,background:lb.color+"22",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="选择标签">
        {lb.emoji}
      </button>
      <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="事项名称…" style={{...INP,flex:1,fontSize:15,fontWeight:600,border:"none",padding:"4px 0",borderBottom:"2px solid #f0f0f0",borderRadius:0,color:"#111"}}/>
    </div>
    {showLabelPicker&&<div style={{background:"#f8f8f8",borderRadius:12,padding:"10px 12px",marginBottom:12,border:"1px solid #f0f0f0"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:8}}>选择标签</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {flat.map(l=><button key={l.id} onClick={()=>{setForm(p=>({...p,labelId:l.id}));setLabelLocked(true);setShowLabelPicker(false);}} style={{padding:"5px 10px",border:"none",borderRadius:20,background:form.labelId===l.id?l.color+(l.color.length===7?"dd":""):("#f0f0f0"),color:form.labelId===l.id?"white":"#555",cursor:"pointer",fontSize:12,fontWeight:form.labelId===l.id?700:400,textAlign:"center"}}>
          {l._parent&&<span style={{fontSize:10,color:form.labelId===l.id?"rgba(255,255,255,0.7)":"#aaa"}}>#</span>}{l.emoji} {l.name}
        </button>)}
      </div>
    </div>}
    {dur>0&&<div style={{background:"#f2f2f7",borderRadius:8,padding:"5px 12px",marginBottom:10,fontSize:12,color:"#555",fontWeight:700}}>⏱ {fmtMins(dur)}</div>}
    <div style={{display:"flex",background:"#f2f2f7",borderRadius:10,padding:2,gap:2,marginBottom:14}}>
      <T t="info" n="信息"/><T t="timer" n="计时"/>
    </div>

    {tab==="info"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",overflow:"hidden"}}>
        {!form.allDay&&<Row label="安排时间" sep={hasTime||false} rightAlign>
          <div onClick={toggleHasTime} style={{width:40,height:22,borderRadius:11,background:hasTime?"#555":"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
            <div style={{position:"absolute",top:2,left:hasTime?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
          </div>
        </Row>}
        {hasTime&&<Row label="全天" sep rightAlign>
          <div onClick={()=>setForm(p=>({...p,allDay:!p.allDay}))} style={{width:40,height:22,borderRadius:11,background:form.allDay?"#555":"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
            <div style={{position:"absolute",top:2,left:form.allDay?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
          </div>
        </Row>}
        {hasTime&&<>
          <div style={{display:"flex",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid #f5f5f5"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:54,flexShrink:0}}>开始日期</span>
            <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
              className="form-date-input" style={{...INP,border:"none",padding:0,background:"transparent",fontSize:13}}/>
            {!form.allDay&&<button onClick={()=>setOpenPicker(p=>p==="start"?null:"start")}
              style={{marginLeft:"auto",border:"none",background:openPicker==="start"?"#e8e8e8":"#f2f2f7",borderRadius:8,padding:"4px 10px",fontSize:13,fontWeight:700,color:"#333",cursor:"pointer",flexShrink:0,minWidth:52,textAlign:"center"}}>
              {form.startTime||"09:00"}
            </button>}
          </div>
          {openPicker==="start"&&!form.allDay&&<div style={{padding:"12px 14px",borderBottom:"1px solid #f5f5f5",background:"#fafafa",display:"flex",justifyContent:"center"}}>
            <TimeScrollPicker value={form.startTime||"09:00"} onChange={v=>setForm(p=>({...p,startTime:v}))}/>
          </div>}
          <div style={{display:"flex",alignItems:"center",padding:"9px 14px"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:54,flexShrink:0}}>结束日期</span>
            <input type="date" value={form.endDate||form.date} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}
              className="form-date-input" style={{...INP,border:"none",padding:0,background:"transparent",fontSize:13}}/>
            {!form.allDay&&<button onClick={()=>setOpenPicker(p=>p==="end"?null:"end")}
              style={{marginLeft:"auto",border:"none",background:openPicker==="end"?"#e8e8e8":"#f2f2f7",borderRadius:8,padding:"4px 10px",fontSize:13,fontWeight:700,color:"#333",cursor:"pointer",flexShrink:0,minWidth:52,textAlign:"center"}}>
              {form.endTime||"10:00"}
            </button>}
          </div>
          {openPicker==="end"&&!form.allDay&&<div style={{padding:"12px 14px",background:"#fafafa",display:"flex",justifyContent:"center"}}>
            <TimeScrollPicker value={form.endTime||"10:00"} onChange={v=>setForm(p=>({...p,endTime:v}))}/>
          </div>}
        </>}
      </div>

      {form.autoTags?.length>0&&<div>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:5}}>Tags（自动）</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {form.autoTags.map(tid=>{const l=flat.find(x=>x.id===tid);return l?<span key={tid} style={{fontSize:11,background:l.color+"22",color:l.color,borderRadius:20,padding:"3px 8px",fontWeight:600}}>{l.emoji} {l.name}</span>:null;})}
        </div>
      </div>}

      <div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderBottom:(form.repeat&&form.repeat!=="none")?"1px solid #f5f5f5":"none"}}>
          <span style={{fontSize:13,color:"#555"}}>重复</span>
          <CustomSelect value={form.repeat} onChange={v=>setForm(p=>({...p,repeat:v}))} options={[{value:"none",label:"不重复"},{value:"daily",label:"每天"},{value:"weekly",label:"每周"},{value:"monthly",label:"每月"},{value:"yearly",label:"每年"}]}/>
        </div>
        {form.repeat==="weekly"&&<div style={{display:"flex",gap:6,padding:"10px 14px",borderBottom:"1px solid #f5f5f5"}}>
          {WD.map((d,i)=><button key={i} onClick={()=>setForm(p=>{const r=p.repeatDays||[];return{...p,repeatDays:r.includes(i)?r.filter(x=>x!==i):[...r,i]};})} style={{width:30,height:30,borderRadius:"50%",border:"none",background:(form.repeatDays||[]).includes(i)?"#333":"#f0f0f0",color:(form.repeatDays||[]).includes(i)?"white":"#555",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"center"}}>{d}</button>)}
        </div>}
        {form.repeat&&form.repeat!=="none"&&<>
          <div style={{display:"flex",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid #f5f5f5"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:54,flexShrink:0}}>开始日</span>
            <input type="date" value={form.repeatStart||form.date} onChange={e=>setForm(p=>({...p,repeatStart:e.target.value}))}
              className="form-date-input" style={{...INP,border:"none",padding:0,background:"transparent",fontSize:13}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",padding:"9px 14px"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:54,flexShrink:0}}>结束日</span>
            <div style={{flex:1}}>
              {form.repeatEnd
                ? <input type="date" value={form.repeatEnd} onChange={e=>setForm(p=>({...p,repeatEnd:e.target.value}))}
                    className="form-date-input" style={{...INP,border:"none",padding:0,background:"transparent",fontSize:13}}/>
                : <span style={{fontSize:13,color:"#aaa"}}>永久</span>
              }
            </div>
            <div onClick={()=>setForm(p=>({...p,repeatEnd:p.repeatEnd?null:fmtDate(new Date(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate()))}))} style={{width:40,height:22,borderRadius:11,background:form.repeatEnd?"#555":"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{position:"absolute",top:2,left:form.repeatEnd?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </div>
          </div>
        </>}
      </div>

      <NotifPicker value={form.notif} onChange={v=>setForm(p=>({...p,notif:v}))}/>

      <div>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:5}}>笔记</div>
        <textarea value={form.notes} ref={el=>{if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px";}}} onChange={e=>{setForm(p=>({...p,notes:e.target.value}));e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";}} placeholder="添加备注…" className="notes-textarea" style={{...INP,width:"100%",minHeight:70,resize:"none",overflow:"hidden"}}
          onFocus={e=>{e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";setTimeout(()=>e.target.scrollIntoView({behavior:"smooth",block:"nearest"}),300);}}
          onBlur={()=>{setTimeout(()=>{window.scrollTo(0,0);if(window.visualViewport){const vv=window.visualViewport;if(vv.scale>1){document.documentElement.style.transform="scale(1)";document.documentElement.style.transform="";}}}  ,100);}}/>
      </div>
    </div>}

    {tab==="timer"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"10px 0"}}>
      <div style={{fontSize:58,fontWeight:100,letterSpacing:3,color:"#111",fontVariantNumeric:"tabular-nums"}}>{fmtSecs(elapsed)}</div>
      <div style={{display:"flex",gap:12}}>
        <button onClick={()=>setRunning(p=>!p)} style={{padding:"12px 34px",border:"none",borderRadius:30,background:running?"#555":"#333",color:"white",fontSize:16,fontWeight:700,cursor:"pointer",textAlign:"center"}}>{running?"暂停":"开始"}</button>
        {elapsed>0&&!running&&<button onClick={stopAndApply} style={{padding:"12px 20px",borderRadius:30,border:"none",background:"#555",color:"white",fontSize:14,fontWeight:600,cursor:"pointer",textAlign:"center"}}>应用时长</button>}
        {elapsed>0&&<button onClick={()=>{setRunning(false);setElapsed(0);setForm(p=>({...p,timerSecs:0}));}} style={{padding:"12px 16px",borderRadius:30,border:"1.5px solid #e5e7eb",background:"white",color:"#666",fontSize:14,cursor:"pointer",textAlign:"center"}}>重置</button>}
      </div>
      {elapsed>0&&<div style={{background:"#f2f2f7",borderRadius:12,padding:"10px 22px",textAlign:"center"}}>
        <div style={{fontSize:14,color:"#333",fontWeight:700}}>已计时 {fmtSecs(elapsed)}</div>
        <div style={{fontSize:12,color:"#8e8e93",marginTop:2}}>{timerApplied?"时长已应用，填写名称后即可保存":"点击「应用时长」将更新结束时间"}</div>
      </div>}
      {form.startTime&&<div style={{fontSize:12,color:"#8e8e93"}}>开始时间：{form.startTime} → {form.endTime||"—"}</div>}
    </div>}

    {/* Repeat delete is now handled via RepeatDeleteModal from the parent */}
    <div style={{display:"flex",gap:8,marginTop:18}}>
      {!isNew&&<button onClick={()=>{
        if(form.repeat&&form.repeat!=="none"&&onRepeatDelete){setShowRepeatDel(true);}
        else onDelete(form.id);
      }} style={{flex:1,padding:"10px",border:"none",borderRadius:12,background:"#FFF0F0",color:"#FF3B30",cursor:"pointer",fontSize:13,fontWeight:600,textAlign:"center"}}>删除</button>}
      {!(isNew&&tab==="timer"&&!timerApplied)&&<button onClick={()=>{
        if(!form.title.trim()) return;
        const saved={...form,timerSecs:elapsed};
        if(!hasTime){saved.startTime=null;saved.endTime=null;saved.allDay=false;}
        if(timerApplied) saved.done=true;
        // If editing an existing repeat task, ask which instances to update
        if(!isNew&&ev?.repeat&&ev.repeat!=="none"){
          setPendingSave(saved);
          setShowRepeatSave(true);
        } else {
          onSave(saved);
        }
      }} style={{flex:1,padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontWeight:700,fontSize:14,textAlign:"center"}}>{isNew?"添加":"保存"}</button>}
    </div>
    <InlineRepeatDelete open={showRepeatDel} onClose={()=>setShowRepeatDel(false)} onRepeatDelete={key=>{setShowRepeatDel(false);onRepeatDelete&&onRepeatDelete(key);}}/>
    <InlineRepeatDelete
      open={showRepeatSave}
      title="修改循环任务"
      onClose={()=>{setShowRepeatSave(false);setPendingSave(null);}}
      opts={[
        {key:"this",label:"仅修改当前任务",danger:false},
        {key:"after",label:"修改此后所有任务（含当天）",danger:false},
        {key:"all",label:"修改全部循环任务",danger:false},
      ]}
      onRepeatDelete={key=>{
        setShowRepeatSave(false);
        if(pendingSave) onSave({...pendingSave,_repeatSaveKey:key});
        setPendingSave(null);
      }}
    />
  </div>;
}

// Module-level flag: set true when a touch starts on an EventCard, so TodayPage swipe ignores it
let _cardTouchActive=false;

/* ══════ EVENT CARD (top-level, no hook violations) ══════ */
function EventCard({ev,dateStr,getLb,lightenHex,onToggle,onDelete,onOpen,labels}){
  const lb=getLb(ev.labelId);
  const flat2=flattenLabels(labels);
  const directLb=flat2.find(l=>l.id===ev.labelId);
  const displayLb=directLb||lb;
  // For repeat tasks, done is per-date; for normal tasks, use ev.done
  const isRepeat=ev.repeat&&ev.repeat!=="none";
  const isDone=isRepeat?(ev.doneOverrides&&ev.doneOverrides[dateStr||ev.date])||false:ev.done;
  const cardColor=isDone?lb.color:lightenHex(lb.color,0.45);
  const cardRef=useRef();
  const state=useRef({x0:0,y0:0,dx:0,vx:0,lastX:0,lastT:0,axis:null,dragging:false});
  const [offset,setOffset]=useState(0);
  const offsetRef=useRef(0);
  const animRef=useRef(null);
  const DELETE_W=76;
  const springTo=(target)=>{
    if(animRef.current) cancelAnimationFrame(animRef.current);
    const k=280,damping=30,mass=1;
    let vel=state.current.vx||0;
    let cur2=offsetRef.current;
    const step=()=>{
      const force=-k*(cur2-target);
      const acc=(force-damping*vel)/mass;
      vel+=acc*(1/60);cur2+=vel*(1/60);
      if(Math.abs(cur2-target)<0.5&&Math.abs(vel)<0.5){offsetRef.current=target;setOffset(target);return;}
      offsetRef.current=cur2;setOffset(cur2);animRef.current=requestAnimationFrame(step);
    };
    animRef.current=requestAnimationFrame(step);
  };
  useEffect(()=>{
    const el=cardRef.current; if(!el) return;
    const start=e=>{
      if(animRef.current) cancelAnimationFrame(animRef.current);
      _cardTouchActive=true;
      e.stopPropagation();
      const t=e.touches[0];
      state.current={x0:t.clientX,y0:t.clientY,startOffset:offsetRef.current,dx:0,vx:0,lastX:t.clientX,lastT:Date.now(),axis:null,dragging:true};
    };
    const move=e=>{
      const s=state.current; if(!s.dragging) return;
      const touch=e.touches[0];
      const dx=touch.clientX-s.x0,dy=touch.clientY-s.y0;
      if(!s.axis){if(Math.abs(dx)<3&&Math.abs(dy)<3) return;s.axis=Math.abs(dx)>Math.abs(dy)?"h":"v";}
      if(s.axis==="v") return;
      e.preventDefault();
      e.stopPropagation();
      const now=Date.now(),dt=Math.max(1,now-s.lastT);
      s.vx=(touch.clientX-s.lastX)/dt*16;s.lastX=touch.clientX;s.lastT=now;s.dx=dx;
      const raw=s.startOffset+dx;
      const bounded=Math.min(0,Math.max(-(DELETE_W+24),raw));
      offsetRef.current=bounded;setOffset(bounded);
    };
    const end=()=>{
      _cardTouchActive=false;
      const s=state.current;s.dragging=false;
      const cur=offsetRef.current;
      const snap=(cur<-(DELETE_W*0.38)||s.vx<-3)&&s.vx<=0?-DELETE_W:0;
      springTo(snap);
    };
    el.addEventListener("touchstart",start,{passive:true});
    el.addEventListener("touchmove",move,{passive:false});
    el.addEventListener("touchend",end,{passive:true});
    return()=>{el.removeEventListener("touchstart",start);el.removeEventListener("touchmove",move);el.removeEventListener("touchend",end);if(animRef.current)cancelAnimationFrame(animRef.current);};
  },[ev.id]);
  const close=()=>{state.current.vx=0;springTo(0);};
  const reveal=Math.min(1,Math.abs(offset)/DELETE_W);
  return <div ref={cardRef} data-task-card="1" style={{position:"relative",overflow:"hidden",borderBottom:"1px solid #f8f8f8"}}>
    <div style={{position:"absolute",top:0,right:0,bottom:0,width:DELETE_W,display:"flex",alignItems:"center",justifyContent:"center",background:"#FF3B30"}}>
      <button onClick={()=>onDelete(ev,dateStr||ev.date)} style={{width:"100%",height:"100%",border:"none",background:"transparent",color:"white",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:0}}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity:reveal,transform:`scale(${0.7+reveal*0.3})`,transition:"opacity 0.08s,transform 0.08s"}}>
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        <span style={{fontSize:11,fontWeight:700,opacity:reveal,transition:"opacity 0.08s"}}>删除</span>
      </button>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:11,padding:"13px 0",background:"white",transform:`translateX(${offset}px)`,willChange:"transform"}}>
      <button onClick={e=>{e.stopPropagation();if(offset!==0){close();return;}onToggle(ev.id,dateStr);}} style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${lb.color}`,background:isDone?lb.color:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {isDone&&<span style={{color:"white",fontSize:11,fontWeight:900}}>✓</span>}
      </button>
      <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>{if(offset!==0){close();return;}onOpen(ev,dateStr);}}>
        <div style={{fontSize:14,fontWeight:600,color:isDone?"#555":"#111",textDecoration:isDone?"line-through":"none",lineHeight:"1.45"}}>{ev.title}</div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4,flexWrap:"wrap"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:3,background:cardColor+"33",borderRadius:20,padding:"2px 7px",fontSize:11,color:isDone?lb.color:lightenHex(lb.color,-0.1),fontWeight:600}}>
            {displayLb.emoji} {displayLb.name}
          </span>
          {ev.startTime&&!ev.allDay&&<span style={{fontSize:12,color:"#8e8e93"}}>{ev.startTime}{ev.endTime&&` → ${ev.endTime}`}</span>}
          {ev.notes&&<span style={{fontSize:12,color:"#ccc"}}>📝</span>}
          {ev.repeat&&ev.repeat!=="none"&&<span style={{fontSize:12,color:"#ccc"}}>↻</span>}
          {ev.endDate&&ev.endDate!==ev.date&&<span style={{fontSize:11,color:"#8e8e93",background:"#f0f0f0",borderRadius:20,padding:"2px 6px"}}>跨日</span>}
          {ev.notif?.onStart&&<span style={{fontSize:11,color:"#8e8e93"}}>🔔</span>}
        </div>
      </div>
      <button onClick={()=>{if(offset!==0){close();return;}onOpen({...ev,_openTab:"timer"},dateStr);}} style={{width:30,height:30,borderRadius:"50%",border:"1.5px solid #d0d0d0",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="7" r="4.5" stroke="#b0b0b0" strokeWidth="1.2"/>
          <path d="M6.5 4.5V7L8 8.5" stroke="#b0b0b0" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M5 1.5H8" stroke="#b0b0b0" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  </div>;
}

/* ══════ MINI CALENDAR PICKER (for Today page header) ══════ */
function MiniCalendarPicker({currentDate, onSelect, onClose}){
  const today=new Date();
  const [cur,setCur]=useState(()=>{const d=new Date(currentDate+"T00:00:00");return new Date(d.getFullYear(),d.getMonth(),1);});
  const year=cur.getFullYear(),month=cur.getMonth();
  const firstDow=new Date(year,month,1).getDay();
  const dim=daysInMon(year,month);
  const cells=[];
  for(let i=0;i<Math.ceil((firstDow+dim)/7)*7;i++){
    const dayNum=i-firstDow;
    cells.push(dayNum>=0&&dayNum<dim?new Date(year,month,dayNum+1):null);
  }
  return <div style={{position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"flex-start",justifyContent:"flex-start"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{marginTop:120,marginLeft:16,background:"white",borderRadius:18,boxShadow:"0 8px 36px rgba(0,0,0,0.18)",padding:"14px 12px 12px",width:268,border:"1px solid #ebebeb"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"0 2px"}}>
        <button onClick={()=>setCur(new Date(year,month-1,1))} style={{border:"none",background:"#f2f2f7",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:15,color:"#555",textAlign:"center"}}>‹</button>
        <span style={{fontSize:14,fontWeight:700,color:"#111"}}>{MONTHS[month]} {year}</span>
        <button onClick={()=>setCur(new Date(year,month+1,1))} style={{border:"none",background:"#f2f2f7",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:15,color:"#555",textAlign:"center"}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
        {WD.map((d,i)=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:i===0||i===6?"#FF3B30":"#8e8e93",padding:"3px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const ds=fmtDate(d);
          const isSel=ds===currentDate;
          const isT=isSameDay(d,today);
          const isW=d.getDay()===0||d.getDay()===6;
          return <div key={i} onClick={()=>{onSelect(ds);onClose();}}
            style={{display:"flex",alignItems:"center",justifyContent:"center",height:32,borderRadius:8,cursor:"pointer",
              background:isSel?"#333":isT?"#f2f2f7":"transparent",
              color:isSel?"white":isW?"#FF3B30":"#111",fontWeight:isSel||isT?700:400,fontSize:13}}>
            {d.getDate()}
          </div>;
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:"1px solid #f5f5f5"}}>
        <button onClick={()=>{onSelect(todayStr());onClose();}} style={{border:"none",background:"#f2f2f7",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:"#333",fontWeight:600}}>今天</button>
        <button onClick={onClose} style={{border:"none",background:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",color:"#8e8e93"}}>关闭</button>
      </div>
    </div>
  </div>;
}

/* helper — render one day's content (pure, no hooks) */
function DayPanel({dateStr,events,labels,sections,getLb,lightenHex,onAdd,onOpen,onToggle,onDelete,setViewDate,changeDay}){
  const dDate=new Date(dateStr+"T00:00:00");
  const dIsToday=dateStr===todayStr();
  const dHol=HOLIDAYS[dateStr];
  const dEvs=getForDate(events,dateStr).slice().sort((a,b)=>{
    const aCarry=(a.endDate&&a.endDate!==a.date&&a.date!==dateStr);
    const bCarry=(b.endDate&&b.endDate!==b.date&&b.date!==dateStr);
    if(aCarry&&!bCarry) return -1;
    if(!aCarry&&bCarry) return 1;
    const aTime=aCarry?0:(a.startTime?parseMins(a.startTime):Infinity);
    const bTime=bCarry?0:(b.startTime?parseMins(b.startTime):Infinity);
    return aTime-bTime;
  });
  const allDayEvs=dEvs.filter(e=>e.allDay&&!(e.endDate&&e.endDate!==e.date&&e.date!==dateStr));
  const [collapsed,setCollapsed]=useState({});
  const toggleSection=key=>setCollapsed(p=>({...p,[key]:!p[key]}));
  return <>
    <div style={{padding:"16px 20px 10px",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:12,color:dIsToday?"#FF3B30":"#8e8e93",fontWeight:600,marginBottom:4}}>
          {dIsToday?"今天 · ":""}{dDate.toLocaleDateString("zh-CN",{weekday:"long"})}
          {dHol&&<span style={{marginLeft:8,fontSize:11,color:"#FF3B30",background:"#fff0f0",borderRadius:20,padding:"2px 8px"}}>{dHol}</span>}
        </div>
        <div style={{fontSize:13,fontWeight:700,color:"#8e8e93",marginBottom:1}}>{MONTHS[dDate.getMonth()]} {dDate.getFullYear()}</div>
        <div className="day-date-num">{dDate.getDate()}日</div>
        {!dIsToday&&<button onClick={()=>setViewDate(todayStr())} style={{border:"none",background:"#f2f2f7",borderRadius:20,padding:"4px 12px",fontSize:11,cursor:"pointer",color:"#555",marginTop:4,textAlign:"center"}}>回到今天</button>}
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0,alignSelf:"flex-start",marginTop:14}}>
        <button onClick={()=>changeDay(-1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:"#555",textAlign:"center"}}>‹</button>
        <button onClick={()=>changeDay(1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:"#555",textAlign:"center"}}>›</button>
      </div>
    </div>
    <div style={{margin:"0 16px 14px",background:"#f8f8f8",borderRadius:14,padding:"10px 14px"}}>
      <span style={{fontSize:13,color:"#555",lineHeight:"1.5"}}>共 <b style={{color:"#111"}}>{dEvs.filter(e=>e.date===dateStr||(e.startTime&&!e.allDay)||e.allDay||(e.endDate&&e.endDate!==e.date)).length}</b> 项 · 完成 <b style={{color:"#555"}}>{dEvs.filter(e=>(e.date===dateStr||(e.startTime&&!e.allDay)||e.allDay)&&isDoneOn(e,dateStr)).length}</b></span>
    </div>
    {allDayEvs.length>0&&<div>
      <div onClick={()=>toggleSection("allday")} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 20px 4px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        <span style={{fontSize:17}}>🌞</span>
        <span style={{fontSize:16,fontWeight:700,color:"#222",lineHeight:"1.4"}}>全天</span>
        <span style={{fontSize:14,color:"#c0c0c0"}}>{allDayEvs.length}</span>
        <span style={{fontSize:12,color:"#c0c0c0",marginLeft:"auto"}}>{collapsed["allday"]?"▶":"▼"}</span>
      </div>
      {!collapsed["allday"]&&<div data-task-list="1" style={{padding:"0 20px"}}>{allDayEvs.map(ev=><EventCard key={ev.id} ev={ev} dateStr={dateStr} getLb={getLb} lightenHex={lightenHex} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} labels={labels}/>)}</div>}
    </div>}
    {(()=>{
      const carryEvs=dEvs.filter(e=>e.endDate&&e.endDate!==e.date&&e.date!==dateStr);
      if(carryEvs.length===0) return null;
      return <div>
        <div onClick={()=>toggleSection("carry")} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 20px 4px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          <span style={{fontSize:17}}>🌙</span>
          <span style={{fontSize:16,fontWeight:700,color:"#222",lineHeight:"1.4"}}>昨日延续</span>
          <span style={{fontSize:14,color:"#c0c0c0"}}>{carryEvs.length}</span>
          <span style={{fontSize:12,color:"#c0c0c0",marginLeft:"auto"}}>{collapsed["carry"]?"▶":"▼"}</span>
        </div>
        {!collapsed["carry"]&&<div data-task-list="1" style={{padding:"0 20px"}}>{carryEvs.map(ev=><EventCard key={ev.id} ev={ev} dateStr={dateStr} getLb={getLb} lightenHex={lightenHex} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} labels={labels}/>)}</div>}
      </div>;
    })()}
    {sections.filter(sec=>sec.key!=="allday").map(sec=>{
      const isCarry=e=>(e.endDate&&e.endDate!==e.date&&e.date!==dateStr);
      const evs=dEvs.filter(e=>!isCarry(e)&&!e.allDay&&sec.test(e));
      return <div key={sec.key}>
        <div onClick={()=>toggleSection(sec.key)} style={{display:"flex",alignItems:"center",padding:"8px 20px 4px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          <div style={{display:"flex",alignItems:"center",gap:7,flex:1}}>
            <span style={{fontSize:17}}>{sec.icon}</span>
            <span style={{fontSize:16,fontWeight:700,color:"#222",lineHeight:"1.4"}}>{sec.label}</span>
            <span style={{fontSize:14,color:"#c0c0c0"}}>{evs.length}</span>
          </div>
          <span style={{fontSize:12,color:"#c0c0c0"}}>{collapsed[sec.key]?"▶":"▼"}</span>
        </div>
        {!collapsed[sec.key]&&evs.length>0&&<div data-task-list="1" style={{padding:"0 20px"}}>{evs.map(ev=><EventCard key={ev.id} ev={ev} dateStr={dateStr} getLb={getLb} lightenHex={lightenHex} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} labels={labels}/>)}</div>}
      </div>;
    })}
    {(()=>{
      const isCarry=e=>(e.endDate&&e.endDate!==e.date&&e.date!==dateStr);
      const noTimeEvs=dEvs.filter(e=>!isCarry(e)&&!e.allDay&&!e.startTime);
      if(noTimeEvs.length===0) return null;
      // Sort: tasks created on this date first, then older tasks
      const sorted=[...noTimeEvs].sort((a,b)=>a.date===dateStr?-1:b.date===dateStr?1:a.date<b.date?-1:1);
      return <div key="notime">
        <div onClick={()=>toggleSection("notime")} style={{display:"flex",alignItems:"center",padding:"8px 20px 4px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
          <div style={{display:"flex",alignItems:"center",gap:7,flex:1}}>
            <span style={{fontSize:17}}>📋</span>
            <span style={{fontSize:16,fontWeight:700,color:"#222",lineHeight:"1.4"}}>尚未安排时间</span>
            <span style={{fontSize:14,color:"#c0c0c0"}}>{sorted.length}</span>
          </div>
          <span style={{fontSize:12,color:"#c0c0c0"}}>{collapsed["notime"]?"▶":"▼"}</span>
        </div>
        {!collapsed["notime"]&&<div data-task-list="1" style={{padding:"0 20px"}}>{sorted.map(ev=><EventCard key={ev.id} ev={ev} dateStr={dateStr} getLb={getLb} lightenHex={lightenHex} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} labels={labels}/>)}</div>}
      </div>;
    })()}
  </>;
}

/* ══════ TODAY PAGE ══════ */
function TodayPage({events,labels,onOpen,onAdd,onToggle,onDelete}){
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const getLb=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌",name:"未分类"};
  const [viewDate,setViewDate]=useState(todayStr());
  const sections=[
    {key:"morning",icon:"🌅",label:"早上",test:e=>e.startTime&&!e.allDay&&parseMins(e.startTime)<720,hour:8},
    {key:"afternoon",icon:"☀️",label:"下午",test:e=>e.startTime&&!e.allDay&&parseMins(e.startTime)>=720&&parseMins(e.startTime)<1080,hour:14},
    {key:"evening",icon:"🌙",label:"晚上",test:e=>e.startTime&&!e.allDay&&parseMins(e.startTime)>=1080,hour:20},
    {key:"allday",icon:"📋",label:"尚未安排时间",test:e=>e.allDay||!e.startTime,hour:null},
  ];
  const lightenHex=(hex,amount=0.45)=>{
    if(!hex||hex.length<7) return hex||"#ccc";
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    const lr=Math.round(r+(255-r)*amount),lg=Math.round(g+(255-g)*amount),lb2=Math.round(b+(255-b)*amount);
    return `#${pad(lr.toString(16))}${pad(lg.toString(16))}${pad(lb2.toString(16))}`;
  };

  const outerRef=useRef();
  const stripRef=useRef();
  const wRef=useRef(0);
  // All swipe state lives in refs to avoid stale-closure issues
  const dragRef=useRef({active:false,axis:null,x0:0,y0:0,lastX:0,lastT:0,vx:0});
  const animRef=useRef(null);
  const snapTimerRef=useRef(null);
  const pendingTurnRef=useRef(null);
  // Render state: offset in px applied on top of base position
  const offsetRef=useRef(0);
  // Slot state: 3 fixed DOM slots, curSlot is the center
  const slotDatesRef=useRef([
    fmtDate(addDays(new Date(todayStr()+"T00:00:00"),-1)),
    todayStr(),
    fmtDate(addDays(new Date(todayStr()+"T00:00:00"),1)),
  ]);
  const curSlotRef=useRef(1);
  const [slotState,setSlotState]=useState({dates:slotDatesRef.current,cur:1});

  // Keep viewDate in sync
  useEffect(()=>{setViewDate(slotState.dates[slotState.cur]);},[slotState]);

  const jumpToDate=useCallback(ds=>{
    cancelAnim();
    const next=[
      fmtDate(addDays(new Date(ds+"T00:00:00"),-1)),
      ds,
      fmtDate(addDays(new Date(ds+"T00:00:00"),1)),
    ];
    slotDatesRef.current=next; curSlotRef.current=1;
    offsetRef.current=0;
    applyTransform(0,1,wRef.current||375,"none");
    setSlotState({dates:next,cur:1});
  },[]);

  // Commit a page turn: instantly update slot assignment then reset offset to 0
  const commitTurn=useCallback(n=>{
    const prevCur=curSlotRef.current;
    const nextCur=(prevCur+n+3)%3;
    const recycleSlot=(nextCur+n+3)%3;
    const dates=[...slotDatesRef.current];
    const centerDate=dates[nextCur];
    dates[recycleSlot]=fmtDate(addDays(new Date(centerDate+"T00:00:00"),n));
    slotDatesRef.current=dates;
    curSlotRef.current=nextCur;
    offsetRef.current=0;
    // Apply transform immediately at new base (no transition)
    const W=wRef.current||375;
    applyTransform(0,nextCur,W,"none");
    setSlotState({dates:[...dates],cur:nextCur});
  },[]);

  // Apply transform directly on DOM to skip React render during drag
  const applyTransform=(offset,cur,W,transition)=>{
    const el=stripRef.current; if(!el) return;
    const base=-(cur??curSlotRef.current)*W;
    el.style.transition=transition||"none";
    el.style.transform=`translateX(${base+offset}px)`;
  };

  const cancelAnim=()=>{
    if(animRef.current){cancelAnimationFrame(animRef.current);animRef.current=null;}
    if(snapTimerRef.current){clearTimeout(snapTimerRef.current);snapTimerRef.current=null;}
  };

  const snapTo=useCallback((targetOffset,onDone)=>{
    cancelAnim();
    const W=wRef.current||375;
    applyTransform(targetOffset,curSlotRef.current,W,"transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)");
    offsetRef.current=targetOffset;
    if(onDone){
      snapTimerRef.current=setTimeout(()=>{
        snapTimerRef.current=null;
        pendingTurnRef.current=null;
        offsetRef.current=0;
        onDone();
      },320);
    }
  },[]);

  // changeDay: called from arrow buttons (not swipe)
  const changeDay=useCallback(n=>{
    cancelAnim();
    const W=wRef.current||375;
    pendingTurnRef.current=n;
    snapTo(n<0?W:-W,()=>commitTurn(n));
  },[commitTurn,snapTo]);

  // Momentum-based fling snap
  const handleEnd=useCallback((dx,vx,W)=>{
    const thr=W*0.2;
    const fling=Math.abs(vx)>6;
    if((dx<-thr||( fling&&vx<0))&&!(dx>0)){
      // snap to next page: animate strip left by W, then commit
      pendingTurnRef.current=1;
      snapTo(-W,()=>commitTurn(1));
    } else if((dx>thr||(fling&&vx>0))&&!(dx<0)){
      pendingTurnRef.current=-1;
      snapTo(W,()=>commitTurn(-1));
    } else {
      pendingTurnRef.current=null;
      snapTo(0);
    }
  },[snapTo,commitTurn]);

  useEffect(()=>{
    const el=outerRef.current; if(!el) return;
    const getW=()=>{
      const w=el.offsetWidth||window.innerWidth;
      const firstMeasure=wRef.current===0&&w>0;
      wRef.current=w;
      if(firstMeasure){
        // First time we know the real width — apply the correct transform so today is visible
        applyTransform(offsetRef.current,curSlotRef.current,w,"none");
      }
    };
    getW();
    const ro=new ResizeObserver(getW); ro.observe(el);

    const onStart=e=>{
      // Use capture phase — this fires before any child listener.
      // If the touch target is inside a task card/list, refuse to activate page-swipe.
      const tgt=e.target;
      const inCard=!!(tgt.closest&&(tgt.closest('[data-task-card]')||tgt.closest('[data-task-list]')));
      if(inCard){
        dragRef.current={active:false,axis:null,x0:0,y0:0,lastX:0,lastT:0,vx:0};
        return; // do NOT stopPropagation — let card handle its own touch
      }
      if(tgt.closest&&tgt.closest('button,input,textarea,select')){
        dragRef.current={active:false,axis:null,x0:0,y0:0,lastX:0,lastT:0,vx:0};
        return;
      }
      // If a snap animation is in-flight, flush the pending commitTurn immediately
      // so the slot state is up-to-date before the new drag starts.
      if(snapTimerRef.current){
        clearTimeout(snapTimerRef.current);
        snapTimerRef.current=null;
        // commitTurn captures its logic in commitTurn itself; we need to call it now
        // We stored the pending direction in pendingTurnRef
        if(pendingTurnRef.current!==null){
          commitTurn(pendingTurnRef.current);
          pendingTurnRef.current=null;
        }
      }
      cancelAnim();
      const t=e.touches[0];
      dragRef.current={active:true,axis:null,x0:t.clientX,y0:t.clientY,lastX:t.clientX,lastT:Date.now(),vx:0};
      if(stripRef.current) stripRef.current.style.transition="none";
    };

    const onMove=e=>{
      const d=dragRef.current; if(!d.active) return;
      const t=e.touches[0];
      const dx=t.clientX-d.x0, dy=t.clientY-d.y0;
      if(!d.axis){
        if(Math.abs(dx)<4&&Math.abs(dy)<4) return;
        d.axis=Math.abs(dx)>Math.abs(dy)*0.8?"h":"v";
      }
      if(d.axis==="v") return;
      e.preventDefault();
      const now=Date.now(), dt=Math.max(8,now-d.lastT);
      d.vx=(t.clientX-d.lastX)/dt*16;
      d.lastX=t.clientX; d.lastT=now;
      offsetRef.current=dx;
      applyTransform(dx,curSlotRef.current,wRef.current||375,"none");
    };

    const onEnd=()=>{
      const d=dragRef.current;
      if(!d.active){d.active=false;return;} // was blocked in onStart
      d.active=false;
      if(d.axis!=="h"){
        if(offsetRef.current!==0){
          applyTransform(0,curSlotRef.current,wRef.current||375,"transform 0.2s ease");
          offsetRef.current=0;
        }
        return;
      }
      const W=wRef.current||el.offsetWidth||375;
      handleEnd(offsetRef.current,d.vx,W);
    };

    const onCancel=()=>{
      const d=dragRef.current; d.active=false;
      applyTransform(0,curSlotRef.current,wRef.current||375,"transform 0.2s ease");
      offsetRef.current=0;
    };

    el.addEventListener("touchstart",onStart,{passive:true,capture:true});
    el.addEventListener("touchmove",onMove,{passive:false});
    el.addEventListener("touchend",onEnd,{passive:true});
    el.addEventListener("touchcancel",onCancel,{passive:true});
    return()=>{
      ro.disconnect();
      cancelAnim();
      el.removeEventListener("touchstart",onStart,{capture:true});
      el.removeEventListener("touchmove",onMove);
      el.removeEventListener("touchend",onEnd);
      el.removeEventListener("touchcancel",onCancel);
    };
  },[handleEnd]);

  const W=wRef.current||0;

  // CRITICAL: Never put transform in JSX style — React would overwrite it on every render
  // (e.g. when toggling a task done), causing the visible jump.
  // Instead, imperatively set it before every paint via useLayoutEffect.
  // During drag/animation, applyTransform() keeps overwriting this in rAF — that's fine.
  useLayoutEffect(()=>{
    if(stripRef.current&&wRef.current>0){
      stripRef.current.style.transform=`translateX(${-(curSlotRef.current)*wRef.current+offsetRef.current}px)`;
    }
  });

  return <div ref={outerRef} style={{flex:1,overflow:"hidden",position:"relative"}}>
    <div ref={stripRef} style={{
      position:"absolute",inset:0,display:"flex",
      willChange:"transform",
    }}>
      {slotState.dates.map((ds,slotIdx)=>(
        <div key={slotIdx} style={{width:W>0?`${W}px`:"100%",minWidth:"100%",flexShrink:0,height:"100%",overflowY:"auto",overflowX:"hidden",paddingBottom:110}}>
          <DayPanel dateStr={ds} events={events} labels={labels} sections={sections} getLb={getLb} lightenHex={lightenHex} onAdd={onAdd} onOpen={onOpen} onToggle={onToggle} onDelete={onDelete} setViewDate={jumpToDate} changeDay={changeDay}/>
        </div>
      ))}
    </div>
    <button onClick={()=>onAdd(viewDate,9)} style={{position:"fixed",right:22,bottom:"calc(max(10px, env(safe-area-inset-bottom)) + 72px)",width:50,height:50,borderRadius:"50%",border:"none",background:"#007AFF",color:"white",fontSize:28,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,122,255,0.35)",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,zIndex:10,WebkitTapHighlightColor:"transparent",padding:"0 0 2px 0"}}>+</button>
  </div>;
}

/* ══════ 24H TIMELINE ══════ */
const HH=58;
// TimelineBody: pure grid content, rendered inside a shared scroll container
function TimelineBody({days,events,labels,onEventClick,onSlotClick,today}){
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const getLb=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌"};

  const lightenHex=(hex,amount=0.45)=>{
    if(!hex||hex.length<7) return hex||"#ccc";
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    const lr=Math.round(r+(255-r)*amount),lg2=Math.round(g+(255-g)*amount),lb2=Math.round(b+(255-b)*amount);
    return `#${pad(lr.toString(16))}${pad(lg2.toString(16))}${pad(lb2.toString(16))}`;
  };

  const getDaySegments=useCallback((ds)=>{
    return getForDate(events,ds,{includeUnscheduled:false}).filter(e=>!e.allDay&&e.startTime).map(ev=>{
      let startMins=parseMins(ev.startTime);
      let endMins=ev.endTime?parseMins(ev.endTime):startMins+60;
      if(ev.endDate && ev.endDate !== ev.date){
        if(ds === ev.date){ endMins = 1440; }
        else if(ds === ev.endDate){ startMins = 0; endMins = parseMins(ev.endTime||"00:00"); if(endMins===0) endMins=60; }
        else { startMins=0; endMins=1440; }
      } else {
        if(endMins<=startMins) endMins=1440;
      }
      return {...ev,_startMins:startMins,_endMins:Math.min(endMins,1440)};
    });
  },[events]);

  const layoutDay=useCallback(segs=>{
    const s=[...segs].sort((a,b)=>a._startMins-b._startMins);
    const cols=[];
    s.forEach(ev=>{let ci=cols.findIndex(col=>{const last=col[col.length-1];return last._endMins<=ev._startMins;});if(ci===-1){ci=cols.length;cols.push([]);}cols[ci].push(ev);});
    const tot=cols.length||1;const res={};cols.forEach((col,ci)=>col.forEach(ev=>{res[ev.id]={ci,tot};}));
    return res;
  },[]);

  const COL=`44px repeat(${days.length},minmax(0,1fr))`;
  return <div style={{position:"relative",minHeight:`${25*HH+HH}px`}}>
    <div style={{display:"grid",gridTemplateColumns:COL,paddingBottom:HH,minHeight:`${25*HH}px`}}>
      {Array.from({length:25},(_,h)=>[
        <div key={`t${h}`} style={{width:44,height:HH,borderBottom:"1px solid #f5f5f5",fontSize:10,color:"#b0b0b0",paddingTop:4,paddingLeft:6,flexShrink:0,boxSizing:"border-box"}}>
          {h<24?`${pad(h)}:00`:""}
        </div>,
        ...days.map((d,di)=>{
          const ds=fmtDate(d);
          const segs=getDaySegments(ds);
          const layout=layoutDay(segs);
          const hourSegs=segs.filter(e=>h<24&&Math.floor(e._startMins/60)===h);
          return <div key={`d${di}h${h}`} style={{height:h<24?HH:0,borderBottom:h<24?"1px solid #f5f5f5":"none",position:"relative",cursor:"pointer"}} onClick={h<24?()=>onSlotClick&&onSlotClick(ds,h):undefined}>
            {hourSegs.map(ev=>{
              const lb=getLb(ev.labelId);
              const isDone=isDoneOn(ev,ds);
              const bgColor=isDone?lb.color:lightenHex(lb.color,0.45);
              const topMin=ev._startMins%60;
              const durMins=ev._endMins-ev._startMins;
              const top=(topMin/60)*HH;
              const height=Math.max(18,(durMins/60)*HH-2);
              const {ci,tot}=layout[ev.id]||{ci:0,tot:1};
              // For cross-day events, always show the original full time range as label (e.g. 23:00–07:00)
              // so each segment (first day tail + second day head) shares the same label
              const isCrossDay=ev.endDate&&ev.endDate!==ev.date;
              const startLabel=ev.startTime||`${pad(Math.floor(ev._startMins/60))}:${pad(ev._startMins%60)}`;
              const endLabel=isCrossDay
                ? (ev.endTime||`${pad(Math.floor(ev._endMins/60))}:${pad(ev._endMins%60)}`)
                : `${pad(Math.floor(ev._endMins/60))}:${pad(ev._endMins%60)}`;
              return <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev,ds);}}
                style={{position:"absolute",top,left:`calc(${ci/tot*100}% + 1px)`,width:`calc(${100/tot}% - 2px)`,height,background:bgColor,borderRadius:5,padding:"2px 4px",cursor:"pointer",zIndex:2,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.1)",borderLeft:`3px solid ${lb.color}`}}>
                <div style={{fontSize:10,fontWeight:700,color:isDone?"white":"#333",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}><span style={{marginRight:3}}>{lb.emoji}</span>{ev.title}</div>
                {height>28&&<div style={{fontSize:9,color:isDone?"rgba(255,255,255,0.85)":"rgba(0,0,0,0.5)"}}>{startLabel} – {endLabel}</div>}
                {height>44&&<div style={{fontSize:9,color:isDone?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.4)"}}>{fmtMins(durMins)}</div>}
                {height>60&&ev.notes&&<div style={{fontSize:9,color:isDone?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.notes}</div>}
              </div>;
            })}
          </div>;
        })
      ])}
    </div>
    {days.some(d=>isSameDay(d,today))&&(()=>{
      const t=today.getHours()*HH+(today.getMinutes()/60)*HH;
      return <div style={{position:"absolute",top:t,left:44,right:0,zIndex:10,pointerEvents:"none"}}>
        <div style={{position:"absolute",left:0,right:0,height:1.5,background:"#FF3B30"}}/>
        <div style={{position:"absolute",left:-3,top:-3.5,width:8,height:8,borderRadius:"50%",background:"#FF3B30"}}/>
      </div>;
    })()}
  </div>;
}

// Timeline: standalone component used by TodayPage (manages its own scroll)
function Timeline({days,events,labels,onEventClick,onSlotClick,onDayHeaderClick,scrollRef:extScrollRef}){
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const today=new Date();
  const internalRef=useRef();
  const ref=extScrollRef||internalRef;
  useEffect(()=>{const h=today.getHours();if(ref.current)ref.current.scrollTop=Math.max(0,(h-2)*HH);},[]);

  const COL=`44px repeat(${days.length},minmax(0,1fr))`;
  // Check if any day has allDay events to show the strip
  const anyAllDay=days.some(d=>getForDate(events,fmtDate(d),{includeUnscheduled:false}).some(e=>e.allDay));
  return <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
    <div style={{display:"grid",gridTemplateColumns:COL,borderBottom:anyAllDay?"none":"1.5px solid #ebebeb",flexShrink:0}}>
      <div style={{width:44}}/>
      {days.map((d,i)=>{
        const isT=isSameDay(d,today);const isW=d.getDay()===0||d.getDay()===6;const hol=HOLIDAYS[fmtDate(d)];
        return <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 0 3px",cursor:onDayHeaderClick?"pointer":"default"}} onClick={onDayHeaderClick?()=>onDayHeaderClick(d):undefined}>
          <div style={{fontSize:10,fontWeight:600,color:isW?"#FF3B30":"#8e8e93",lineHeight:"14px"}}>{WD[d.getDay()]}</div>
          <div style={{width:28,height:28,borderRadius:"50%",marginTop:2,background:isT?"#333":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:13,fontWeight:isT?700:400,color:isT?"white":isW?"#FF3B30":"#111"}}>{d.getDate()}</span>
          </div>
          {hol&&<div style={{fontSize:9,color:"#FF3B30",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",maxWidth:"100%",lineHeight:"12px",marginTop:1}}>{hol.split("·")[0]}</div>}
        </div>;
      })}
    </div>
    {anyAllDay&&<div style={{display:"grid",gridTemplateColumns:COL,borderBottom:"1.5px solid #ebebeb",flexShrink:0}}>
      <div style={{width:44,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:9,color:"#8e8e93",fontWeight:600,}}>全天</span>
      </div>
      {days.map((d,i)=>{
        const ds=fmtDate(d);
        const adEvs=getForDate(events,ds,{includeUnscheduled:false}).filter(e=>e.allDay);
        const getLbLocal=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌"};
        return <div key={i} style={{padding:"2px 2px",minHeight:adEvs.length>0?20:16,display:"flex",flexDirection:"column",gap:1}}>
          {adEvs.map(ev=>{const lb=getLbLocal(ev.labelId);return <div key={ev.id} onClick={()=>onEventClick(ev,ds)} style={{fontSize:9,background:lb.color+"33",color:"#333",borderRadius:3,padding:"1px 3px",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",lineHeight:"13px",borderLeft:`2px solid ${lb.color}`,cursor:"pointer"}}>{lb.emoji} {ev.title}</div>;})}
        </div>;
      })}
    </div>}
    {extScrollRef
      // When shared scroll ref is provided, render content only (scroll container is outside)
      ? <div style={{position:"relative",minHeight:`${25*HH+HH}px`}}>
          <TimelineBody days={days} events={events} labels={labels} onEventClick={onEventClick} onSlotClick={onSlotClick} today={today}/>
        </div>
      : <div ref={ref} style={{flex:1,minHeight:0,overflowY:"scroll",overflowX:"hidden",position:"relative",WebkitOverflowScrolling:"touch"}}>
          <TimelineBody days={days} events={events} labels={labels} onEventClick={onEventClick} onSlotClick={onSlotClick} today={today}/>
        </div>
    }
  </div>;
}

/* ══════ MONTH GRID (dynamic task count per cell) ══════ */
function MonthGrid({cells,events,today,getLb,setCur,setView}){
  const gridRef=useRef();
  const cellRef=useRef(null); // ref to first cell for height measurement
  const [visibleTasks,setVisibleTasks]=useState(1);
  const rows=Math.ceil(cells.length/7);

  useEffect(()=>{
    const grid=gridRef.current; if(!grid) return;
    const measure=()=>{
      // Measure actual rendered cell height from the grid
      const gridH=grid.offsetHeight;
      if(!gridH||rows===0) return;
      const cellH=gridH/rows;
      // Layout inside each cell (all px heights are fixed):
      // top padding: 2px
      // date circle: 26px + 2px margin-bottom = 28px
      // holiday text (optional, ~10px): we conservatively assume present
      // each task chip: 16px (9px font + 1+1 padding + 1 margin-bottom) = ~16px
      // +N row: 14px
      // bottom padding: 2px
      const CELL_PAD=4; // top+bottom
      const CIRCLE=28;
      const HOL=10; // conservative
      const CHIP=16;
      const PLUS_ROW=14;
      const usable=cellH-CELL_PAD-CIRCLE-HOL-PLUS_ROW;
      const n=Math.max(0,Math.floor(usable/CHIP));
      setVisibleTasks(n);
    };
    measure();
    const ro=new ResizeObserver(measure);
    ro.observe(grid);
    return()=>ro.disconnect();
  },[rows]);

  return <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",height:"100%"}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px 4px",flexShrink:0,borderBottom:"1px solid #f5f5f5"}}>
      {WD.map((d,i)=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:i===0||i===6?"#FF3B30":"#8e8e93",padding:"4px 0"}}>{d}</div>)}
    </div>
    <div ref={gridRef} style={{flex:1,display:"grid",gridTemplateColumns:"repeat(7,1fr)",gridTemplateRows:`repeat(${rows},1fr)`,padding:"0 8px",overflow:"hidden"}}>
      {cells.map((c,i)=>{
        const isT=isSameDay(c.d,today);const isW=i%7===0||i%7===6;
        const evs=getForDate(events,fmtDate(c.d),{includeUnscheduled:false}).slice().sort((a,b)=>{
          // allDay events first
          const aAD=a.allDay?0:1; const bAD=b.allDay?0:1;
          if(aAD!==bAD) return aAD-bAD;
          return 0;
        });const hol=HOLIDAYS[fmtDate(c.d)];
        const shown=evs.slice(0,visibleTasks);const extra=evs.length-shown.length;
        return <div key={i} onClick={()=>{setCur(new Date(c.d));setView("week");}}
          style={{padding:"2px 2px",cursor:"pointer",opacity:c.inMonth?1:0.3,borderTop:"1px solid #f5f5f5",overflow:"hidden",minHeight:0,display:"flex",flexDirection:"column"}}>
          <div style={{width:26,height:26,borderRadius:"50%",margin:"0 auto 1px",display:"flex",alignItems:"center",justifyContent:"center",background:isT?"#333":"transparent",flexShrink:0}}>
            <span style={{fontSize:12,fontWeight:isT?700:400,color:isT?"white":isW?"#FF3B30":"#111"}}>{c.d.getDate()}</span>
          </div>
          {hol&&<div style={{fontSize:8,color:"#FF3B30",textAlign:"center",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",flexShrink:0,lineHeight:"10px",marginBottom:1}}>{hol.split("·")[0]}</div>}
          {shown.map((ev,j)=>{const lb=getLb(ev.labelId);const evDone=isDoneOn(ev,fmtDate(c.d));return <div key={j} style={{fontSize:9,background:lb.color+(evDone?"cc":"33"),color:evDone?"white":"#333",borderRadius:3,padding:"1px 3px",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",flexShrink:0,lineHeight:"14px",borderLeft:`2px solid ${lb.color}`}}>{lb.emoji} {ev.title}</div>;})}
          {extra>0&&<div style={{fontSize:9,color:"#8e8e93",paddingLeft:2,flexShrink:0,lineHeight:"14px"}}>+{extra}</div>}
        </div>;
      })}
    </div>
  </div>;
}

/* ══════ CALENDAR PAGE ══════ */
function CalendarPage({events,labels,onOpen,onAdd}){
  const [view,setView]=useState("month");
  const [cur,setCur]=useState(new Date());
  const [calFilterIds,setCalFilterIds]=useState([]); // empty = show all
  const today=new Date();
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const getLb=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌"};

  // Filtered events for calendar — selecting a parent label also shows all its children's tasks
  const filteredEvents=useMemo(()=>{
    if(calFilterIds.length===0) return events;
    const expandedIds=new Set(calFilterIds);
    labels.forEach(lb=>{
      if(calFilterIds.includes(lb.id)){
        (lb.children||[]).forEach(ch=>expandedIds.add(ch.id));
      }
    });
    return events.filter(e=>expandedIds.has(e.labelId)||(e.autoTags||[]).some(t=>expandedIds.has(t)));
  },[events,calFilterIds,labels]);

  const step=useCallback(n=>setCur(d=>{
    const r=new Date(d);
    if(view==="month") r.setMonth(r.getMonth()+n);
    else if(view==="week") r.setDate(r.getDate()+n*7);
    else r.setDate(r.getDate()+n);
    return r;
  }),[view]);

  // Keep a ref to the latest step so touch handlers always call the current version
  // without needing to re-register event listeners when view/cur changes
  const stepRef=useRef(step);
  useEffect(()=>{stepRef.current=step;},[step]);

  const lbl=useMemo(()=>{
    if(view==="month") return `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`;
    if(view==="week"){const s=new Date(cur);s.setDate(s.getDate()-s.getDay());const e=addDays(s,6);return s.getMonth()===e.getMonth()?`${MONTHS[s.getMonth()]} ${s.getFullYear()}`:MONTHS[s.getMonth()]+" — "+MONTHS[e.getMonth()];}
    return `${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
  },[view,cur]);

  // pixel-based 3-panel swipe
  const calRef=useRef();
  const calSwipeRef=useRef({x0:0,y0:0,axis:null,active:false,vx:0,lastX:0,lastT:0});
  const calOffsetRef=useRef(0);
  const [calOffset,setCalOffset]=useState(0);
  const calAnimRef=useRef(null);
  // Store the pending "onDone" callback so onStart can flush it when interrupting an animation
  const calAnimDoneRef=useRef(null);
  const calWRef=useRef(0);
  const [calW,setCalW]=useState(0); // reactive width for correct first-render layout
  // swipeCaptureRef: the element we bind touch events to (outer wrapper, always full area)
  const swipeCaptureRef=useRef();

  const calSpring=useCallback((from,to,onDone)=>{
    if(calAnimRef.current) cancelAnimationFrame(calAnimRef.current);
    calAnimDoneRef.current=onDone||null;
    let v=0,c=from;const k=220,damp=26;
    const tick=()=>{
      const f=-k*(c-to);const a=f-damp*v;v+=a/60;c+=v/60;
      if(Math.abs(c-to)<0.3&&Math.abs(v)<0.3){
        calOffsetRef.current=0;setCalOffset(0);
        const cb=calAnimDoneRef.current;calAnimDoneRef.current=null;cb&&cb();
        return;
      }
      calOffsetRef.current=c;setCalOffset(c);calAnimRef.current=requestAnimationFrame(tick);
    };
    calAnimRef.current=requestAnimationFrame(tick);
  },[]);

  useEffect(()=>{
    const el=swipeCaptureRef.current; if(!el) return;
    const getW=()=>{const w=el.offsetWidth||window.innerWidth;calWRef.current=w;setCalW(w);};
    getW();
    const ro=new ResizeObserver(getW); ro.observe(el);
    const onStart=e=>{
      // If an animation is in flight, cancel it and flush its pending step callback
      // so the previous page turn completes before the new drag begins
      if(calAnimRef.current){
        cancelAnimationFrame(calAnimRef.current);
        calAnimRef.current=null;
        const cb=calAnimDoneRef.current;calAnimDoneRef.current=null;
        if(cb) cb();
      }
      calOffsetRef.current=0;setCalOffset(0);
      const t=e.touches[0];
      calSwipeRef.current={x0:t.clientX,y0:t.clientY,axis:null,active:true,vx:0,lastX:t.clientX,lastT:Date.now()};
    };
    const onMove=e=>{
      const s=calSwipeRef.current; if(!s.active) return;
      const t=e.touches[0];
      const dx=t.clientX-s.x0,dy=t.clientY-s.y0;
      if(!s.axis){if(Math.abs(dx)<5&&Math.abs(dy)<5) return;s.axis=Math.abs(dx)>Math.abs(dy)*0.9?"h":"v";}
      if(s.axis==="v") return; // let vertical scroll pass through
      e.preventDefault();
      const now=Date.now(),dt=Math.max(1,now-s.lastT);
      s.vx=(t.clientX-s.lastX)/dt*16;s.lastX=t.clientX;s.lastT=now;
      calOffsetRef.current=dx;setCalOffset(dx);
    };
    const onEnd=()=>{
      const s=calSwipeRef.current;s.active=false;
      if(s.axis!=="h"){calOffsetRef.current=0;setCalOffset(0);return;}
      const dx=calOffsetRef.current,W=calWRef.current||el.offsetWidth||320,thr=W*0.2;
      if(dx<-thr||s.vx<-3) calSpring(dx,-W,()=>stepRef.current(1));
      else if(dx>thr||s.vx>3) calSpring(dx,W,()=>stepRef.current(-1));
      else calSpring(dx,0);
    };
    el.addEventListener("touchstart",onStart,{passive:true});
    el.addEventListener("touchmove",onMove,{passive:false});
    el.addEventListener("touchend",onEnd,{passive:true});
    return()=>{
      ro.disconnect();
      el.removeEventListener("touchstart",onStart);
      el.removeEventListener("touchmove",onMove);
      el.removeEventListener("touchend",onEnd);
      // Do NOT cancel calAnimRef here — let in-flight animations complete
    };
  },[calSpring]);

  // Compute prev/next cursors per view
  const shiftCur=(c,v,n)=>{const r=new Date(c);if(v==="month")r.setMonth(r.getMonth()+n);else if(v==="week")r.setDate(r.getDate()+n*7);else r.setDate(r.getDate()+n);return r;};

  const renderPanel=(panelCur)=>{
    if(view==="month"){
      const y=panelCur.getFullYear(),m=panelCur.getMonth();
      const first=new Date(y,m,1);const pd=first.getDay();const total=pd+daysInMon(y,m);
      const cells=[];for(let i=0;i<Math.ceil(total/7)*7;i++){const d=new Date(y,m,1-pd+i);cells.push({d,inMonth:d.getMonth()===m});}
      return <MonthGrid cells={cells} events={filteredEvents} today={today} getLb={getLb} setCur={setCur} setView={setView}/>;
    }
    if(view==="week"){
      const s=new Date(panelCur);s.setDate(s.getDate()-s.getDay());
      const wDays=Array.from({length:7},(_,i)=>addDays(s,i));
      return <Timeline days={wDays} events={filteredEvents} labels={labels} onEventClick={onOpen} onSlotClick={(ds,h)=>onAdd(ds,h)} onDayHeaderClick={d=>{setCur(d);setView("day");}}/>;
    }
    // day view
    return <Timeline days={[panelCur]} events={filteredEvents} labels={labels} onEventClick={onOpen} onSlotClick={(ds,h)=>onAdd(ds,h)}/>;
  };

  const W=calW||calWRef.current;
  const prevC=shiftCur(cur,view,-1);
  const nextC=shiftCur(cur,view,1);
  // Use actual container width so desktop sidebar is accounted for, and first render is correct
  const panelW=W>0?`${W}px`:"100%";
  const baseOffset=W>0?-W:-0; // when W unknown keep at 0, panels invisible until measured
  const tx=W>0?`${-W+calOffset}px`:"0px";
  const stripStyle={position:"absolute",inset:0,display:"flex",transform:`translateX(${W>0?(-W+calOffset):0}px)`,willChange:"transform",visibility:W>0?"visible":"hidden"};
  // For timeline body: relative flex row shifted by translateX (inside scroll container)
  const bodyStripStyle={display:"flex",position:"relative",transform:`translateX(${tx})`,willChange:"transform",visibility:W>0?"visible":"hidden"};

  // Shared scroll ref for week/day timeline panels (keeps vertical position in sync)
  const sharedScrollRef=useRef();
  const didInitScrollRef=useRef(false);
  useEffect(()=>{
    if((view==="week"||view==="day")&&sharedScrollRef.current&&!didInitScrollRef.current){
      const h=today.getHours();
      sharedScrollRef.current.scrollTop=Math.max(0,(h-2)*HH);
      didInitScrollRef.current=true;
    }
    if(view==="month") didInitScrollRef.current=false;
  },[view]);

  // For week/day: render only the day-header strip (no scroll), to be placed above shared scroll area
  const renderHeaderStrip=(panelCur)=>{
    if(view==="week"){
      const s=new Date(panelCur);s.setDate(s.getDate()-s.getDay());
      const wDays=Array.from({length:7},(_,i)=>addDays(s,i));
      const COL=`44px repeat(7,minmax(0,1fr))`;
      const anyAD=wDays.some(d=>getForDate(filteredEvents,fmtDate(d),{includeUnscheduled:false}).some(e=>e.allDay));
      return <div>
        <div style={{display:"grid",gridTemplateColumns:COL,borderBottom:anyAD?"none":"1.5px solid #ebebeb"}}>
          <div style={{width:44}}/>
          {wDays.map((d,i)=>{
            const isT=isSameDay(d,today);const isW=d.getDay()===0||d.getDay()===6;const hol=HOLIDAYS[fmtDate(d)];
            return <div key={i} style={{textAlign:"center",padding:"5px 0 3px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center"}} onClick={()=>{setCur(d);setView("day");}}>
              <div style={{fontSize:10,fontWeight:600,color:isW?"#FF3B30":"#8e8e93",lineHeight:"14px",width:"100%",textAlign:"center"}}>{WD[d.getDay()]}</div>
              <div style={{width:28,height:28,borderRadius:"50%",marginTop:2,background:isT?"#333":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:13,fontWeight:isT?700:400,color:isT?"white":isW?"#FF3B30":"#111"}}>{d.getDate()}</span>
              </div>
              {hol&&<div style={{fontSize:9,color:"#FF3B30",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",maxWidth:"100%",lineHeight:"12px",marginTop:1}}>{hol.split("·")[0]}</div>}
            </div>;
          })}
        </div>
        {anyAD&&<div style={{display:"grid",gridTemplateColumns:COL,borderBottom:"1.5px solid #ebebeb"}}>
          <div style={{width:44,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:9,color:"#8e8e93",fontWeight:600,}}>全天</span>
          </div>
          {wDays.map((d,i)=>{
            const ds=fmtDate(d);const adEvs=getForDate(filteredEvents,ds,{includeUnscheduled:false}).filter(e=>e.allDay);
            return <div key={i} style={{padding:"2px 2px",minHeight:adEvs.length>0?20:14,display:"flex",flexDirection:"column",gap:1}}>
              {adEvs.map(ev=>{const lb=getLb(ev.labelId);return <div key={ev.id} onClick={()=>onOpen(ev,ds)} style={{fontSize:9,background:lb.color+"33",color:"#333",borderRadius:3,padding:"1px 3px",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",lineHeight:"13px",borderLeft:`2px solid ${lb.color}`,cursor:"pointer"}}>{lb.emoji} {ev.title}</div>;})}
            </div>;
          })}
        </div>}
      </div>;
    }
    // day view
    const d=panelCur;const isT=isSameDay(d,today);const isW=d.getDay()===0||d.getDay()===6;const hol=HOLIDAYS[fmtDate(d)];
    const ds=fmtDate(d);const adEvs=getForDate(filteredEvents,ds,{includeUnscheduled:false}).filter(e=>e.allDay);
    return <div>
      <div style={{display:"grid",gridTemplateColumns:"44px 1fr",borderBottom:adEvs.length>0?"none":"1.5px solid #ebebeb"}}>
        <div style={{width:44}}/>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 0 3px"}}>
          <div style={{fontSize:10,fontWeight:600,color:isW?"#FF3B30":"#8e8e93",lineHeight:"14px"}}>{WD[d.getDay()]}</div>
          <div style={{width:28,height:28,borderRadius:"50%",marginTop:2,background:isT?"#333":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:13,fontWeight:isT?700:400,color:isT?"white":isW?"#FF3B30":"#111"}}>{d.getDate()}</span>
          </div>
          {hol&&<div style={{fontSize:9,color:"#FF3B30",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",maxWidth:"100%",lineHeight:"12px",marginTop:1}}>{hol.split("·")[0]}</div>}
        </div>
      </div>
      {adEvs.length>0&&<div style={{display:"grid",gridTemplateColumns:"44px 1fr",borderBottom:"1.5px solid #ebebeb"}}>
        <div style={{width:44,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:9,color:"#8e8e93",fontWeight:600,}}>全天</span>
        </div>
        <div style={{padding:"2px 4px",display:"flex",flexDirection:"column",gap:2}}>
          {adEvs.map(ev=>{const lb=getLb(ev.labelId);return <div key={ev.id} onClick={()=>onOpen(ev,ds)} style={{fontSize:10,background:lb.color+"33",color:"#333",borderRadius:4,padding:"2px 6px",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",lineHeight:"15px",borderLeft:`2px solid ${lb.color}`,cursor:"pointer"}}>{lb.emoji} {ev.title}</div>;})}
        </div>
      </div>}
    </div>;
  };

  // For week/day: render only the scrollable body (no header, no own scroll)
  const renderBodyPanel=(panelCur)=>{
    if(view==="week"){
      const s=new Date(panelCur);s.setDate(s.getDate()-s.getDay());
      const wDays=Array.from({length:7},(_,i)=>addDays(s,i));
      return <TimelineBody days={wDays} events={filteredEvents} labels={labels} onEventClick={onOpen} onSlotClick={(ds,h)=>onAdd(ds,h)} today={today}/>;
    }
    return <TimelineBody days={[panelCur]} events={filteredEvents} labels={labels} onEventClick={onOpen} onSlotClick={(ds,h)=>onAdd(ds,h)} today={today}/>;
  };

  const isTimeline=view==="week"||view==="day";

  return <div ref={swipeCaptureRef} style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"10px 14px 8px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
      <div style={{display:"flex",background:"#f2f2f7",borderRadius:10,padding:2,gap:2}}>
        {[["month","月"],["week","周"],["day","日"]].map(([v,l])=><button key={v} onClick={()=>setView(v)} style={{padding:"5px 12px",border:"none",borderRadius:8,background:view===v?"white":"transparent",fontWeight:view===v?700:400,fontSize:13,cursor:"pointer",boxShadow:view===v?"0 1px 4px rgba(0,0,0,0.08)":"",textAlign:"center"}}>{l}</button>)}
      </div>
      <span style={{flex:1,fontSize:15,fontWeight:700,color:"#111",textAlign:"center"}}>{lbl}</span>
      <button onClick={()=>setCur(new Date())} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer",color:"#555",textAlign:"center"}}>今</button>
      <button onClick={()=>step(-1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14,color:"#555",textAlign:"center"}}>‹</button>
      <button onClick={()=>step(1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14,color:"#555",textAlign:"center"}}>›</button>
    </div>
    {/* Label filter chips — includes child labels */}
    <div style={{paddingLeft:14,paddingRight:14,paddingBottom:6,flexShrink:0,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
      <button onClick={()=>setCalFilterIds([])} style={{padding:"3px 10px",borderRadius:20,border:"none",background:calFilterIds.length===0?"#333":"#f0f0f0",color:calFilterIds.length===0?"white":"#555",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"center"}}>全部</button>
      {flat.map(lb=>{
        const active=calFilterIds.includes(lb.id);
        const isChild=!!lb._parent;
        return <button key={lb.id} onClick={()=>setCalFilterIds(p=>active?p.filter(x=>x!==lb.id):[...p,lb.id])}
          style={{padding:"3px 10px",borderRadius:20,border:active?`1.5px solid ${lb.color}`:"1.5px solid transparent",background:active?lb.color+"22":"#f0f0f0",color:active?lb.color:"#555",fontSize:isChild?10:11,fontWeight:active?700:400,cursor:"pointer",textAlign:"center",display:"flex",alignItems:"center",gap:3,opacity:isChild?0.85:1}}>
          {isChild&&<span style={{fontSize:9,color:active?lb.color:"#aaa"}}>#</span>}
          <span>{lb.emoji}</span><span>{lb.name}</span>
        </button>;
      })}
    </div>
    {isTimeline
      /* week/day: fixed header strip slides + shared scroll body */
      ? <>
          {/* sliding header strip — no scroll, just translateX */}
          <div style={{flexShrink:0,overflow:"hidden",position:"relative"}}>
            <div style={{display:"flex",position:"absolute",top:0,left:0,width:"100%",transform:`translateX(${tx})`,willChange:"transform"}}>
              {[prevC,cur,nextC].map((c,i)=>(
                <div key={i} style={{width:panelW,minWidth:"100%",flexShrink:0}}>
                  {renderHeaderStrip(c)}
                </div>
              ))}
            </div>
            {/* Spacer to give the absolute-positioned strip a height */}
            <div style={{visibility:"hidden",pointerEvents:"none"}}>{renderHeaderStrip(cur)}</div>
          </div>
          {/* single shared scroll area */}
          <div ref={sharedScrollRef} style={{flex:1,minHeight:0,overflowY:"scroll",overflowX:"hidden",position:"relative",WebkitOverflowScrolling:"touch"}}>
            <div style={{...bodyStripStyle}}>
              {[prevC,cur,nextC].map((c,i)=>(
                <div key={i} style={{width:panelW,minWidth:"100%",flexShrink:0}}>
                  {renderBodyPanel(c)}
                </div>
              ))}
            </div>
          </div>
        </>
      /* month view: unchanged */
      : <div ref={calRef} style={{flex:1,minHeight:0,overflow:"hidden",position:"relative"}}>
          <div style={stripStyle}>
            {[prevC,cur,nextC].map((c,i)=>(
              <div key={i} style={{width:panelW,minWidth:"100%",flexShrink:0,height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
                {renderPanel(c)}
              </div>
            ))}
          </div>
        </div>
    }
  </div>;
}

/* ══════ STATS PAGE ══════ */
function StatsPage({events,labels,onOpen}){
  const [period,setPeriod]=useState("month");
  const [offset,setOffset]=useState(0);
  const [heatIds,setHeatIds]=useState(["all"]);
  const [expId,setExpId]=useState(null);
  const [detEv,setDetEv]=useState(null);
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const getLb=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌",name:"未分类"};

  const {start,end,rLabel}=useMemo(()=>{
    const now=new Date();
    if(period==="day"){const d=addDays(now,-offset);return{start:fmtDate(d),end:fmtDate(d),rLabel:fmtDate(d)};}
    if(period==="week"){const s=new Date(now);s.setDate(s.getDate()-s.getDay()-offset*7);const e=addDays(s,6);return{start:fmtDate(s),end:fmtDate(e),rLabel:`第${Math.ceil((s.getDate())/7)}周`};}
    if(period==="year"){const y=now.getFullYear()-offset;return{start:`${y}-01-01`,end:`${y}-12-31`,rLabel:`${y}年`};}
    const base=new Date(now.getFullYear(),now.getMonth()-offset,1);const e2=new Date(base.getFullYear(),base.getMonth()+1,0);return{start:fmtDate(base),end:fmtDate(e2),rLabel:`${MONTHS[base.getMonth()]} ${base.getFullYear()}`};
  },[period,offset]);

  const rangeEvs=useMemo(()=>{const res=[];let d=new Date(start);while(fmtDate(d)<=end){getForDate(events,fmtDate(d),{includeUnscheduled:false}).forEach(e=>{if(!res.find(x=>x.id===e.id&&x._d===fmtDate(d)))res.push({...e,_d:fmtDate(d)});});d=addDays(d,1);}return res;},[events,start,end]);
  const doneEvs=useMemo(()=>rangeEvs.filter(e=>isDoneOn(e,e._d)),[rangeEvs]);

  // Previous period (for change rate)
  const {prevStart,prevEnd}=useMemo(()=>{
    const now=new Date();
    if(period==="day"){const d=addDays(now,-(offset+1));return{prevStart:fmtDate(d),prevEnd:fmtDate(d)};}
    if(period==="week"){const s=new Date(now);s.setDate(s.getDate()-s.getDay()-(offset+1)*7);return{prevStart:fmtDate(s),prevEnd:fmtDate(addDays(s,6))};}
    if(period==="year"){const y=now.getFullYear()-(offset+1);return{prevStart:`${y}-01-01`,prevEnd:`${y}-12-31`};}
    const base=new Date(now.getFullYear(),now.getMonth()-(offset+1),1);const e2=new Date(base.getFullYear(),base.getMonth()+1,0);return{prevStart:fmtDate(base),prevEnd:fmtDate(e2)};
  },[period,offset]);

  const prevDoneEvs=useMemo(()=>{const res=[];let d=new Date(prevStart);while(fmtDate(d)<=prevEnd){getForDate(events,fmtDate(d),{includeUnscheduled:false}).filter(e=>isDoneOn(e,fmtDate(d))).forEach(e=>{if(!res.find(x=>x.id===e.id&&x._d===fmtDate(d)))res.push({...e,_d:fmtDate(d)});});d=addDays(d,1);}return res;},[events,prevStart,prevEnd]);

  // Period total minutes (for utilization rate)
  const periodTotalMins=useMemo(()=>{const s=new Date(start+"T00:00:00"),e=new Date(end+"T00:00:00");return(Math.round((e-s)/(864e5))+1)*1440;},[start,end]);

  const lblStats=useMemo(()=>labels.map(lb=>{
    const mEvs=doneEvs.filter(e=>e.labelId===lb.id);const mMins=mEvs.reduce((s,e)=>s+getDur(e),0);
    const ch=(lb.children||[]).map(c=>{
      const ces=doneEvs.filter(e=>e.labelId===c.id);
      const pces=prevDoneEvs.filter(e=>e.labelId===c.id);
      return{...c,mins:ces.reduce((s,e)=>s+getDur(e),0),prevMins:pces.reduce((s,e)=>s+getDur(e),0),count:ces.length,evs:ces};
    });
    const aEvs=doneEvs.filter(e=>(e.autoTags||[]).includes(lb.id)&&e.labelId!==lb.id);const aMins=aEvs.reduce((s,e)=>s+getDur(e),0);
    const total=mMins+aMins+ch.reduce((s,c)=>s+c.mins,0);
    const allEvs=[...mEvs,...aEvs,...ch.flatMap(c=>c.evs)];
    const pmEvs=prevDoneEvs.filter(e=>e.labelId===lb.id);const pmMins=pmEvs.reduce((s,e)=>s+getDur(e),0);
    const paEvs=prevDoneEvs.filter(e=>(e.autoTags||[]).includes(lb.id)&&e.labelId!==lb.id);const paMins=paEvs.reduce((s,e)=>s+getDur(e),0);
    const prevTotal=pmMins+paMins+ch.reduce((s,c)=>s+c.prevMins,0);
    return{...lb,evs:allEvs,children:ch,total,prevTotal,count:allEvs.length};
  }).filter(l=>l.count>0).sort((a,b)=>b.total-a.total),[doneEvs,prevDoneEvs,labels]);

  const grand=lblStats.reduce((s,l)=>s+l.total,0);
  const grandSafe=grand||1;

  // Change badge: green up / red down
  const ChgBadge=({cur,prev})=>{
    if(prev===0&&cur===0) return <span style={{fontSize:10,color:"#c0c0c0",minWidth:44,textAlign:"right"}}>N/A</span>;
    if(prev===0) return <span style={{fontSize:10,fontWeight:700,color:"#34C759",minWidth:44,textAlign:"right"}}>NEW</span>;
    const p=Math.round((cur-prev)/prev*100),up=p>=0;
    return <span style={{fontSize:10,fontWeight:700,color:up?"#34C759":"#FF3B30",minWidth:44,textAlign:"right"}}>{up?"▲":"▼"}{up?"+":""}{p}%</span>;
  };

  // heatmap: compute per-day data with per-label minutes for coloring
  const heatDays=period==="day"?1:period==="week"?7:period==="month"?
    (()=>{const base=new Date(new Date().getFullYear(),new Date().getMonth()-offset,1);return new Date(base.getFullYear(),base.getMonth()+1,0).getDate();})()
    :365;

  const heatIsAll=heatIds.includes("all");
  const hLb=!heatIsAll&&heatIds.length===1?flat.find(l=>l.id===heatIds[0]):null;

  const heatData=useMemo(()=>{
    const isAll=heatIds.includes("all");
    const arr=[];
    let startD;
    if(period==="day"){startD=addDays(new Date(),-offset);}
    else if(period==="week"){const s=new Date(new Date());s.setDate(s.getDate()-s.getDay()-offset*7);startD=s;}
    else if(period==="month"){startD=new Date(new Date().getFullYear(),new Date().getMonth()-offset,1);}
    else{startD=new Date(new Date().getFullYear()-offset,0,1);}
    const days=period==="year"?365:period==="month"?new Date(startD.getFullYear(),startD.getMonth()+1,0).getDate():period==="week"?7:1;
    for(let i=0;i<days;i++){
      const d=addDays(startD,i);const ds=fmtDate(d);
      const dayEvs=getForDate(events,ds,{includeUnscheduled:false}).filter(e=>isDoneOn(e,ds));
      // per label minutes
      const byLabel={};
      dayEvs.forEach(e=>{
        const lid=e.labelId;
        byLabel[lid]=(byLabel[lid]||0)+getDur(e);
      });
      const totalMins=Object.values(byLabel).reduce((s,v)=>s+v,0);
      // dominant label (most minutes)
      let domLabel=null,domMins=0;
      Object.entries(byLabel).forEach(([lid,m])=>{if(m>domMins){domMins=m;domLabel=lid;}});
      const filteredMins=(isAll?totalMins:(()=>{
        const fEvs=dayEvs.filter(e=>heatIds.includes(e.labelId)||(e.autoTags||[]).some(t=>heatIds.includes(t)));
        return fEvs.reduce((s,e)=>s+getDur(e),0);
      })());
      // dominant label among selected
      let filtDomLabel=domLabel;
      if(!isAll){
        const filtByLabel={};
        dayEvs.filter(e=>heatIds.includes(e.labelId)).forEach(e=>{filtByLabel[e.labelId]=(filtByLabel[e.labelId]||0)+getDur(e);});
        let fd=null,fm=0;Object.entries(filtByLabel).forEach(([lid,m])=>{if(m>fm){fm=m;fd=lid;}});
        filtDomLabel=fd||domLabel;
      }
      arr.push({d:ds,mins:filteredMins,domLabel:filtDomLabel,domMins,byLabel});
    }
    return arr;
  },[events,heatIds,offset,period]);

  // Absolute-scale heat color: intensity based on fixed time caps per granularity.
  // Caps: day_heat=10min, week=60min, month_mobile=120min, month_desk=60min, year=720min(12h)
  const isMobileView=window.innerWidth<768;
  const heatCellColor=(domLabelId, mins, granularity)=>{
    if(!mins) return "#f0f0f0";
    let cap;
    if(granularity==="day_heat") cap=10;
    else if(granularity==="week") cap=60;
    else if(granularity==="month") cap=isMobileView?120:60;
    else if(granularity==="year") cap=720;
    else cap=60; // fallback
    const a=Math.min(1, 0.18+0.82*(mins/cap));
    const domLb=domLabelId?flat.find(l=>l.id===domLabelId):null;
    const baseColor=domLb?domLb.color:(hLb?hLb.color:"#8e8e93");
    const r=parseInt(baseColor.slice(1,3),16),g=parseInt(baseColor.slice(3,5),16),b=parseInt(baseColor.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  };

  // legend color for gradient
  const legendBaseColor=hLb?hLb.color:"#8e8e93";
  const legendR=parseInt(legendBaseColor.slice(1,3),16),legendG=parseInt(legendBaseColor.slice(3,5),16),legendB=parseInt(legendBaseColor.slice(5,7),16);

  const Donut=()=>{
    const sz=180,cx=90,cy=90,r=64,sw=22,ci=2*Math.PI*r;
    let cum=0;
    return <svg width={sz} height={sz}>
      {lblStats.map(lb=>{
        const frac=lb.total/grandSafe;const dash=frac*ci;const off=ci-cum*ci;
        cum+=frac;
        return <circle key={lb.id} cx={cx} cy={cy} r={r} fill="none" stroke={lb.color} strokeWidth={sw} strokeDasharray={`${dash} ${ci-dash}`} strokeDashoffset={off} style={{transform:`rotate(-90deg)`,transformOrigin:"center"}}/>;
      })}
      <text x={cx} y={cy-6} textAnchor="middle" fontSize={11} fill="#8e8e93">总时长</text>
      <text x={cx} y={cy+12} textAnchor="middle" fontSize={16} fontWeight={700} fill="#111">{fmtMins(grand)}</text>
    </svg>;
  };

  // Heatmap grid config per period
  const heatGrid=useMemo(()=>{
    const isAll=heatIds.includes("all");
    const evMatchesFilter=e=>isAll||heatIds.includes(e.labelId)||(e.autoTags||[]).some(t=>heatIds.includes(t));
    if(period==="day"){
      // 10-minute intervals: 144 cells
      const dayD=heatData[0]?.d||fmtDate(new Date());
      const dayEvsFull=getForDate(events,dayD).filter(e=>isDoneOn(e,dayD)&&evMatchesFilter(e)&&e.startTime);
      const slots=Array.from({length:144},(_,i)=>{
        const slotStart=i*10; // minutes from midnight
        const slotEnd=slotStart+10;
        // Find all events whose time range COVERS this slot (not just start in slot)
        const hEvs=dayEvsFull.filter(e=>{
          const eStart=parseMins(e.startTime);
          const eEnd=e.endTime?parseMins(e.endTime):eStart+60;
          const eEndAdj=eEnd<=eStart?eEnd+1440:eEnd; // handle overnight
          return eStart<slotEnd&&eEndAdj>slotStart;
        });
        // Dominant label = label with longest duration among covering tasks
        const byLabel={};
        hEvs.forEach(e=>{byLabel[e.labelId]=(byLabel[e.labelId]||0)+getDur(e);});
        let domLabel=null,domMins=0;
        Object.entries(byLabel).forEach(([lid,m])=>{if(m>domMins){domMins=m;domLabel=lid;}});
        const mins=hEvs.reduce((s,e)=>s+getDur(e),0);
        const h=Math.floor(slotStart/60),m=slotStart%60;
        return{i,slotStart,h,m,mins:hEvs.length>0?10:0,domLabel,hasActivity:hEvs.length>0,totalMins:mins,d:dayD};
      });
      return{type:"hour",cells:slots,cols:24,rows:6,cellSize:11};
    }
    if(period==="week"){
      // 7 days x 24 hours grid — rows=days, cols=hours
      const weekStart=new Date(new Date());weekStart.setDate(weekStart.getDate()-weekStart.getDay()-offset*7);
      const cells=[];
      for(let day=0;day<7;day++){
        const d=addDays(weekStart,day);const ds=fmtDate(d);
        const dayEvsAll=getForDate(events,ds,{includeUnscheduled:false}).filter(e=>isDoneOn(e,ds)&&evMatchesFilter(e)&&e.startTime);
        for(let h=0;h<24;h++){
          const hStart=h*60,hEnd=(h+1)*60;
          // Events that cover this hour slot
          const hEvs=dayEvsAll.filter(e=>{
            const eStart=parseMins(e.startTime);
            const eEnd=e.endTime?parseMins(e.endTime):eStart+60;
            const eEndAdj=eEnd<=eStart?eEnd+1440:eEnd;
            return eStart<hEnd&&eEndAdj>hStart;
          });
          const byLabel={};
          hEvs.forEach(e=>{byLabel[e.labelId]=(byLabel[e.labelId]||0)+getDur(e);});
          let domLabel=null,domMins=0;
          Object.entries(byLabel).forEach(([lid,m])=>{if(m>domMins){domMins=m;domLabel=lid;}});
          const mins=hEvs.reduce((s,e)=>s+getDur(e),0);
          cells.push({d:ds,h,mins,domLabel,day,col:h});
        }
      }
      return{type:"week",cells,cols:24,rows:7,cellSize:11};
    }
    if(period==="month"){
      // days of month: 7 cols (weeks), rows = weeks
      const base=new Date(new Date().getFullYear(),new Date().getMonth()-offset,1);
      const daysInMonth=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
      const firstDow=base.getDay();
      const totalCells=Math.ceil((firstDow+daysInMonth)/7)*7;
      const cells=[];
      for(let i=0;i<totalCells;i++){
        const dayNum=i-firstDow;
        if(dayNum<0||dayNum>=daysInMonth){cells.push(null);continue;}
        const d=new Date(base.getFullYear(),base.getMonth(),dayNum+1);
        const ds=fmtDate(d);
        const item=heatData[dayNum]||{d:ds,mins:0,domLabel:null};
        cells.push({...item,col:i%7,row:Math.floor(i/7)});
      }
      const rows=Math.ceil(totalCells/7);
      return{type:"month",cells,cols:7,rows,cellSize:34};
    }
    // year: 53 weeks x 7 days
    const cells=heatData.map((item,i)=>({...item,col:Math.floor(i/7),row:i%7}));
    return{type:"year",cells,cols:Math.ceil(heatData.length/7),rows:7,cellSize:11};
  },[period,heatData,events,heatIds,offset]);

  return <div style={{flex:1,overflowY:"auto",padding:"14px 16px 100px"}}>
    <div style={{display:"flex",background:"#f2f2f7",borderRadius:10,padding:2,gap:2,marginBottom:10}}>
      {[["day","天"],["week","周"],["month","月"],["year","年"]].map(([v,l])=><button key={v} onClick={()=>{setPeriod(v);setOffset(0);}} style={{flex:1,padding:"7px 0",border:"none",borderRadius:8,background:period===v?"white":"transparent",fontWeight:period===v?700:400,fontSize:13,cursor:"pointer",boxShadow:period===v?"0 1px 4px rgba(0,0,0,0.08)":"",textAlign:"center"}}>{l}</button>)}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:20,fontWeight:800,color:"#111",lineHeight:"1.2"}}>{rLabel}</div>
        <div style={{fontSize:12,color:"#8e8e93",marginTop:2}}>{start===end?start:`${start} — ${end}`}</div>
      </div>
      <button onClick={()=>setOffset(p=>p+1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:"#555",WebkitTextFillColor:"#555",flexShrink:0,textAlign:"center"}}>‹</button>
      <button onClick={()=>setOffset(p=>Math.max(0,p-1))} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:offset===0?"#ccc":"#555",WebkitTextFillColor:offset===0?"#ccc":"#555",flexShrink:0,textAlign:"center"}}>›</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
      {[{l:"总日程",v:rangeEvs.length,u:"个"},{l:"总时长",v:fmtMins(grand),u:""},{l:"已完成",v:doneEvs.length,u:"个"},{l:"时间利用率",v:periodTotalMins>0?Math.round(grand/periodTotalMins*100)+"%":"—",u:""}].map((s,i)=><div key={i} style={{background:"white",borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93"}}>{s.l}</div>
        <div style={{fontSize:22,fontWeight:800,color:"#111",marginTop:3}}>{s.v}<span style={{fontSize:12,color:"#8e8e93",marginLeft:2}}>{s.u}</span></div>
      </div>)}
    </div>

    {lblStats.length>0&&<div style={{background:"white",borderRadius:20,padding:16,marginBottom:12,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:12}}>环状考察</div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Donut/></div>
      {lblStats.map(lb=>{
        const pct=(lb.total/grandSafe*100).toFixed(1);const isExp=expId===lb.id;
        return <div key={lb.id}>
          <div onClick={()=>setExpId(p=>p===lb.id?null:lb.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",cursor:"pointer",borderBottom:"1px solid #f8f8f8"}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:lb.color,flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:800,color:"#111",minWidth:44}}>{pct}%</span>
            <span style={{fontSize:14,flex:1,fontWeight:600}}>{lb.emoji} {lb.name}</span>
            <ChgBadge cur={lb.total} prev={lb.prevTotal}/>
            <span style={{fontSize:12,color:"#8e8e93",marginLeft:6}}>{fmtMins(lb.total)}</span>
            <span style={{fontSize:11,color:"#ccc",marginLeft:3}}>{isExp?"▲":"▼"}</span>
          </div>
          {(lb.children||[]).map(ch=><div key={ch.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0 5px 20px",borderBottom:"1px solid #f8f8f8"}}>
            <span style={{fontSize:11,color:"#aaa",fontWeight:700}}>#</span>
            <span style={{fontSize:12,flex:1,color:"#666"}}>{ch.emoji} {ch.name}</span>
            <ChgBadge cur={ch.mins} prev={ch.prevMins||0}/>
            <span style={{fontSize:11,color:"#8e8e93",marginLeft:6}}>{fmtMins(ch.mins)}</span>
          </div>)}
          {isExp&&<div style={{background:"#fafafa",borderRadius:12,padding:"8px 10px",marginBottom:6}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:7}}>关联任务 {lb.evs.length}个</div>
            {lb.evs.slice(0,15).map(ev=><div key={ev.id+(ev._d||"")} onClick={()=>setDetEv(ev)} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:lb.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.title}</div>
                <div style={{fontSize:11,color:"#8e8e93"}}>{ev._d||ev.date} {ev.allDay?"全天":(ev.startTime?(ev.startTime+(ev.endTime?` → ${ev.endTime}`:"")):"尚未安排")}</div>
              </div>
              <span style={{fontSize:11,color:"#8e8e93",flexShrink:0}}>{fmtMins(getDur(ev))}</span>
            </div>)}
            {lb.evs.length>15&&<div style={{fontSize:11,color:"#8e8e93",textAlign:"center",padding:"6px 0"}}>+ {lb.evs.length-15} 更多</div>}
          </div>}
        </div>;
      })}
    </div>}

    <div style={{background:"white",borderRadius:20,padding:16,marginBottom:12,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:8}}>热力图</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
        {[{id:"all",emoji:"🌐",name:"全部"},...flat].map(lb=>{
          const sel=heatIds.includes(lb.id);
          return <button key={lb.id} onClick={()=>{
            if(lb.id==="all"){setHeatIds(["all"]);return;}
            setHeatIds(prev=>{
              const filtered=prev.filter(x=>x!=="all");
              if(filtered.includes(lb.id)){
                const next=filtered.filter(x=>x!==lb.id);
                return next.length===0?["all"]:next;
              }
              return [...filtered,lb.id];
            });
          }} style={{padding:"5px 10px",border:`1.5px solid ${sel?(lb.color||"#333"):"#e5e7eb"}`,borderRadius:20,background:sel?(lb.color||"#333"):"white",color:sel?"white":"#555",cursor:"pointer",fontSize:12,fontWeight:sel?700:400,display:"flex",alignItems:"center",gap:4}}>
            <span>{lb.emoji}</span><span>{lb.name}</span>
          </button>;
        })}
      </div>

      {period==="day"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{display:"inline-block"}}>
        <div style={{display:"flex",gap:2,marginBottom:2,paddingLeft:24}}>
          {Array.from({length:24},(_,h)=><div key={h} style={{width:heatGrid.cellSize,flexShrink:0,fontSize:7,color:"#aaa",textAlign:"center"}}>{h%6===0?pad(h):""}</div>)}
        </div>
        {(()=>{return Array.from({length:6},(_,row)=>{
          const rowLabel=["00","10","20","30","40","50"][row];
          return <div key={row} style={{display:"flex",alignItems:"center",gap:2,marginBottom:2}}>
            <div style={{width:22,fontSize:9,color:"#8e8e93",flexShrink:0,textAlign:"right",paddingRight:2}}>:{rowLabel}</div>
            {heatGrid.cells.filter(c=>c.m===row*10).map((cell,i)=>{
              const domLb=cell.domLabel?flat.find(l=>l.id===cell.domLabel):null;
              const bg=heatCellColor(cell.domLabel,cell.hasActivity?cell.totalMins:0,"day_heat");
              return <div key={i} title={`${pad(cell.h)}:${pad(cell.m)} ${cell.hasActivity?(domLb?domLb.name:"活动"):"无活动"}`} style={{width:heatGrid.cellSize,height:heatGrid.cellSize,borderRadius:3,background:bg,flexShrink:0}}/>;
            })}
          </div>;
        })})()}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4,paddingLeft:24}}>
          <span style={{fontSize:9,color:"#aaa"}}>00:00</span>
          <span style={{fontSize:9,color:"#aaa"}}>12:00</span>
          <span style={{fontSize:9,color:"#aaa"}}>24:00</span>
        </div>
        </div>
      </div>}

      {/* Week view: 7 rows (days) x 24 cols (hours) */}
      {period==="week"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{display:"inline-block"}}>
        <div style={{display:"flex",gap:2,marginBottom:2,paddingLeft:24}}>
          {Array.from({length:24},(_,h)=><div key={h} style={{width:heatGrid.cellSize,flexShrink:0,fontSize:7,color:"#aaa",textAlign:"center"}}>{h%6===0?pad(h):""}</div>)}
        </div>
        {(()=>{return Array.from({length:7},(_,day)=>{
          const dayCells=heatGrid.cells.filter(c=>c.day===day);
          const dayLabel=dayCells[0]?.d?new Date(dayCells[0].d+"T00:00:00"):null;
          return <div key={day} style={{display:"flex",alignItems:"center",gap:2,marginBottom:2}}>
            <div style={{width:22,fontSize:9,color:"#8e8e93",flexShrink:0,textAlign:"right",paddingRight:2}}>{dayLabel?WDF[dayLabel.getDay()]:WDF[day]}</div>
            {dayCells.map((cell,i)=>{
              const bg=heatCellColor(cell.domLabel,cell.mins,"week");
              return <div key={i} title={`${cell.d} ${pad(cell.h)}:00 ${fmtMins(cell.mins)}`} style={{width:heatGrid.cellSize,height:heatGrid.cellSize,borderRadius:3,background:bg,flexShrink:0}}/>;
            })}
          </div>;
        })})()}
        </div>
      </div>}

      {/* Month view: 2 days per row, each day has hourly cells (2h/cell on mobile) */}
      {period==="month"&&(()=>{
        const base=new Date(new Date().getFullYear(),new Date().getMonth()-offset,1);
        const daysInMonth=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
        const GAP=2;
        const isMobile=window.innerWidth<768;
        // On mobile: 12 cells per day (2h each); on desktop: 24 cells per day (1h each)
        const numCells=isMobile?12:24;
        const hoursPerCell=isMobile?2:1;
        // Responsive: compute available width
        const availW=Math.min(window.innerWidth-32, 560);
        // Each row: 2 groups of [dayLabel(22px)] + [numCells cells] + gap(6px) between groups
        const CS=Math.max(7, Math.min(14, Math.floor((availW - 50 - 2*(numCells-1)*GAP) / (numCells*2))));
        const isOdd=daysInMonth%2===1;
        return <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div style={{display:"inline-block",maxWidth:"100%"}}>
            {/* Header: two sets of cell labels */}
            <div style={{display:"flex",gap:6,marginBottom:2}}>
              {[0,1].map(col=>(
                <div key={col} style={{display:"flex",gap:GAP,paddingLeft:22}}>
                  {Array.from({length:numCells},(_,ci)=>{
                    const h=ci*hoursPerCell;
                    const showLabel=isMobile?(ci%3===0):(ci%6===0);
                    return <div key={ci} style={{width:CS,flexShrink:0,fontSize:7,color:"#aaa",textAlign:"center"}}>{showLabel?pad(h)+"h":""}</div>;
                  })}
                </div>
              ))}
            </div>
            {/* Rows: 2 days per row */}
            {Array.from({length:Math.ceil(daysInMonth/2)},(_,rowIdx)=>{
              const daysInRow=(rowIdx===Math.floor(daysInMonth/2)&&isOdd)?1:2;
              return <div key={rowIdx} style={{display:"flex",gap:6,marginBottom:GAP}}>
                {Array.from({length:daysInRow},(_,col)=>{
                  const di=rowIdx*2+col;
                  const d=new Date(base.getFullYear(),base.getMonth(),di+1);
                  const ds=fmtDate(d);
                  const dayEvs=getForDate(events,ds,{includeUnscheduled:false}).filter(e=>isDoneOn(e,ds)&&e.startTime);
                  const isHeatIsAll=heatIds.includes("all");
                  const filtEvs=isHeatIsAll?dayEvs:dayEvs.filter(e=>heatIds.includes(e.labelId)||(e.autoTags||[]).some(t=>heatIds.includes(t)));
                  return <div key={col} style={{display:"flex",alignItems:"center",gap:GAP}}>
                    <div style={{width:22,fontSize:9,color:"#8e8e93",flexShrink:0,textAlign:"right",paddingRight:2}}>{di+1}</div>
                    {Array.from({length:numCells},(_,ci)=>{
                      const hStart=ci*hoursPerCell*60,hEnd=(ci+1)*hoursPerCell*60;
                      const hEvs=filtEvs.filter(e=>{
                        const eStart=parseMins(e.startTime);
                        const eEnd=e.endTime?parseMins(e.endTime):eStart+60;
                        const eEndAdj=eEnd<=eStart?eEnd+1440:eEnd;
                        return eStart<hEnd&&eEndAdj>hStart;
                      });
                      const byLb={};hEvs.forEach(e=>{byLb[e.labelId]=(byLb[e.labelId]||0)+getDur(e);});
                      let domLb=null,domM=0;Object.entries(byLb).forEach(([lid,m])=>{if(m>domM){domM=m;domLb=lid;}});
                      const mins=hEvs.reduce((s,e)=>s+getDur(e),0);
                      const bg=heatCellColor(domLb,hEvs.length>0?Math.max(10,mins):0,"month");
                      return <div key={ci} style={{width:CS,height:CS,borderRadius:2,background:bg,flexShrink:0}}/>;
                    })}
                  </div>;
                })}
              </div>;
            })}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,paddingLeft:22}}>
              <span style={{fontSize:9,color:"#aaa"}}>00:00</span>
              <span style={{fontSize:9,color:"#aaa"}}>{isMobile?"12:00":"12:00"}</span>
              <span style={{fontSize:9,color:"#aaa"}}>24:00</span>
            </div>
          </div>
        </div>;
      })()}

      {/* Year view: 12 months x days grid, responsive cell size, centered */}
      {period==="year"&&(()=>{
        const yr=new Date().getFullYear()-offset;
        const GAP=2,labelW=20,labelGap=4,maxDayCols=31;
        // Compute available width from container (padding 16px each side = 32px total)
        const availW=Math.min(window.innerWidth-32, 600)-(labelW+labelGap);
        // CS = floor((availW - 30*GAP) / 31), capped at 11
        const CS=Math.min(11, Math.floor((availW-maxDayCols*GAP)/maxDayCols));
        const gridW=maxDayCols*CS+(maxDayCols-1)*GAP;
        return <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div>
            {/* Day number header */}
            <div style={{display:"flex",alignItems:"center",gap:labelGap,marginBottom:GAP}}>
              <div style={{width:labelW,flexShrink:0}}/>
              <div style={{width:gridW,display:"flex",gap:GAP}}>
                {Array.from({length:maxDayCols},(_,di)=>(
                  <div key={di} style={{width:CS,flexShrink:0,fontSize:7,color:"#aaa",textAlign:"center"}}>{[1,5,10,15,20,25,30].includes(di+1)?(di+1):""}</div>
                ))}
              </div>
            </div>
            {Array.from({length:12},(_,mi)=>{
              const daysInM=new Date(yr,mi+1,0).getDate();
              return <div key={mi} style={{display:"flex",alignItems:"center",gap:labelGap,marginBottom:GAP}}>
                <div style={{width:labelW,fontSize:9,color:"#8e8e93",flexShrink:0,textAlign:"right"}}>{MONTHS[mi].slice(0,2)}</div>
                <div style={{width:gridW,display:"flex",gap:GAP}}>
                  {Array.from({length:daysInM},(_,di)=>{
                    const ds=`${yr}-${pad(mi+1)}-${pad(di+1)}`;
                    const item=heatData.find(h=>h.d===ds)||{mins:0,domLabel:null};
                    const bg=heatCellColor(item.domLabel,item.mins,"year");
                    return <div key={di} title={`${ds}: ${fmtMins(item.mins)}`} style={{width:CS,height:CS,borderRadius:3,background:bg,flexShrink:0}}/>;
                  })}
                </div>
              </div>;
            })}
          </div>
        </div>;
      })()}

      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:10,justifyContent:"center"}}>
        <span style={{fontSize:10,color:"#8e8e93"}}>{(period==="day"||period==="week")?"0":"0h"}</span>
        {[0.18,0.36,0.55,0.73,1].map((a,i)=><div key={i} style={{width:12,height:12,borderRadius:3,background:`rgba(${legendR},${legendG},${legendB},${a})`}}/>)}
        <span style={{fontSize:10,color:"#8e8e93"}}>{(period==="day"||period==="week")?"60m":"2h+"}</span>
      </div>
    </div>

    {/* ── Bar + Line combo chart ── */}
    {(()=>{
      // Build daily data for the selected period
      const chartDays=[];
      let cStart;
      if(period==="day"){cStart=addDays(new Date(),-offset);}
      else if(period==="week"){const s=new Date();s.setDate(s.getDate()-s.getDay()-offset*7);cStart=s;}
      else if(period==="month"){cStart=new Date(new Date().getFullYear(),new Date().getMonth()-offset,1);}
      else{cStart=new Date(new Date().getFullYear()-offset,0,1);}
      const cDays=period==="year"?365:period==="month"?new Date(cStart.getFullYear(),cStart.getMonth()+1,0).getDate():period==="week"?7:1;
      for(let i=0;i<cDays;i++){const d=addDays(cStart,i);const ds=fmtDate(d);chartDays.push({ds,d});}

      // Group by label for stacking, and compute total per day
      const barData=chartDays.map(({ds})=>{
        const dayEvs=getForDate(events,ds,{includeUnscheduled:false}).filter(e=>isDoneOn(e,ds));
        const byLb={};
        dayEvs.forEach(e=>{byLb[e.labelId]=(byLb[e.labelId]||0)+getDur(e);});
        const total=Object.values(byLb).reduce((s,v)=>s+v,0);
        return{ds,byLb,total};
      });

      // For day view: build hourly breakdown
      const hourData=(period==="day")?Array.from({length:24},(_,h)=>{
        const ds=fmtDate(cStart);
        const dayEvs=getForDate(events,ds,{includeUnscheduled:false}).filter(e=>isDoneOn(e,ds)&&e.startTime);
        const hStart=h*60,hEnd=(h+1)*60;
        const hEvs=dayEvs.filter(e=>{
          const eStart=parseMins(e.startTime);
          const eEnd=e.endTime?parseMins(e.endTime):eStart+60;
          const eEndAdj=eEnd<=eStart?eEnd+1440:eEnd;
          return eStart<hEnd&&eEndAdj>hStart;
        });
        const byLb={};hEvs.forEach(e=>{byLb[e.labelId]=(byLb[e.labelId]||0)+getDur(e);});
        const total=hEvs.reduce((s,e)=>s+getDur(e),0);
        return{label:`${pad(h)}`,total,byLb,ds};
      }):null;

      // Aggregate by week for year view, by day otherwise
      const aggData=(()=>{
        if(period==="day") return hourData;
        if(period==="year"){
          const weeks=[];
          for(let wi=0;wi<53;wi++){
            const slice=barData.slice(wi*7,(wi+1)*7);
            if(slice.length===0) break;
            const total=slice.reduce((s,d)=>s+d.total,0);
            const byLb={};
            slice.forEach(d=>Object.entries(d.byLb).forEach(([lid,m])=>{byLb[lid]=(byLb[lid]||0)+m;}));
            const wkStart=slice[0].ds;const wk=new Date(wkStart+"T00:00:00");
            weeks.push({label:`W${wi+1}`,total,byLb,ds:wkStart});
          }
          return weeks;
        }
        return barData.map(({ds,total,byLb})=>{
          const d=new Date(ds+"T00:00:00");
          const label=period==="week"?WDF[d.getDay()]:period==="month"?`${d.getDate()}`:`${pad(d.getHours())}:00`;
          return{label,total,byLb,ds};
        });
      })();

      if(aggData.length===0) return null;
      const maxVal=Math.max(...aggData.map(d=>d.total),1);
      const H=100; // chart height px
      const W_ITEM=Math.max(4,Math.min(28,Math.floor(280/aggData.length)));
      const totalW=aggData.length*W_ITEM;
      // Top 3 labels for stacked bars
      const topLbs=lblStats.slice(0,4);

      // Moving average for line (3-point)
      const ma=aggData.map((d,i)=>{
        const vals=[aggData[i-1],aggData[i],aggData[i+1]].filter(Boolean).map(x=>x.total);
        return vals.reduce((s,v)=>s+v,0)/vals.length;
      });

      const svgW=totalW+32+(period==="day"?20:0);
      const svgH=H+28;

      return <div style={{background:"white",borderRadius:20,padding:"16px 16px 12px",marginBottom:12,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}}>
        <div style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:8}}>时长分布</div>
        <div style={{overflowX:"auto"}} className="hide-scrollbar">
          <svg width={svgW} height={svgH} style={{display:"block",margin:"0 auto"}}>
            {/* Y grid lines */}
            {[0.25,0.5,0.75,1].map(f=>{
              const y=H*(1-f)+4;
              return <line key={f} x1={24} x2={svgW} y1={y} y2={y} stroke="#f0f0f0" strokeWidth={1}/>;
            })}
            {/* Bars */}
            {aggData.map((d,i)=>{
              const x=24+i*W_ITEM;
              let stackY=H+4;
              return <g key={i}>
                {topLbs.length>0?topLbs.map(lb=>{
                  const m=d.byLb[lb.id]||0;
                  if(!m) return null;
                  const bh=Math.max(1,(m/maxVal)*H);
                  stackY-=bh;
                  return <rect key={lb.id} x={x+1} y={stackY} width={Math.max(2,W_ITEM-2)} height={bh} fill={lb.color} opacity={0.75} rx={2}/>;
                }):<rect x={x+1} y={H+4-(d.total/maxVal)*H} width={Math.max(2,W_ITEM-2)} height={(d.total/maxVal)*H} fill="#8e8e93" opacity={0.5} rx={2}/>}
              </g>;
            })}
            {/* Line (moving average) */}
            <polyline
              points={ma.map((v,i)=>`${24+i*W_ITEM+W_ITEM/2},${H+4-(v/maxVal)*H}`).join(" ")}
              fill="none" stroke="#333" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7}/>
            {/* Dots */}
            {ma.map((v,i)=><circle key={i} cx={24+i*W_ITEM+W_ITEM/2} cy={H+4-(v/maxVal)*H} r={2} fill="#333" opacity={0.7}/>)}
            {/* X labels — show every Nth */}
            {aggData.map((d,i)=>{
              const step=period==="day"?3:(aggData.length<=7?1:aggData.length<=14?2:aggData.length<=31?5:7);
              if(i%step!==0) return null;
              const xLabel=period==="day"?`${d.label}:00`:d.label;
              return <text key={i} x={24+i*W_ITEM+W_ITEM/2} y={svgH-2} textAnchor="middle" fontSize={8} fill="#aaa">{xLabel}</text>;
            })}
            {/* 24:00 end label for day view */}
            {period==="day"&&<text x={24+24*W_ITEM} y={svgH-2} textAnchor="middle" fontSize={8} fill="#aaa">24:00</text>}
            {/* Y labels */}
            {[0,0.5,1].map(f=><text key={f} x={22} y={H*(1-f)+4+3} textAnchor="end" fontSize={8} fill="#aaa">{fmtMins(Math.round(maxVal*f))}</text>)}
          </svg>
        </div>
        {topLbs.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
          {topLbs.map(lb=><div key={lb.id} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:8,height:8,borderRadius:2,background:lb.color,opacity:0.75}}/>
            <span style={{fontSize:10,color:"#666"}}>{lb.emoji} {lb.name}</span>
          </div>)}
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <svg width={16} height={8}><line x1={0} y1={4} x2={16} y2={4} stroke="#333" strokeWidth={1.5}/></svg>
            <span style={{fontSize:10,color:"#666"}}>移动平均</span>
          </div>
        </div>}
      </div>;
    })()}

    {detEv&&<Modal title="任务详情" onClose={()=>setDetEv(null)} width={400}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{getLb(detEv.labelId).emoji}</span>
          <div style={{fontSize:17,fontWeight:700}}>{detEv.title}</div>
        </div>
        <div style={{background:"#fafafa",borderRadius:12,overflow:"hidden"}}>
          <div style={{display:"flex",padding:"9px 14px",borderBottom:"1px solid #f0f0f0"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:50}}>日期</span>
            <span style={{fontSize:13}}>{detEv._d||detEv.date}</span>
          </div>
          <div style={{display:"flex",padding:"9px 14px",borderBottom:"1px solid #f0f0f0"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:50}}>时间</span>
            <span style={{fontSize:13}}>{detEv.allDay?"全天":(detEv.startTime||"尚未安排")+(detEv.endTime?` → ${detEv.endTime}`:"")}</span>
          </div>
          {getDur(detEv)>0&&<div style={{display:"flex",padding:"9px 14px",borderBottom:"1px solid #f0f0f0"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:50}}>时长</span>
            <span style={{fontSize:13,fontWeight:600,color:getLb(detEv.labelId).color}}>{fmtMins(getDur(detEv))}</span>
          </div>}
          <div style={{display:"flex",padding:"9px 14px"}}>
            <span style={{fontSize:12,color:"#8e8e93",width:50}}>标签</span>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[detEv.labelId,...(detEv.autoTags||[])].filter(Boolean).map(id=>{const lb=getLb(id);return <span key={id} style={{fontSize:11,background:lb.color+"22",color:lb.color,borderRadius:20,padding:"3px 8px",fontWeight:600}}>{lb.emoji} {lb.name}</span>;})}
            </div>
          </div>
        </div>
        {detEv.notes&&<div style={{background:"#fafafa",borderRadius:12,padding:"10px 14px",fontSize:13,color:"#555",lineHeight:1.6}}>{detEv.notes}</div>}
        <div style={{display:"flex",gap:8}}>
          {detEv.done&&<div style={{fontSize:13,color:"#555",fontWeight:600}}>✓ 已完成</div>}
          {detEv.repeat&&detEv.repeat!=="none"&&<div style={{fontSize:13,color:"#8e8e93"}}>↻ 重复</div>}
        </div>
        <button onClick={()=>{setDetEv(null);onOpen&&onOpen(detEv);}} style={{padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontWeight:700,fontSize:14,textAlign:"center"}}>编辑任务</button>
      </div>
    </Modal>}
  </div>;
}

/* ══════ REPEAT DELETE MODAL ══════ */
function RepeatDeleteModal({ev,instanceDate,onClose,onDelete}){
  const opts=[
    {key:"this",label:"仅删除当前任务",danger:false},
    {key:"before",label:"删除包括以前的全部任务",danger:false},
    {key:"after",label:"删除以后的所有任务（含当天）",danger:false},
    {key:"all",label:"删除所有任务",danger:true},
  ];
  const [sel,setSel]=useState("this");
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.36)",zIndex:4000,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <style>{`@media(min-height:600px) and (min-width:480px){.komu-del-sheet{border-radius:22px!important;margin:16px!important;max-height:92vh!important;align-self:center!important;}}`}</style>
    <div className="komu-del-sheet" style={{background:"white",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:440,padding:"20px 20px 32px",boxShadow:"0 -4px 40px rgba(0,0,0,0.18)",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <span style={{fontSize:17,fontWeight:700,color:"#111"}}>删除循环任务</span>
        <button onClick={onClose} style={{border:"none",background:"#f2f2f7",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14,color:"#666",textAlign:"center"}}>✕</button>
      </div>
      <div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",overflow:"hidden",marginBottom:14}}>
        {opts.map((o,i)=><button key={o.key} onClick={()=>setSel(o.key)}
          style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"13px 14px",border:"none",borderTop:i>0?"1px solid #f0f0f0":"none",background:sel===o.key?"#f5f5f5":"white",color:o.danger?"#FF3B30":"#111",fontSize:13,cursor:"pointer",textAlign:"left",gap:10}}>
          <span style={{flex:1,fontWeight:sel===o.key?600:400}}>{o.label}</span>
          {sel===o.key&&<svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l4 4 8-8" stroke={o.danger?"#FF3B30":"#333"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </button>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onClose} style={{flex:1,padding:"11px",border:"1.5px solid #e5e7eb",borderRadius:12,background:"white",cursor:"pointer",fontSize:14,fontWeight:600,color:"#555",textAlign:"center"}}>取消</button>
        <button onClick={()=>onDelete(sel)} style={{flex:2,padding:"11px",border:"none",borderRadius:12,background:sel==="all"?"#FF3B30":"#333",color:"white",cursor:"pointer",fontSize:14,fontWeight:700,textAlign:"center"}}>确认删除</button>
      </div>
    </div>
  </div>;
}

/* ══════ SIDEBAR ══════ */
function Sidebar({tab,setTab,labels,onManage,onReorder}){
  const dragSrc=useRef(null);
  const [dragOver,setDragOver]=useState(null);
  const handleDragStart=(e,idx)=>{dragSrc.current=idx;e.dataTransfer.effectAllowed="move";};
  const handleDragOver=(e,idx)=>{e.preventDefault();if(dragSrc.current!=null&&dragSrc.current!==idx)setDragOver(idx);};
  const handleDrop=(e,idx)=>{e.preventDefault();if(dragSrc.current==null){setDragOver(null);return;}const from=dragSrc.current;if(from!==idx&&onReorder){const next=[...labels];const [item]=next.splice(from,1);next.splice(idx,0,item);onReorder(next);}setDragOver(null);dragSrc.current=null;};
  const handleDragEnd=()=>{setDragOver(null);dragSrc.current=null;};
  // Touch long-press sort
  const tDrag=useRef({active:false,src:null,timer:null});
  const tStart=(e,idx)=>{tDrag.current.timer=setTimeout(()=>{tDrag.current.active=true;tDrag.current.src=idx;setDragOver(idx);if(navigator.vibrate)navigator.vibrate(30);},400);};
  const tMove=(e,idx)=>{if(!tDrag.current.active)return;e.preventDefault();const el=document.elementFromPoint(e.touches[0].clientX,e.touches[0].clientY);const r=el?.closest('[data-sb-idx]');if(r){const oi=parseInt(r.dataset.sbIdx,10);if(oi!==tDrag.current.src)setDragOver(oi);}};
  const tEnd=(e)=>{clearTimeout(tDrag.current.timer);if(tDrag.current.active&&onReorder){const from=tDrag.current.src,to=dragOver??from;if(from!==to){const next=[...labels];const [item]=next.splice(from,1);next.splice(to,0,item);onReorder(next);}}tDrag.current={active:false,src:null,timer:null};setDragOver(null);};
  const previewLabels=useMemo(()=>{
    if(dragSrc.current==null||dragOver==null) return null;
    const from=dragSrc.current,to=dragOver;
    if(from===to) return null;
    const next=[...labels];const [item]=next.splice(from,1);next.splice(to,0,item);
    return next;
  },[dragOver,labels]);
  const dispLabels=previewLabels||labels;
  return <div style={{width:240,background:"#f7f7f9",borderRight:"1px solid #ebebeb",display:"flex",flexDirection:"column",padding:"20px 0 16px",flexShrink:0,overflowY:"auto"}}>
    <div style={{padding:"0 16px 16px",borderBottom:"1px solid #ebebeb",marginBottom:12,flexShrink:0}}>
      <div style={{fontSize:17,fontWeight:900,color:"#111",letterSpacing:-0.5}}>日程</div>
      <div style={{fontSize:11,color:"#8e8e93"}}>Komuflow</div>
    </div>
    {[{id:"today",icon:"🏠",l:"今天"},{id:"calendar",icon:"📅",l:"日历"},{id:"stats",icon:"📊",l:"统计"}].map(n=><button key={n.id} onClick={()=>setTab(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",border:"none",background:tab===n.id?"#e5e5ea":"transparent",cursor:"pointer",textAlign:"left",justifyContent:"flex-start",width:"100%",borderRadius:0,color:tab===n.id?"#111":"#555",WebkitTextFillColor:tab===n.id?"#111":"#555",fontWeight:tab===n.id?700:400,fontSize:14}}><span>{n.icon}</span>{n.l}</button>)}
    <div style={{margin:"16px 16px 0"}}>
      <div style={{fontSize:10,fontWeight:700,color:"#8e8e93",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>标签</div>
      {dispLabels.map((lb,idx)=><div key={lb.id}
        draggable
        data-sb-idx={idx}
        onDragStart={e=>handleDragStart(e,idx)}
        onDragOver={e=>handleDragOver(e,idx)}
        onDrop={e=>handleDrop(e,idx)}
        onDragEnd={handleDragEnd}
        onTouchStart={e=>tStart(e,idx)}
        onTouchMove={e=>tMove(e,idx)}
        onTouchEnd={tEnd}
        style={{opacity:dragSrc.current===idx&&!previewLabels?0.4:1,borderRadius:7,transition:"opacity 0.15s",outline:dragOver===idx&&dragSrc.current!==idx?"2px solid #007AFF":"none"}}>
        <button onClick={()=>onManage(lb.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 6px",width:"100%",border:"none",background:"none",borderRadius:7,cursor:"pointer",textAlign:"left"}}>
          <span style={{fontSize:11,color:"#c0c0c0",marginRight:2}}>⠿</span>
          <div style={{width:8,height:8,borderRadius:"50%",background:lb.color,flexShrink:0}}/>
          <span style={{fontSize:13,color:"#333",fontWeight:500}}>{lb.emoji} {lb.name}</span>
        </button>
        {(lb.children||[]).map(ch=><button key={ch.id} onClick={()=>onManage(lb.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 6px 4px 22px",width:"100%",border:"none",background:"none",borderRadius:7,cursor:"pointer",textAlign:"left"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:ch.color,flexShrink:0}}/>
          <span style={{fontSize:12,color:"#666"}}>{ch.emoji} {ch.name}</span>
        </button>)}
      </div>)}
    </div>
  </div>;
}

/* ══════ APP ROOT ══════ */
export default function App(){
  const [events,setEvents]=useStore("cfpx_ev",makeSamples());
  const [labels,setLabels]=useStore("cfpx_lb",DEF_LABELS);
  const [tab,setTab]=useState("today");
  const [modal,setModal]=useState(null);
  const bp=useBP();const desk=bp==="desktop";
  const [repeatDel,setRepeatDel]=useState(null);
  const openEv=(ev,instanceDate)=>setModal({t:"edit",ev,instanceDate:instanceDate||ev.date});
  const addEv=(date,hour)=>setModal({t:"add",date,hour});
  const toggleDone=(id,dateStr)=>setEvents(p=>p.map(e=>{
    if(e.id!==id) return e;
    const isRepeat=e.repeat&&e.repeat!=="none";
    if(!isRepeat) return {...e,done:!e.done};
    // For repeat tasks, toggle per-date in doneOverrides map
    const overrides={...(e.doneOverrides||{})};
    const ds=dateStr||todayStr();
    overrides[ds]=!overrides[ds];
    return {...e,doneOverrides:overrides};
  }));
  const [notifPerm, askNotifPerm] = useNotifPermission();
  // Re-schedule notifications whenever events change
  useEffect(() => { rescheduleAll(events); }, [events]);

  const saveEv=ev=>{
    const tags=autoTag(ev,labels);
    const fin={...ev,autoTags:tags};
    const key=fin._repeatSaveKey;
    delete fin._repeatSaveKey;
    // Not a repeat-scope save — just upsert normally
    if(!key){
      setEvents(p=>p.some(e=>e.id===fin.id)?p.map(e=>e.id===fin.id?fin:e):[...p,fin]);
      setModal(null);
      return;
    }
    const instanceDate=fin.date; // the date of the instance being edited
    setEvents(p=>{
      if(key==="all"){
        // Replace the master event entirely (keep id, repeat config)
        return p.map(e=>e.id===fin.id?fin:e);
      }
      if(key==="this"){
        // Exclude this date from the master, add a new one-off event for this date
        const exceptions=[...(p.find(e=>e.id===fin.id)?.exceptions||[]),instanceDate];
        const master=p.map(e=>e.id===fin.id?{...e,exceptions}:e);
        // Only keep endDate if it's truly a cross-day span (endDate > instanceDate)
        const oneOffEndDate=(fin.endDate&&fin.endDate>instanceDate)?fin.endDate:undefined;
        const oneOff={...fin,id:uuid(),repeat:"none",repeatDays:[],repeatStart:undefined,repeatEnd:undefined,exceptions:undefined,endDate:oneOffEndDate};
        return [...master,oneOff];
      }
      if(key==="after"){
        // Truncate master to end the day before, create new repeat event from this date
        // Preserve the master's original repeatEnd in the new series (don't default to "永久")
        const masterEv=p.find(e=>e.id===fin.id);
        const inheritedRepeatEnd=masterEv?.repeatEnd||undefined;
        const before=fmtDate(addDays(new Date(instanceDate+"T00:00:00"),-1));
        const master=p.map(e=>e.id===fin.id?{...e,repeatEnd:before}:e);
        const newRepeat={...fin,id:uuid(),date:instanceDate,repeatStart:instanceDate,repeatEnd:inheritedRepeatEnd,exceptions:undefined};
        return [...master,newRepeat];
      }
      return p;
    });
    setModal(null);
  };

  // Smart delete: repeat tasks show choice sheet, others delete immediately
  const handleDelete=(ev,instanceDate)=>{
    if(ev&&ev.repeat&&ev.repeat!=="none"){
      setRepeatDel({ev,instanceDate:instanceDate||ev.date});
      setModal(null);
    } else {
      setEvents(p=>p.filter(e=>e.id!==(ev?.id||ev)));
      setModal(null);
    }
  };

  const execRepeatDelete=(key)=>{
    if(!repeatDel) return;
    const {ev,instanceDate}=repeatDel;
    setEvents(p=>{
      if(key==="all") return p.filter(e=>e.id!==ev.id);
      if(key==="this"){
        const exceptions=[...(ev.exceptions||[]),instanceDate];
        return p.map(e=>e.id===ev.id?{...e,exceptions}:e);
      }
      if(key==="before"){
        const after=fmtDate(addDays(new Date(instanceDate+"T00:00:00"),1));
        return p.map(e=>e.id===ev.id?{...e,repeatStart:after}:e);
      }
      if(key==="after"){
        const before=fmtDate(addDays(new Date(instanceDate+"T00:00:00"),-1));
        return p.map(e=>e.id===ev.id?{...e,repeatEnd:before}:e);
      }
      return p;
    });
    setRepeatDel(null);
  };

  // For EventForm delete button — pass the full ev object from modal
  const delEv=id=>{
    const ev=modal?.ev;
    if(ev) handleDelete(ev, modal?.instanceDate||ev.date);
    else { setEvents(p=>p.filter(e=>e.id!==id)); setModal(null); }
  };

  // Inline repeat delete: called directly from EventForm with a chosen key
  const inlineRepeatDelete=(key)=>{
    const ev=modal?.ev; if(!ev) return;
    const instanceDate=modal?.instanceDate||ev.date;
    setEvents(p=>{
      if(key==="all") return p.filter(e=>e.id!==ev.id);
      if(key==="this"){const exceptions=[...(ev.exceptions||[]),instanceDate];return p.map(e=>e.id===ev.id?{...e,exceptions}:e);}
      if(key==="before"){const after=fmtDate(addDays(new Date(instanceDate+"T00:00:00"),1));return p.map(e=>e.id===ev.id?{...e,repeatStart:after}:e);}
      if(key==="after"){const before=fmtDate(addDays(new Date(instanceDate+"T00:00:00"),-1));return p.map(e=>e.id===ev.id?{...e,repeatEnd:before}:e);}
      return p;
    });
    setModal(null);
  };

  const syncStatus = useSyncStatus();
  const SyncDot = () => {
    const cfg = {
      init: {color:"#8e8e93", title:"连接中…", pulse:true},
      ok:   {color:"#34C759", title:"已同步", pulse:false},
      saving:{color:"#FF9500", title:"同步中…", pulse:true},
      error:{color:"#FF3B30", title:"同步失败（离线模式）", pulse:false},
    }[syncStatus] || {color:"#8e8e93", title:"", pulse:false};
    return <div title={cfg.title} style={{width:7,height:7,borderRadius:"50%",background:cfg.color,flexShrink:0,boxShadow:cfg.pulse?"0 0 0 2px "+cfg.color+"44":"none",transition:"background 0.4s"}}/>;
  };
  const TN={today:"今天",calendar:"日历",stats:"统计"};

  const mobileNav = !desk && <div style={{flexShrink:0,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",borderTop:"1px solid #ebebeb",display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",padding:"4px 0 8px"}}>
    {[{id:"today",icon:"🏠",l:"今天"},{id:"calendar",icon:"📅",l:"即将"},{id:"stats",icon:"📊",l:"统计"}].map(n=><button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",padding:"0 4px",WebkitTapHighlightColor:"transparent"}}>
      <div style={{width:"100%",borderRadius:12,background:tab===n.id?"#e5e5ea":"transparent",padding:"5px 0 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"background 0.15s"}}>
        <span style={{fontSize:22,lineHeight:"1.2",color:tab===n.id?"#111":"#8e8e93"}}>{n.icon}</span>
        <span style={{fontSize:11,lineHeight:"1.3",fontWeight:tab===n.id?700:400,color:tab===n.id?"#111":"#8e8e93"}}>{n.l}</span>
      </div>
    </button>)}
    </div>
  </div>;

  const page=<div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
    {!desk&&<div style={{padding:"14px 18px 6px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:24,fontWeight:900,color:"#111",letterSpacing:-0.5}}>{TN[tab]}</div><SyncDot/></div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setModal({t:"labels"})} style={{border:"1.5px solid #e8e8e8",background:"white",borderRadius:10,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#555",textAlign:"center"}}>标签</button>
        {tab!=="today"&&tab!=="stats"&&<button onClick={()=>addEv(todayStr(),9)} style={{border:"none",background:"#333",borderRadius:10,padding:"6px 12px",fontSize:12,color:"white",cursor:"pointer",fontWeight:600,textAlign:"center"}}>+ 新建</button>}
      </div>
    </div>}
    <div style={{flex:1,minHeight:0,display:tab==="today"?"flex":"none",flexDirection:"column",overflow:"hidden"}}><TodayPage events={events} labels={labels} onOpen={openEv} onAdd={addEv} onToggle={toggleDone} onDelete={handleDelete}/></div>
    <div style={{flex:1,minHeight:0,display:tab==="calendar"?"flex":"none",flexDirection:"column",overflow:"hidden"}}><CalendarPage events={events} labels={labels} onOpen={openEv} onAdd={addEv}/></div>
    <div style={{flex:1,minHeight:0,display:tab==="stats"?"flex":"none",flexDirection:"column",overflow:"hidden"}}><StatsPage events={events} labels={labels} onOpen={openEv}/></div>
  </div>;

  return <div style={{fontFamily:"-apple-system,'Helvetica Neue',sans-serif",position:"fixed",inset:0,display:"flex",flexDirection:"column",overflow:"hidden",background:"white",textAlign:"left"}}>
    <style>{`html,body{margin:0;padding:0;height:100%;overflow:hidden;}*{box-sizing:border-box;text-align:left;}body,div,span,p,button,input,textarea,select{line-height:1.4;}::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:3px;}input[type=date],input[type=time]{-webkit-appearance:none;}.hide-scrollbar::-webkit-scrollbar{display:none;}input::placeholder,textarea::placeholder{color:#c0c0c0!important;-webkit-text-fill-color:#c0c0c0!important;}@media(max-width:767px){input,textarea,select{font-size:16px!important;-webkit-text-size-adjust:100%;}}button{-webkit-appearance:none;appearance:none;font-family:inherit;color:inherit;-webkit-text-fill-color:unset;text-align:left;}input,textarea{color:#111;-webkit-text-fill-color:#111;}select{color:#333;-webkit-text-fill-color:#333;}.day-date-num{font-size:30px;font-weight:700;color:#111;letter-spacing:-1px;}@media(min-width:768px){.day-date-num{font-size:22px;letter-spacing:-0.5px;}}.form-date-input{font-size:13px!important;}@media(min-width:768px){.form-date-input{font-size:11px!important;}}.time-picker-selected{font-size:18px!important;}@media(min-width:768px){.time-picker-selected{font-size:13px!important;}}.time-picker-unselected{font-size:14px!important;}@media(min-width:768px){.time-picker-unselected{font-size:10px!important;}}.color-hex-input{font-size:13px!important;}@media(min-width:768px){.color-hex-input{font-size:11px!important;}}.notes-textarea{font-size:14px!important;}@media(max-width:767px){.notes-textarea{font-size:16px!important;}}.label-sort-item{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;}`}</style>
    {desk
      ? <div style={{flex:1,display:"flex",flexDirection:"row",overflow:"hidden",minHeight:0}}>
          <Sidebar tab={tab} setTab={setTab} labels={labels} onManage={(labelId)=>setModal({t:"labels",labelId})} onReorder={ls=>setLabels(ls)}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{height:48,borderBottom:"1px solid #ebebeb",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:15,fontWeight:700}}>{TN[tab]}</span><SyncDot/></div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setModal({t:"labels"})} style={{border:"1.5px solid #e8e8e8",background:"white",borderRadius:10,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#555",textAlign:"center"}}>管理标签</button>
                {tab!=="today"&&tab!=="stats"&&<button onClick={()=>addEv(todayStr(),9)} style={{border:"none",background:"#333",borderRadius:10,padding:"6px 14px",fontSize:12,color:"white",cursor:"pointer",fontWeight:600,textAlign:"center"}}>+ 新建</button>}
              </div>
            </div>
            {page}
          </div>
        </div>
      : <><div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>{page}</div>{mobileNav}</>
    }
    {/* 新建任务弹窗 — Modal title hidden to avoid duplicate close button; EventForm内部不再有close按钮 */}
    {modal?.t==="add"&&<Modal title="新建事项" onClose={()=>setModal(null)}>
      <EventForm labels={labels} onSave={saveEv} onDelete={delEv} onClose={()=>setModal(null)} initialDate={modal.date} initialHour={modal.hour}/>
    </Modal>}
    {modal?.t==="edit"&&<Modal title="编辑事项" onClose={()=>setModal(null)}>
      <EventForm ev={modal.ev} instanceDate={modal.instanceDate} labels={labels} onSave={saveEv} onDelete={delEv} onRepeatDelete={inlineRepeatDelete} onClose={()=>setModal(null)}/>
    </Modal>}
    {modal?.t==="labels"&&<Modal title="管理标签" onClose={()=>setModal(null)} width={520}><LabelManager labels={labels} initialLabelId={modal.labelId} onSave={(ls,noClose)=>{setLabels(ls);if(!noClose)setModal(null);}}/></Modal>}
    {repeatDel&&<RepeatDeleteModal ev={repeatDel.ev} instanceDate={repeatDel.instanceDate} onClose={()=>setRepeatDel(null)} onDelete={execRepeatDelete}/>}
  </div>;
}
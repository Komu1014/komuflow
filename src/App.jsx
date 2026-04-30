import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
const uuid = () => Math.random().toString(36).slice(2,10);
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

/* ── storage ── */
function useStore(key,def){
  const [v,set]=useState(()=>{try{const s=localStorage.getItem(key);return s?JSON.parse(s):def;}catch{return def;}});
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(v));}catch{};},[key,v]);
  return [v,set];
}

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
  if(ev.endDate && ev.endDate !== ev.date){
    return ds >= ev.date && ds <= ev.endDate;
  }
  if(!ev.repeat||ev.repeat==="none") return ev.date===ds;
  const base=new Date(ev.date),tgt=new Date(ds);
  if(tgt<base) return false;
  if(ev.repeat==="daily") return true;
  if(ev.repeat==="weekly"){const dow=tgt.getDay();return ev.repeatDays?.length>0?ev.repeatDays.includes(dow):dow===base.getDay();}
  if(ev.repeat==="monthly") return tgt.getDate()===base.getDate();
  if(ev.repeat==="yearly") return tgt.getDate()===base.getDate()&&tgt.getMonth()===base.getMonth();
  return false;
}

const getForDate=(evs,ds)=>evs.filter(e=>occursOn(e,ds));
const getDur=(ev)=>{if(ev.allDay||!ev.startTime||!ev.endTime)return 0;const d=parseMins(ev.endTime)-parseMins(ev.startTime);return d<=0?d+1440:d;};
const flattenLabels=ls=>{const r=[];ls.forEach(l=>{r.push(l);(l.children||[]).forEach(c=>r.push({...c,_parent:l.id}));});return r;};
function useBP(){const [bp,set]=useState(()=>window.innerWidth<768?"phone":window.innerWidth<1100?"tablet":"desktop");useEffect(()=>{const h=()=>set(window.innerWidth<768?"phone":window.innerWidth<1100?"tablet":"desktop");window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);return bp;}

/* ── shared styles ── */
const INP={border:"1.5px solid #EBEBEB",borderRadius:10,padding:"8px 11px",fontSize:14,outline:"none",background:"white"};
const PRESETS=["#7DC97B","#9E9E9E","#F5C842","#E8A23A","#4CAF85","#4A90D9","#E74C3C","#9B59B6","#1ABC9C","#E67E22","#FF6B9D","#34C759"];

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
      <input value={hex} onChange={e=>{setHex(e.target.value);if(ok(e.target.value))onChange(e.target.value);}} style={{...INP,width:90,fontFamily:"monospace"}} placeholder="#000000"/>
    </div>
  </div>;
}

/* ══════ MODAL ══════ */
function Modal({title,onClose,children,width=440,hideHeader=false}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.36)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"white",borderRadius:22,width:"100%",maxWidth:width,maxHeight:"92vh",overflowY:"auto",padding:"20px 20px 24px",boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
      {!hideHeader&&title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <span style={{fontSize:17,fontWeight:700,color:"#111"}}>{title}</span>
        <button onClick={onClose} style={{border:"none",background:"#f2f2f7",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14,color:"#666"}}>✕</button>
      </div>}
      {children}
    </div>
  </div>;
}

/* ══════ TIME SCROLL PICKER ══════ */
function TimeScrollPicker({value, onChange, label}){
  const [h,m] = value ? value.split(":").map(Number) : [9,0];
  const hourRef = useRef();
  const minRef = useRef();
  const hours = Array.from({length:24},(_,i)=>i);
  const mins = Array.from({length:12},(_,i)=>i*5);
  const ITEM_H = 36;

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
    scrollSnapAlign:"center", fontSize: selected ? 18 : 14,
    fontWeight: selected ? 700 : 400, color: selected ? "#111" : "#c0c0c0",
    cursor:"pointer", transition:"all 0.1s", flexShrink:0,
  });

  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
    {label && <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:4}}>{label}</div>}
    <div style={{display:"flex",alignItems:"center",gap:0,background:"#f8f8f8",borderRadius:14,padding:"0 8px",position:"relative"}}>
      {/* selection band */}
      <div style={{position:"absolute",left:0,right:0,top:"50%",transform:"translateY(-50%)",height:ITEM_H,background:"rgba(0,0,0,0.06)",borderRadius:8,pointerEvents:"none",zIndex:1}}/>
      <div ref={hourRef} onScroll={onHourScroll} style={{...scrollStyle,width:56}}>
        <div style={{height:ITEM_H}}/>
        {hours.map(hv=><div key={hv} style={itemStyle(hv===h)} onClick={()=>{if(hourRef.current)hourRef.current.scrollTop=hv*ITEM_H;onChange(`${pad(hv)}:${pad(m)}`);}}>{pad(hv)}</div>)}
        <div style={{height:ITEM_H}}/>
      </div>
      <div style={{fontSize:20,fontWeight:700,color:"#555",padding:"0 4px",zIndex:2}}>:</div>
      <div ref={minRef} onScroll={onMinScroll} style={{...scrollStyle,width:56}}>
        <div style={{height:ITEM_H}}/>
        {mins.map(mv=><div key={mv} style={itemStyle(mv===m||mv===Math.floor(m/5)*5)} onClick={()=>{if(minRef.current)minRef.current.scrollTop=Math.floor(mv/5)*ITEM_H;onChange(`${pad(h)}:${pad(mv)}`);}}>{pad(mv)}</div>)}
        <div style={{height:ITEM_H}}/>
      </div>
    </div>
    <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>
  </div>;
}

/* ══════ LABEL MANAGER ══════ */
function LabelManager({labels,onSave}){
  const [list,setList]=useState(()=>labels.map(l=>({...l,children:(l.children||[]).map(c=>({...c}))})));
  const [ed,setEd]=useState(null);
  const [ced,setCed]=useState(null);
  const [selLabel,setSelLabel]=useState(null); // selected label for detail view

  const Form=({data,setData,title:t,onOk,onCancel,onDelete})=>{
    const emojiRef = useRef();
    const openEmojiPicker = () => {
      if(emojiRef.current && document.activeElement !== emojiRef.current){
        emojiRef.current.focus();
      }
    };
    return <div style={{background:"#f8f8f8",borderRadius:14,padding:"14px 16px",marginTop:10}}>
      <div style={{fontSize:13,fontWeight:700,color:"#555",marginBottom:10}}>{t}</div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{position:"relative"}}>
          <button
            onClick={openEmojiPicker}
            style={{width:50,height:38,borderRadius:10,border:"1.5px solid #EBEBEB",background:"white",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
            title="选择表情"
          >{data.emoji||"🏷"}</button>
          <input
            ref={emojiRef}
            type="text"
            inputMode="none"
            style={{position:"absolute",opacity:0,width:1,height:1,top:0,left:0,pointerEvents:"none"}}
          />
          {/* Native emoji keyboard triggered via contenteditable */}
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={e=>{
              const txt=e.currentTarget.innerText.replace(/\s/g,"");
              const chars=[...txt];
              if(chars.length>0){setData(p=>({...p,emoji:chars[chars.length-1]}));e.currentTarget.innerText="";}
            }}
            style={{position:"absolute",inset:0,opacity:0.01,cursor:"pointer",fontSize:1,color:"transparent",outline:"none",borderRadius:10,overflow:"hidden"}}
            title="点击选择表情符号"
          />
        </div>
        <input value={data.name} onChange={e=>setData(p=>({...p,name:e.target.value}))} placeholder="标签名称" style={{...INP,flex:1}}/>
      </div>
      <ColorPicker value={data.color} onChange={c=>setData(p=>({...p,color:c}))}/>
      <div style={{marginTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:5}}>自动分类关键词（逗号分隔）</div>
        <input value={(data.keywords||[]).join(",")} onChange={e=>setData(p=>({...p,keywords:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}))} placeholder="关键词1,关键词2" style={{...INP,width:"100%"}}/>
        <div style={{fontSize:11,color:"#aaa",marginTop:3}}>检测到关键词时自动打标签</div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button onClick={onCancel} style={{flex:1,padding:"8px",border:"1.5px solid #e5e7eb",borderRadius:10,background:"white",cursor:"pointer",fontSize:13}}>取消</button>
        {onDelete&&<button onClick={onDelete} style={{padding:"8px 14px",border:"none",borderRadius:10,background:"#FFF0F0",color:"#FF3B30",cursor:"pointer",fontSize:13,fontWeight:600}}>删除</button>}
        <button onClick={onOk} style={{flex:2,padding:"8px",border:"none",borderRadius:10,background:"#333",color:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>保存</button>
      </div>
    </div>;
  };

  // If a label is selected, show detail view with edit/delete
  if(selLabel){
    const lb = list.find(l=>l.id===selLabel);
    if(!lb) { setSelLabel(null); return null; }
    return <div>
      <button onClick={()=>setSelLabel(null)} style={{border:"none",background:"none",color:"#555",fontSize:13,cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",gap:4}}>‹ 返回</button>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#f8f8f8",borderRadius:14,marginBottom:12}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:lb.color}}/>
        <span style={{fontSize:20}}>{lb.emoji}</span>
        <span style={{fontSize:15,fontWeight:700}}>{lb.name}</span>
      </div>
      {!ed&&<div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>setEd({...lb,children:[...(lb.children||[])],isNew:false})} style={{flex:1,padding:"9px",border:"1.5px solid #e5e7eb",borderRadius:10,background:"white",cursor:"pointer",fontSize:13,fontWeight:600}}>编辑标签</button>
        <button onClick={()=>{setList(p=>p.filter(x=>x.id!==lb.id));setSelLabel(null);}} style={{padding:"9px 16px",border:"none",borderRadius:10,background:"#FFF0F0",color:"#FF3B30",cursor:"pointer",fontSize:13,fontWeight:600}}>删除</button>
      </div>}
      {ed?.id===lb.id&&<Form data={ed} setData={setEd} title="编辑标签"
        onCancel={()=>setEd(null)}
        onOk={()=>{setList(p=>p.map(x=>x.id===lb.id?{...ed}:x));setEd(null);setSelLabel(null);}}/>}
      <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:8}}>子标签</div>
      {(lb.children||[]).map(c=><div key={c.id}>
        <div onClick={()=>{ setCed({parentId:lb.id,child:{...c},isNew:false}); setEd(null); }}
          style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:ced?.child?.id===c.id?"#f0f7ff":"#f8f8f8",borderRadius:10,cursor:"pointer",marginBottom:4,border:ced?.child?.id===c.id?"1.5px solid #555":"1.5px solid transparent"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:c.color||lb.color}}/>
          <span style={{fontSize:13,flex:1}}>{c.emoji} {c.name}</span>
        </div>
        {ced?.parentId===lb.id&&ced?.child?.id===c.id&&<Form data={ced.child} setData={d=>setCed(p=>({...p,child:typeof d==="function"?d(p.child):d}))} title="编辑子标签"
          onCancel={()=>setCed(null)}
          onDelete={()=>{setList(p=>p.map(x=>x.id===lb.id?{...x,children:(x.children||[]).filter(ch=>ch.id!==c.id)}:x));setCed(null);}}
          onOk={()=>{setList(p=>p.map(x=>x.id===lb.id?{...x,children:(x.children||[]).map(ch=>ch.id===ced.child.id?ced.child:ch)}:x));setCed(null);}}/>}
      </div>)}
      <button onClick={()=>{setCed({parentId:lb.id,child:{id:uuid(),name:"",emoji:"🏷",color:lb.color,keywords:[]},isNew:true});setEd(null);}} style={{fontSize:12,color:"#555",border:"1.5px solid #e5e7eb",background:"white",cursor:"pointer",padding:"7px 14px",borderRadius:10,marginTop:6}}>+ 添加子标签</button>
      {ced?.isNew&&ced?.parentId===lb.id&&<Form data={ced.child} setData={d=>setCed(p=>({...p,child:typeof d==="function"?d(p.child):d}))} title="新建子标签"
        onCancel={()=>setCed(null)}
        onOk={()=>{setList(p=>p.map(x=>x.id===lb.id?{...x,children:[...(x.children||[]),ced.child]}:x));setCed(null);}}/>}
      <div style={{display:"flex",gap:10,marginTop:16}}>
        <button onClick={()=>onSave(list)} style={{flex:1,padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>完成</button>
      </div>
    </div>;
  }

  return <div>
    <div style={{maxHeight:"60vh",overflowY:"auto",marginBottom:12}}>
      {list.map(l=><div key={l.id} style={{marginBottom:4}}>
        <div
          onClick={()=>{ setSelLabel(l.id); setEd(null); setCed(null); }}
          style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#f8f8f8",borderRadius:12,cursor:"pointer",border:"1.5px solid transparent",transition:"all 0.15s"}}
        >
          <div style={{width:9,height:9,borderRadius:"50%",background:l.color,flexShrink:0}}/>
          <span style={{fontSize:16,marginRight:2}}>{l.emoji}</span>
          <span style={{flex:1,fontSize:13,fontWeight:600}}>{l.name}</span>
          {(l.children||[]).length>0&&<span style={{fontSize:11,color:"#aaa"}}>{l.children.length}个子标签</span>}
          <span style={{fontSize:14,color:"#c0c0c0"}}>›</span>
        </div>
      </div>)}
    </div>
    {!ed&&<div style={{display:"flex",gap:10}}>
      <button onClick={()=>{setEd({id:uuid(),name:"",emoji:"🏷",color:"#4A90D9",keywords:[],children:[],isNew:true});setCed(null);}} style={{flex:1,padding:"10px",border:"1.5px solid #555",borderRadius:12,background:"white",color:"#333",cursor:"pointer",fontSize:13,fontWeight:600}}>+ 新建标签</button>
      <button onClick={()=>onSave(list)} style={{flex:1,padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontSize:13,fontWeight:700}}>完成</button>
    </div>}
    {ed?.isNew&&<Form data={ed} setData={setEd} title="新建标签"
      onCancel={()=>setEd(null)}
      onOk={()=>{setList(p=>[...p,{...ed}]);setEd(null);}}/>}
  </div>;
}

/* ══════ PUSH NOTIFICATION OPTIONS ══════ */
function NotifPicker({value, onChange}){
  // value: {onStart: bool, onEnd: bool}
  const v = value || {onStart:false, onEnd:false};
  const toggle = k => onChange({...v, [k]: !v[k]});
  const Tog = ({label, k}) => <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0"}}>
    <span style={{fontSize:13,color:"#333"}}>{label}</span>
    <div onClick={()=>toggle(k)} style={{width:40,height:22,borderRadius:11,background:v[k]?"#333":"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
      <div style={{position:"absolute",top:2,left:v[k]?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
    </div>
  </div>;
  return <div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",padding:"4px 14px"}}>
    <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",padding:"8px 0 4px"}}>推送通知</div>
    <Tog label="任务开始时通知" k="onStart"/>
    <div style={{height:1,background:"#f0f0f0"}}/>
    <Tog label="任务结束时通知" k="onEnd"/>
  </div>;
}

/* ══════ EVENT FORM ══════ */
function EventForm({ev,labels,onSave,onDelete,onClose,initialDate,initialHour}){
  const isNew=!ev;
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const dh=initialHour!=null?initialHour:9;
  const [form,setForm]=useState(()=>ev?{...ev}:{id:uuid(),title:"",labelId:labels[0]?.id||"",autoTags:[],date:initialDate||todayStr(),startTime:null,endTime:null,allDay:false,repeat:"none",repeatDays:[],notes:"",timerSecs:0,notif:{onStart:false,onEnd:false}});
  const [tab,setTab]=useState(ev?._openTab||"info");
  const [running,setRunning]=useState(false);
  const [elapsed,setElapsed]=useState(form.timerSecs||0);
  const [hasTime,setHasTime]=useState(!!(ev?.startTime));
  const timer=useRef();
  useEffect(()=>{if(running)timer.current=setInterval(()=>setElapsed(p=>p+1),1000);else clearInterval(timer.current);return()=>clearInterval(timer.current);},[running]);
  useEffect(()=>{const tags=autoTag(form,labels);setForm(p=>({...p,autoTags:tags}));},[form.title,form.notes]);
  const lb=flat.find(l=>l.id===form.labelId)||{color:"#007AFF",emoji:"📌"};
  const dur=!form.allDay&&form.startTime&&form.endTime?getDur(form):0;

  const T=({t,n})=><button onClick={()=>setTab(t)} style={{flex:1,padding:"7px",border:"none",borderRadius:8,background:tab===t?"white":"transparent",fontWeight:tab===t?700:400,fontSize:13,cursor:"pointer",color:tab===t?"#111":"#8e8e93",boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.08)":""}}>{n}</button>;
  const Row=({label:l,children,sep})=><div style={{display:"flex",alignItems:"center",padding:"9px 14px",borderBottom:sep?"1px solid #f5f5f5":"none"}}><span style={{fontSize:12,color:"#8e8e93",width:54,flexShrink:0}}>{l}</span><div style={{flex:1}}>{children}</div></div>;

  const stopAndApply=()=>{
    setRunning(false);
    if(elapsed>0&&form.startTime){
      const startM=parseMins(form.startTime);
      const endM=(startM+Math.round(elapsed/60))%1440;
      const newEnd=`${pad(Math.floor(endM/60))}:${pad(endM%60)}`;
      setForm(p=>({...p,endTime:newEnd,timerSecs:elapsed}));
    }
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

  return <div>
    {/* Title row — only one close button here, modal header is hidden for edit */}
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
      <span style={{fontSize:20}}>{lb.emoji}</span>
      <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="事项名称…" style={{...INP,flex:1,fontSize:15,fontWeight:600,border:"none",padding:"4px 0",borderBottom:"2px solid #f0f0f0",borderRadius:0}}/>
    </div>
    {dur>0&&<div style={{background:"#f2f2f7",borderRadius:8,padding:"5px 12px",marginBottom:10,fontSize:12,color:"#555",fontWeight:700}}>⏱ {fmtMins(dur)}</div>}
    <div style={{display:"flex",background:"#f2f2f7",borderRadius:10,padding:2,gap:2,marginBottom:14}}>
      <T t="info" n="信息"/><T t="timer" n="计时"/>
    </div>

    {tab==="info"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",overflow:"hidden"}}>
        <Row label="开始日期" sep>
          <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
            style={{...INP,border:"none",padding:0,background:"transparent",fontSize:13}}/>
        </Row>
        <Row label="结束日期" sep>
          <input type="date" value={form.endDate||form.date} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}
            style={{...INP,border:"none",padding:0,background:"transparent",fontSize:13}}/>
        </Row>
        <Row label="全天">
          <div onClick={()=>setForm(p=>({...p,allDay:!p.allDay}))} style={{width:40,height:22,borderRadius:11,background:form.allDay?"#555":"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
            <div style={{position:"absolute",top:2,left:form.allDay?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
          </div>
        </Row>
        {!form.allDay&&<Row label="安排时间" sep={false}>
          <div onClick={toggleHasTime} style={{width:40,height:22,borderRadius:11,background:hasTime?"#555":"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
            <div style={{position:"absolute",top:2,left:hasTime?20:2,width:18,height:18,borderRadius:"50%",background:"white",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
          </div>
        </Row>}
      </div>

      {!form.allDay&&hasTime&&<div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",padding:"14px 14px 10px"}}>
        <div style={{display:"flex",justifyContent:"space-around",gap:8}}>
          <TimeScrollPicker value={form.startTime||"09:00"} onChange={v=>setForm(p=>({...p,startTime:v}))} label="开始时间"/>
          <div style={{display:"flex",alignItems:"center",paddingTop:22,color:"#999",fontSize:18}}>→</div>
          <TimeScrollPicker value={form.endTime||"10:00"} onChange={v=>setForm(p=>({...p,endTime:v}))} label="结束时间"/>
        </div>
      </div>}

      <div style={{background:"#fafafa",borderRadius:12,padding:"10px 14px",border:"1px solid #f0f0f0"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:8}}>日历</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {flat.map(l=><button key={l.id} onClick={()=>setForm(p=>({...p,labelId:l.id}))} style={{padding:"5px 10px",border:"none",borderRadius:20,background:form.labelId===l.id?l.color+(l.color.length===7?"dd":""):("#f0f0f0"),color:form.labelId===l.id?"white":"#555",cursor:"pointer",fontSize:12,fontWeight:form.labelId===l.id?700:400}}>
            {l._parent&&<span style={{fontSize:10,color:form.labelId===l.id?"rgba(255,255,255,0.7)":"#aaa"}}>#</span>}{l.emoji} {l.name}
          </button>)}
        </div>
      </div>

      {form.autoTags?.length>0&&<div>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:5}}>Tags（自动）</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {form.autoTags.map(tid=>{const l=flat.find(x=>x.id===tid);return l?<span key={tid} style={{fontSize:11,background:l.color+"22",color:l.color,borderRadius:20,padding:"3px 8px",fontWeight:600}}>{l.emoji} {l.name}</span>:null;})}
        </div>
      </div>}

      <div style={{background:"#fafafa",borderRadius:12,border:"1px solid #f0f0f0",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderBottom:form.repeat==="weekly"?"1px solid #f5f5f5":"none"}}>
          <span style={{fontSize:13,color:"#555"}}>重复</span>
          <select value={form.repeat} onChange={e=>setForm(p=>({...p,repeat:e.target.value}))} style={{...INP,border:"none",background:"transparent",fontSize:13,padding:"0 4px",cursor:"pointer"}}>
            <option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="yearly">每年</option>
          </select>
        </div>
        {form.repeat==="weekly"&&<div style={{display:"flex",gap:6,padding:"0 14px 10px",marginTop:6}}>
          {WD.map((d,i)=><button key={i} onClick={()=>setForm(p=>{const r=p.repeatDays||[];return{...p,repeatDays:r.includes(i)?r.filter(x=>x!==i):[...r,i]};})} style={{width:30,height:30,borderRadius:"50%",border:"none",background:(form.repeatDays||[]).includes(i)?"#333":"#f0f0f0",color:(form.repeatDays||[]).includes(i)?"white":"#555",cursor:"pointer",fontSize:12,fontWeight:600}}>{d}</button>)}
        </div>}
      </div>

      <NotifPicker value={form.notif} onChange={v=>setForm(p=>({...p,notif:v}))}/>

      <div>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:5}}>笔记</div>
        <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="添加备注…" style={{...INP,width:"100%",minHeight:70,resize:"vertical",fontSize:13}}/>
      </div>
    </div>}

    {tab==="timer"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,padding:"10px 0"}}>
      <div style={{fontSize:58,fontWeight:100,letterSpacing:3,color:"#111",fontVariantNumeric:"tabular-nums"}}>{fmtSecs(elapsed)}</div>
      <div style={{display:"flex",gap:12}}>
        <button onClick={()=>setRunning(p=>!p)} style={{padding:"12px 34px",border:"none",borderRadius:30,background:running?"#555":"#333",color:"white",fontSize:16,fontWeight:700,cursor:"pointer"}}>{running?"暂停":"开始"}</button>
        {elapsed>0&&!running&&<button onClick={stopAndApply} style={{padding:"12px 20px",borderRadius:30,border:"none",background:"#555",color:"white",fontSize:14,fontWeight:600,cursor:"pointer"}}>应用时长</button>}
        {elapsed>0&&<button onClick={()=>{setRunning(false);setElapsed(0);setForm(p=>({...p,timerSecs:0}));}} style={{padding:"12px 16px",borderRadius:30,border:"1.5px solid #e5e7eb",background:"white",color:"#666",fontSize:14,cursor:"pointer"}}>重置</button>}
      </div>
      {elapsed>0&&<div style={{background:"#f2f2f7",borderRadius:12,padding:"10px 22px",textAlign:"center"}}>
        <div style={{fontSize:14,color:"#333",fontWeight:700}}>已计时 {fmtSecs(elapsed)}</div>
        <div style={{fontSize:12,color:"#8e8e93",marginTop:2}}>点击「应用时长」将更新结束时间</div>
      </div>}
      {form.startTime&&<div style={{fontSize:12,color:"#8e8e93"}}>开始时间：{form.startTime} → {form.endTime||"—"}</div>}
    </div>}

    <div style={{display:"flex",gap:8,marginTop:18}}>
      {!isNew&&<button onClick={()=>onDelete(form.id)} style={{padding:"10px",border:"none",borderRadius:12,background:"#FFF0F0",color:"#FF3B30",cursor:"pointer",fontSize:13,fontWeight:600}}>删除</button>}
      <button onClick={()=>{if(!form.title.trim())return;const saved={...form,timerSecs:elapsed};if(!hasTime){saved.startTime=null;saved.endTime=null;saved.allDay=false;}onSave(saved);}} style={{flex:1,padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontWeight:700,fontSize:14}}>{isNew?"添加":"保存"}</button>
    </div>
  </div>;
}

/* ══════ TODAY PAGE ══════ */
function TodayPage({events,labels,onOpen,onAdd,onToggle}){
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const getLb=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌",name:"未分类"};
  const [viewDate,setViewDate]=useState(todayStr());
  const isToday=viewDate===todayStr();
  const displayDate=new Date(viewDate+"T00:00:00");
  const hol=HOLIDAYS[viewDate];
  const dayEvs=useMemo(()=>getForDate(events,viewDate).sort((a,b)=>{
    if(!a.startTime && !b.startTime) return 0;
    if(!a.startTime) return 1;
    if(!b.startTime) return -1;
    return parseMins(a.startTime)-parseMins(b.startTime);
  }),[events,viewDate]);
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

  const Card=({ev})=>{
    const lb=getLb(ev.labelId);
    const als=(ev.autoTags||[]).map(id=>flat.find(l=>l.id===id)).filter(Boolean);
    const cardColor=ev.done?lb.color:lightenHex(lb.color,0.45);
    return <div style={{display:"flex",alignItems:"center",gap:11,padding:"11px 0",borderBottom:"1px solid #f8f8f8"}}>
      <button onClick={e=>{e.stopPropagation();onToggle(ev.id);}} style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${lb.color}`,background:ev.done?lb.color:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {ev.done&&<span style={{color:"white",fontSize:11,fontWeight:900}}>✓</span>}
      </button>
      <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onOpen(ev)}>
        <div style={{fontSize:14,fontWeight:600,color:ev.done?"#555":"#111",textDecoration:ev.done?"line-through":"none"}}>{ev.title}</div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3,flexWrap:"wrap"}}>
          {ev.startTime&&!ev.allDay&&<span style={{fontSize:12,color:"#8e8e93"}}>{ev.startTime}{ev.endTime&&` → ${ev.endTime}`}</span>}
          <span style={{display:"inline-flex",alignItems:"center",gap:3,background:cardColor+"33",borderRadius:20,padding:"2px 7px",fontSize:11,color:ev.done?lb.color:lightenHex(lb.color,-0.1),fontWeight:600}}>
            {lb.emoji} {lb.name}
          </span>
          {als.map(al=><span key={al.id} style={{fontSize:11,color:"#8e8e93",background:"#f0f0f0",borderRadius:20,padding:"2px 6px"}}>{al.emoji} {al.name}</span>)}
          {ev.notes&&<span style={{fontSize:12,color:"#ccc"}}>📝</span>}
          {ev.repeat&&ev.repeat!=="none"&&<span style={{fontSize:12,color:"#ccc"}}>↻</span>}
          {ev.endDate&&ev.endDate!==ev.date&&<span style={{fontSize:11,color:"#8e8e93",background:"#f0f0f0",borderRadius:20,padding:"2px 6px"}}>跨日</span>}
          {ev.notif?.onStart&&<span style={{fontSize:11,color:"#8e8e93"}}>🔔</span>}
        </div>
      </div>
      <button onClick={()=>onOpen({...ev,_openTab:"timer"})} style={{width:30,height:30,borderRadius:"50%",border:"1.5px solid #d0d0d0",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="7" r="4.5" stroke="#b0b0b0" strokeWidth="1.2"/>
          <path d="M6.5 4.5V7L8 8.5" stroke="#b0b0b0" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M5 1.5H8" stroke="#b0b0b0" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>;
  };

  return <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
    <div style={{padding:"16px 20px 10px",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:12,color:isToday?"#FF3B30":"#8e8e93",fontWeight:600,marginBottom:4}}>
          {isToday?"今天 · ":""}{displayDate.toLocaleDateString("zh-CN",{weekday:"long"})}
          {hol&&<span style={{marginLeft:8,fontSize:11,color:"#FF3B30",background:"#fff0f0",borderRadius:20,padding:"2px 8px"}}>{hol}</span>}
        </div>
        <label style={{cursor:"pointer",display:"block"}}>
          <div style={{fontSize:30,fontWeight:200,color:"#111",letterSpacing:-1}}>{displayDate.getDate()}日</div>
          <input type="date" value={viewDate} onChange={e=>setViewDate(e.target.value)} style={{position:"absolute",opacity:0,pointerEvents:"none"}}/>
        </label>
        {!isToday&&<button onClick={()=>setViewDate(todayStr())} style={{border:"none",background:"#f2f2f7",borderRadius:20,padding:"4px 12px",fontSize:11,cursor:"pointer",color:"#555",marginTop:4}}>回到今天</button>}
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center",marginTop:"auto",paddingTop:14}}>
        <button onClick={()=>{const d=new Date(viewDate+"T00:00:00");d.setDate(d.getDate()-1);setViewDate(fmtDate(d));}} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:"#555"}}>‹</button>
        <button onClick={()=>{const d=new Date(viewDate+"T00:00:00");d.setDate(d.getDate()+1);setViewDate(fmtDate(d));}} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:"#555"}}>›</button>
      </div>
    </div>
    <div style={{margin:"0 16px 14px",background:"#f8f8f8",borderRadius:14,padding:"10px 14px"}}>
      <span style={{fontSize:13,color:"#555"}}>共 <b style={{color:"#111"}}>{dayEvs.length}</b> 项 · 完成 <b style={{color:"#555"}}>{dayEvs.filter(e=>e.done).length}</b></span>
    </div>
    {sections.map(sec=>{
      const evs=dayEvs.filter(sec.test);
      return <div key={sec.key}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 20px 4px"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:17}}>{sec.icon}</span>
            <span style={{fontSize:16,fontWeight:700,color:"#222"}}>{sec.label}</span>
            <span style={{fontSize:14,color:"#c0c0c0"}}>{evs.length}</span>
          </div>
          <button onClick={()=>onAdd(viewDate,sec.hour)} style={{width:26,height:26,border:"none",borderRadius:"50%",background:"#f2f2f7",cursor:"pointer",fontSize:18,color:"#8e8e93",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
        </div>
        {evs.length>0&&<div style={{padding:"0 20px"}}>{evs.map(ev=><Card key={ev.id} ev={ev}/>)}</div>}
      </div>;
    })}
    {/* Blue FAB — only add button needed here */}
    <button onClick={()=>onAdd(viewDate,9)} style={{position:"fixed",right:22,bottom:82,width:50,height:50,borderRadius:"50%",border:"none",background:"#007AFF",color:"white",fontSize:26,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,122,255,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
  </div>;
}

/* ══════ 24H TIMELINE ══════ */
const HH=58;
function Timeline({days,events,labels,onEventClick,onSlotClick,onDayHeaderClick}){
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const getLb=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌"};
  const ref=useRef();
  const today=new Date();
  useEffect(()=>{const h=today.getHours();if(ref.current)ref.current.scrollTop=Math.max(0,(h-2)*HH);},[]);

  const lightenHex=(hex,amount=0.45)=>{
    if(!hex||hex.length<7) return hex||"#ccc";
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    const lr=Math.round(r+(255-r)*amount),lg2=Math.round(g+(255-g)*amount),lb2=Math.round(b+(255-b)*amount);
    return `#${pad(lr.toString(16))}${pad(lg2.toString(16))}${pad(lb2.toString(16))}`;
  };

  const getDaySegments=useCallback((ds)=>{
    return getForDate(events,ds).filter(e=>!e.allDay&&e.startTime).map(ev=>{
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

  // Non-conflicting events stay in single column
  const layoutDay=useCallback(segs=>{
    const s=[...segs].sort((a,b)=>a._startMins-b._startMins);
    const cols=[];
    s.forEach(ev=>{let ci=cols.findIndex(col=>{const last=col[col.length-1];return last._endMins<=ev._startMins;});if(ci===-1){ci=cols.length;cols.push([]);}cols[ci].push(ev);});
    const tot=cols.length||1;const res={};cols.forEach((col,ci)=>col.forEach(ev=>{res[ev.id]={ci,tot};}));
    return res;
  },[]);

  const COL=`44px repeat(${days.length},1fr)`;
  return <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
    <div style={{display:"grid",gridTemplateColumns:COL,borderBottom:"1.5px solid #ebebeb",flexShrink:0}}>
      <div style={{width:44}}/>
      {days.map((d,i)=>{
        const isT=isSameDay(d,today);const isW=d.getDay()===0||d.getDay()===6;const hol=HOLIDAYS[fmtDate(d)];
        return <div key={i} style={{textAlign:"center",padding:"6px 0",cursor:onDayHeaderClick?"pointer":"default"}} onClick={onDayHeaderClick?()=>onDayHeaderClick(d):undefined}>
          <div style={{fontSize:10,fontWeight:600,color:isW?"#FF3B30":"#8e8e93"}}>{WD[d.getDay()]}</div>
          <div style={{width:28,height:28,borderRadius:"50%",margin:"2px auto",background:isT?"#333":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:13,fontWeight:isT?700:400,color:isT?"white":isW?"#FF3B30":"#111"}}>{d.getDate()}</span>
          </div>
          {hol&&<div style={{fontSize:9,color:"#FF3B30",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",padding:"0 2px"}}>{hol.split("·")[0]}</div>}
        </div>;
      })}
    </div>
    <div ref={ref} style={{flex:1,overflowY:"auto",position:"relative"}}>
      <div style={{display:"grid",gridTemplateColumns:COL,paddingBottom:HH}}>
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
                const isDone=ev.done;
                const bgColor=isDone?lb.color:lightenHex(lb.color,0.45);
                const topMin=ev._startMins%60;
                const durMins=ev._endMins-ev._startMins;
                const top=(topMin/60)*HH;
                const height=Math.max(18,(durMins/60)*HH-2);
                const {ci,tot}=layout[ev.id]||{ci:0,tot:1};
                const endHour=Math.floor(ev._endMins/60),endMin=ev._endMins%60;
                const endLabel=`${pad(endHour)}:${pad(endMin)}`;
                return <div key={ev.id} onClick={e=>{e.stopPropagation();onEventClick(ev);}}
                  style={{position:"absolute",top,left:`calc(${ci/tot*100}% + 1px)`,width:`calc(${100/tot}% - 2px)`,height,background:bgColor,borderRadius:5,padding:"2px 4px",cursor:"pointer",zIndex:2,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.1)",borderLeft:`3px solid ${lb.color}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:isDone?"white":"#333",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.title}</div>
                  {height>28&&<div style={{fontSize:9,color:isDone?"rgba(255,255,255,0.85)":"rgba(0,0,0,0.5)"}}>{ev.startTime} – {endLabel}</div>}
                  {height>44&&<div style={{fontSize:9,color:isDone?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.4)"}}>{fmtMins(durMins)}</div>}
                  {height>60&&ev.notes&&<div style={{fontSize:9,color:isDone?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📝 {ev.notes}</div>}
                </div>;
              })}
            </div>;
          })
        ])}
      </div>
      {days.some(d=>isSameDay(d,today))&&(()=>{
        const top=today.getHours()*HH+(today.getMinutes()/60)*HH;
        return <div style={{position:"absolute",top,left:44,right:0,zIndex:10,pointerEvents:"none"}}>
          <div style={{position:"absolute",left:0,right:0,height:1.5,background:"#FF3B30"}}/>
          <div style={{position:"absolute",left:-3,top:-3.5,width:8,height:8,borderRadius:"50%",background:"#FF3B30"}}/>
        </div>;
      })()}
    </div>
  </div>;
}

/* ══════ CALENDAR PAGE ══════ */
function CalendarPage({events,labels,onOpen,onAdd}){
  const [view,setView]=useState("month");
  const [cur,setCur]=useState(new Date());
  const today=new Date();
  const flat=useMemo(()=>flattenLabels(labels),[labels]);
  const getLb=id=>flat.find(l=>l.id===id)||{color:"#ccc",emoji:"📌"};
  const weekDays=useMemo(()=>{const s=new Date(cur);s.setDate(s.getDate()-s.getDay());return Array.from({length:7},(_,i)=>addDays(s,i));},[cur]);
  const step=n=>setCur(d=>{const r=new Date(d);if(view==="month")r.setMonth(r.getMonth()+n);else if(view==="week")r.setDate(r.getDate()+n*7);else r.setDate(r.getDate()+n);return r;});
  const lbl=view==="month"?`${MONTHS[cur.getMonth()]} ${cur.getFullYear()}`:view==="week"?(()=>{const s=weekDays[0],e=weekDays[6];return s.getMonth()===e.getMonth()?`${MONTHS[s.getMonth()]} ${s.getFullYear()}`:MONTHS[s.getMonth()]+" — "+MONTHS[e.getMonth()];})():`${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
  const cells=useMemo(()=>{const y=cur.getFullYear(),m=cur.getMonth();const first=new Date(y,m,1);const pad2=first.getDay();const total=pad2+daysInMon(y,m);const arr=[];for(let i=0;i<Math.ceil(total/7)*7;i++){const d=new Date(y,m,1-pad2+i);arr.push({d,cur:d.getMonth()===m});}return arr;},[cur]);

  // Swipe support for calendar
  const touchStart=useRef(null);
  const handleTouchStart=e=>touchStart.current=e.touches[0].clientX;
  const handleTouchEnd=e=>{
    if(touchStart.current===null) return;
    const dx=e.changedTouches[0].clientX-touchStart.current;
    if(Math.abs(dx)>50){step(dx<0?1:-1);}
    touchStart.current=null;
  };

  return <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"10px 14px 8px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
      <div style={{display:"flex",background:"#f2f2f7",borderRadius:10,padding:2,gap:2}}>
        {[["month","月"],["week","周"],["day","日"]].map(([v,l])=><button key={v} onClick={()=>setView(v)} style={{padding:"5px 12px",border:"none",borderRadius:8,background:view===v?"white":"transparent",fontWeight:view===v?700:400,fontSize:13,cursor:"pointer",boxShadow:view===v?"0 1px 4px rgba(0,0,0,0.08)":""}}>{l}</button>)}
      </div>
      <span style={{flex:1,fontSize:15,fontWeight:700,color:"#111",textAlign:"center"}}>{lbl}</span>
      <button onClick={()=>setCur(new Date())} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer",color:"#555"}}>今</button>
      <button onClick={()=>step(-1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14,color:"#555"}}>‹</button>
      <button onClick={()=>step(1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14,color:"#555"}}>›</button>
    </div>
    {view==="month"&&<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Refined month calendar UI */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px 4px",flexShrink:0,borderBottom:"1px solid #f5f5f5"}}>
        {WD.map((d,i)=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:i===0||i===6?"#FF3B30":"#8e8e93",padding:"4px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px",flex:1,alignContent:"start",overflowY:"auto"}}>
        {cells.map((c,i)=>{
          const isT=isSameDay(c.d,today);const isW=i%7===0||i%7===6;const evs=getForDate(events,fmtDate(c.d));const hol=HOLIDAYS[fmtDate(c.d)];
          return <div key={i} onClick={()=>{setCur(new Date(c.d));setView("day");}} style={{padding:"3px 2px",minHeight:68,cursor:"pointer",opacity:c.cur?1:0.3,borderTop:"1px solid #f5f5f5"}}>
            <div style={{width:26,height:26,borderRadius:"50%",margin:"0 auto 1px",display:"flex",alignItems:"center",justifyContent:"center",background:isT?"#333":"transparent"}}>
              <span style={{fontSize:12,fontWeight:isT?700:400,color:isT?"white":isW?"#FF3B30":"#111"}}>{c.d.getDate()}</span>
            </div>
            {hol&&<div style={{fontSize:8,color:"#FF3B30",textAlign:"center",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{hol.split("·")[0]}</div>}
            {evs.slice(0,3).map((ev,j)=>{const lb=getLb(ev.labelId);return <div key={j} style={{fontSize:9,background:lb.color+(ev.done?"cc":"33"),color:ev.done?"white":"#333",borderRadius:3,padding:"1px 4px",marginBottom:1,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",borderLeft:`2px solid ${lb.color}`}}>{ev.title}</div>;})}
            {evs.length>3&&<div style={{fontSize:9,color:"#8e8e93",paddingLeft:2}}>+{evs.length-3}</div>}
          </div>;
        })}
      </div>
    </div>}
    {view==="week"&&<div style={{flex:1,overflow:"hidden"}} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Timeline days={weekDays} events={events} labels={labels} onEventClick={onOpen} onSlotClick={(ds,h)=>onAdd(ds,h)} onDayHeaderClick={d=>{setCur(d);setView("day");}}/>
    </div>}
    {view==="day"&&<div style={{flex:1,overflow:"hidden"}} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Timeline days={[cur]} events={events} labels={labels} onEventClick={onOpen} onSlotClick={(ds,h)=>onAdd(ds,h)}/>
    </div>}
  </div>;
}

/* ══════ STATS PAGE ══════ */
function StatsPage({events,labels,onOpen}){
  const [period,setPeriod]=useState("month");
  const [offset,setOffset]=useState(0);
  const [heatId,setHeatId]=useState("all");
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

  const rangeEvs=useMemo(()=>{const res=[];let d=new Date(start);while(fmtDate(d)<=end){getForDate(events,fmtDate(d)).forEach(e=>{if(!res.find(x=>x.id===e.id&&x._d===fmtDate(d)))res.push({...e,_d:fmtDate(d)});});d=addDays(d,1);}return res;},[events,start,end]);
  const doneEvs=useMemo(()=>rangeEvs.filter(e=>e.done),[rangeEvs]);
  const lblStats=useMemo(()=>labels.map(lb=>{
    const mEvs=doneEvs.filter(e=>e.labelId===lb.id);const mMins=mEvs.reduce((s,e)=>s+getDur(e),0);
    const ch=(lb.children||[]).map(c=>{const ces=doneEvs.filter(e=>e.labelId===c.id);return{...c,mins:ces.reduce((s,e)=>s+getDur(e),0),count:ces.length,evs:ces};});
    const aEvs=doneEvs.filter(e=>(e.autoTags||[]).includes(lb.id)&&e.labelId!==lb.id);const aMins=aEvs.reduce((s,e)=>s+getDur(e),0);
    const total=mMins+aMins+ch.reduce((s,c)=>s+c.mins,0);
    const allEvs=[...mEvs,...aEvs,...ch.flatMap(c=>c.evs)];
    return{...lb,evs:allEvs,children:ch,total,count:allEvs.length};
  }).filter(l=>l.count>0).sort((a,b)=>b.total-a.total),[doneEvs,labels]);

  const grand=lblStats.reduce((s,l)=>s+l.total,0)||1;

  const heatDays=period==="day"?1:period==="week"?49:period==="year"?364:84;
  const heatData=useMemo(()=>{
    const arr=[];
    for(let i=heatDays-1;i>=0;i--){
      const d=addDays(new Date(),-(offset*(period==="week"?7:period==="month"?30:period==="year"?365:1))-i);
      const ds=fmtDate(d);
      const evs=getForDate(events,ds).filter(e=>e.done&&(heatId==="all"||e.labelId===heatId||(e.autoTags||[]).includes(heatId)));
      arr.push({d:ds,mins:evs.reduce((s,e)=>s+getDur(e),0)});
    }
    return arr;
  },[events,heatId,offset,period,heatDays]);

  const maxM=Math.max(...heatData.map(h=>h.mins),1);
  const hLb=flat.find(l=>l.id===heatId);
  const hColor=m=>{if(!m)return"#f0f0f0";const a=0.15+0.85*(m/maxM);return`rgba(100,100,100,${a})`;};
  const wk=Math.ceil(heatDays/7);

  const Donut=()=>{
    const sz=180,cx=90,cy=90,r=64,sw=22,ci=2*Math.PI*r;
    let cum=0;
    return <svg width={sz} height={sz}>
      {lblStats.map(lb=>{
        const frac=lb.total/grand;const dash=frac*ci;const off=ci-cum*ci;
        cum+=frac;
        return <circle key={lb.id} cx={cx} cy={cy} r={r} fill="none" stroke={lb.color} strokeWidth={sw} strokeDasharray={`${dash} ${ci-dash}`} strokeDashoffset={off} style={{transform:`rotate(-90deg)`,transformOrigin:"center"}}/>;
      })}
      <text x={cx} y={cy-6} textAnchor="middle" fontSize={11} fill="#8e8e93">总时长</text>
      <text x={cx} y={cy+12} textAnchor="middle" fontSize={16} fontWeight={700} fill="#111">{fmtMins(grand)}</text>
    </svg>;
  };

  return <div style={{flex:1,overflowY:"auto",padding:"14px 16px 100px"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <div style={{display:"flex",background:"#f2f2f7",borderRadius:10,padding:2,gap:2,flex:1}}>
        {[["day","天"],["week","周"],["month","月"],["year","年"]].map(([v,l])=><button key={v} onClick={()=>{setPeriod(v);setOffset(0);}} style={{flex:1,padding:"7px 0",border:"none",borderRadius:8,background:period===v?"white":"transparent",fontWeight:period===v?700:400,fontSize:13,cursor:"pointer",boxShadow:period===v?"0 1px 4px rgba(0,0,0,0.08)":""}}>{l}</button>)}
      </div>
      <button onClick={()=>setOffset(p=>p+1)} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:"#555"}}>‹</button>
      <button onClick={()=>setOffset(p=>Math.max(0,p-1))} style={{border:"1.5px solid #e5e7eb",background:"white",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:14,color:offset===0?"#ccc":"#555"}}>›</button>
    </div>
    <div style={{fontSize:18,fontWeight:800,color:"#111",marginBottom:2}}>{rLabel}</div>
    <div style={{fontSize:12,color:"#8e8e93",marginBottom:12}}>{start===end?start:`${start} — ${end}`}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
      {[{l:"总日程",v:doneEvs.length,u:"个"},{l:"总时长",v:fmtMins(grand),u:""},{l:"已完成",v:doneEvs.length,u:"个"},{l:"类别数",v:lblStats.length,u:"项"}].map((s,i)=><div key={i} style={{background:"white",borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#8e8e93"}}>{s.l}</div>
        <div style={{fontSize:22,fontWeight:800,color:"#111",marginTop:3}}>{s.v}<span style={{fontSize:12,color:"#8e8e93",marginLeft:2}}>{s.u}</span></div>
      </div>)}
    </div>

    {lblStats.length>0&&<div style={{background:"white",borderRadius:20,padding:16,marginBottom:12,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:12}}>深入了解您的活动</div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Donut/></div>
      {lblStats.map(lb=>{
        const pct=(lb.total/grand*100).toFixed(1);const isExp=expId===lb.id;
        return <div key={lb.id}>
          <div onClick={()=>setExpId(p=>p===lb.id?null:lb.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",cursor:"pointer",borderBottom:"1px solid #f8f8f8"}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:lb.color,flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:800,color:"#111",minWidth:44}}>{pct}%</span>
            <span style={{fontSize:14,flex:1,fontWeight:600}}>{lb.emoji} {lb.name}</span>
            <span style={{fontSize:12,color:"#8e8e93"}}>{fmtMins(lb.total)}</span>
            <span style={{fontSize:11,color:"#ccc",marginLeft:3}}>{isExp?"▲":"▼"}</span>
          </div>
          {(lb.children||[]).map(ch=><div key={ch.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0 5px 20px",borderBottom:"1px solid #f8f8f8"}}>
            <span style={{fontSize:11,color:"#aaa",fontWeight:700}}>#</span>
            <span style={{fontSize:12,flex:1,color:"#666"}}>{ch.emoji} {ch.name}</span>
            <span style={{fontSize:11,color:"#8e8e93"}}>{fmtMins(ch.mins)}</span>
          </div>)}
          {isExp&&<div style={{background:"#fafafa",borderRadius:12,padding:"8px 10px",marginBottom:6}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8e8e93",marginBottom:7}}>关联任务 {lb.evs.length}个</div>
            {lb.evs.slice(0,15).map(ev=><div key={ev.id+(ev._d||"")} onClick={()=>setDetEv(ev)} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:lb.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ev.title}</div>
                <div style={{fontSize:11,color:"#8e8e93"}}>{ev._d||ev.date} {ev.allDay?"全天":ev.startTime}</div>
              </div>
              <span style={{fontSize:11,color:"#8e8e93",flexShrink:0}}>{fmtMins(getDur(ev))}</span>
            </div>)}
            {lb.evs.length>15&&<div style={{fontSize:11,color:"#8e8e93",textAlign:"center",padding:"6px 0"}}>+ {lb.evs.length-15} 更多</div>}
          </div>}
        </div>;
      })}
    </div>}

    <div style={{background:"white",borderRadius:20,padding:16,marginBottom:12,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:8}}>活动热力图</div>
      <select value={heatId} onChange={e=>setHeatId(e.target.value)} style={{...INP,width:"100%",marginBottom:12}}>
        <option value="all">全部标签</option>
        {flat.map(lb=><option key={lb.id} value={lb.id}>{lb._parent?"# ":""}{lb.emoji} {lb.name}</option>)}
      </select>
      <div style={{display:"flex",justifyContent:"center",overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${wk},16px)`,gridTemplateRows:"repeat(7,16px)",gap:3}}>
          {Array.from({length:wk*7},(_,i)=>{
            const col=Math.floor(i/7),row=i%7,item=heatData[col*7+row];
            if(!item) return <div key={i} style={{width:16,height:16}}/>;
            return <div key={i} title={`${item.d}: ${fmtMins(item.mins)}`} style={{width:16,height:16,borderRadius:4,background:hColor(item.mins)}}/>;
          })}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:10,justifyContent:"center"}}>
        <span style={{fontSize:10,color:"#8e8e93"}}>少</span>
        {[0.15,0.35,0.55,0.75,1].map((a,i)=><div key={i} style={{width:12,height:12,borderRadius:3,background:`rgba(100,100,100,${a})`}}/>)}
        <span style={{fontSize:10,color:"#8e8e93"}}>多</span>
      </div>
    </div>

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
        <button onClick={()=>{setDetEv(null);onOpen&&onOpen(detEv);}} style={{padding:"10px",border:"none",borderRadius:12,background:"#333",color:"white",cursor:"pointer",fontWeight:700,fontSize:14}}>编辑任务</button>
      </div>
    </Modal>}
  </div>;
}

/* ══════ SIDEBAR ══════ */
function Sidebar({tab,setTab,labels,onManage}){
  return <div style={{width:200,background:"#f7f7f9",borderRight:"1px solid #ebebeb",display:"flex",flexDirection:"column",padding:"20px 0 16px",flexShrink:0}}>
    <div style={{padding:"0 16px 16px",borderBottom:"1px solid #ebebeb",marginBottom:12}}>
      <div style={{fontSize:17,fontWeight:900,color:"#111",letterSpacing:-0.5}}>日程</div>
      <div style={{fontSize:11,color:"#8e8e93"}}>Komuflow</div>
    </div>
    {[{id:"today",icon:"🏠",l:"今天"},{id:"calendar",icon:"📅",l:"日历"},{id:"stats",icon:"📊",l:"统计"}].map(n=><button key={n.id} onClick={()=>setTab(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",border:"none",background:tab===n.id?"#00000010":"transparent",cursor:"pointer",textAlign:"left",borderRadius:0,color:tab===n.id?"#111":"#555",fontWeight:tab===n.id?700:400,fontSize:14}}><span>{n.icon}</span>{n.l}</button>)}
    <div style={{margin:"16px 16px 0"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,color:"#8e8e93",textTransform:"uppercase",letterSpacing:1}}>标签</span>
        <button onClick={onManage} style={{border:"none",background:"none",color:"#555",fontSize:11,cursor:"pointer",fontWeight:600}}>管理</button>
      </div>
      {labels.map(lb=><div key={lb.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:lb.color,flexShrink:0}}/>
        <span style={{fontSize:12,color:"#555"}}>{lb.emoji} {lb.name}</span>
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
  const openEv=ev=>setModal({t:"edit",ev});
  const addEv=(date,hour)=>setModal({t:"add",date,hour});
  const toggleDone=id=>setEvents(p=>p.map(e=>e.id===id?{...e,done:!e.done}:e));
  const saveEv=ev=>{const tags=autoTag(ev,labels);const fin={...ev,autoTags:tags};setEvents(p=>p.some(e=>e.id===fin.id)?p.map(e=>e.id===fin.id?fin:e):[...p,fin]);setModal(null);};
  const delEv=id=>{setEvents(p=>p.filter(e=>e.id!==id));setModal(null);};
  const TN={today:"今天",calendar:"日历",stats:"统计"};

  const page=<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
    {!desk&&<div style={{padding:"14px 18px 6px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{fontSize:24,fontWeight:900,color:"#111",letterSpacing:-0.5}}>{TN[tab]}</div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setModal({t:"labels"})} style={{border:"1.5px solid #e8e8e8",background:"white",borderRadius:10,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#555"}}>标签</button>
        {/* 今日页面不显示右上角新建按钮，功能已移至右下角蓝色FAB */}
        {tab!=="today"&&tab!=="stats"&&<button onClick={()=>addEv(todayStr(),9)} style={{border:"none",background:"#333",borderRadius:10,padding:"6px 12px",fontSize:12,color:"white",cursor:"pointer",fontWeight:600}}>+ 新建</button>}
      </div>
    </div>}
    {tab==="today"&&<TodayPage events={events} labels={labels} onOpen={openEv} onAdd={addEv} onToggle={toggleDone}/>}
    {tab==="calendar"&&<CalendarPage events={events} labels={labels} onOpen={openEv} onAdd={addEv}/>}
    {tab==="stats"&&<StatsPage events={events} labels={labels} onOpen={openEv}/>}
    {!desk&&<div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.95)",backdropFilter:"blur(10px)",borderTop:"1px solid #ebebeb",display:"flex",padding:"8px 0 16px"}}>
      {[{id:"today",icon:"🏠",l:"今天"},{id:"calendar",icon:"📅",l:"即将"},{id:"stats",icon:"📊",l:"统计"}].map(n=><button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:tab===n.id?"#111":"#8e8e93"}}>
        <span style={{fontSize:22}}>{n.icon}</span><span style={{fontSize:10,fontWeight:tab===n.id?700:400}}>{n.l}</span>
      </button>)}
    </div>}
  </div>;

  return <div style={{fontFamily:"-apple-system,'Helvetica Neue',sans-serif",height:"100vh",display:"flex",overflow:"hidden",background:"white"}}>
    <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:3px;}input[type=date],input[type=time]{-webkit-appearance:none;}.hide-scrollbar::-webkit-scrollbar{display:none;}`}</style>
    {desk&&<Sidebar tab={tab} setTab={setTab} labels={labels} onManage={()=>setModal({t:"labels"})}/>}
    {desk?<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{height:48,borderBottom:"1px solid #ebebeb",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",flexShrink:0}}>
        <span style={{fontSize:15,fontWeight:700}}>{TN[tab]}</span>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setModal({t:"labels"})} style={{border:"1.5px solid #e8e8e8",background:"white",borderRadius:10,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#555"}}>管理标签</button>
          {/* 今日页不显示桌面端右上角新建按钮，功能移到右下角FAB */}
          {tab!=="today"&&tab!=="stats"&&<button onClick={()=>addEv(todayStr(),9)} style={{border:"none",background:"#333",borderRadius:10,padding:"6px 14px",fontSize:12,color:"white",cursor:"pointer",fontWeight:600}}>+ 新建</button>}
        </div>
      </div>
      {page}
    </div>:page}
    {/* 新建任务弹窗 — Modal title hidden to avoid duplicate close button; EventForm内部不再有close按钮 */}
    {modal?.t==="add"&&<Modal title="新建事项" onClose={()=>setModal(null)}>
      <EventForm labels={labels} onSave={saveEv} onDelete={delEv} onClose={()=>setModal(null)} initialDate={modal.date} initialHour={modal.hour}/>
    </Modal>}
    {modal?.t==="edit"&&<Modal title="编辑事项" onClose={()=>setModal(null)}>
      <EventForm ev={modal.ev} labels={labels} onSave={saveEv} onDelete={delEv} onClose={()=>setModal(null)}/>
    </Modal>}
    {modal?.t==="labels"&&<Modal title="管理标签" onClose={()=>setModal(null)} width={520}><LabelManager labels={labels} onSave={ls=>{setLabels(ls);setModal(null);}}/></Modal>}
  </div>;
}

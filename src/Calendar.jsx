import React,{useMemo,useState} from 'react'
import {useApp} from '../state'
import {Card,Empty,PageTitle} from '../components/UI'
import '../extra.css'
const iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x}
const weekStart=d=>{const x=new Date(d);const k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);x.setHours(12,0,0,0);return x}
const dayLabel=d=>new Date(d).toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short'})
export default function Calendar(){
 const{data}=useApp()
 const[view,setView]=useState('month'),[cursor,setCursor]=useState(()=>{const d=new Date();d.setHours(12,0,0,0);return d}),[prop,setProp]=useState('all'),[open,setOpen]=useState(null)
 const todayIso=iso(new Date())
 const byDay=useMemo(()=>{const m={};(data.tasks||[]).forEach(t=>{if(!t.due_date)return;if(prop!=='all'&&String(t.property_id)!==prop)return;const k=String(t.due_date).slice(0,10);(m[k]=m[k]||[]).push(t)});return m},[data.tasks,prop])
 const step=n=>{const d=new Date(cursor);if(view==='month')d.setMonth(d.getMonth()+n);else if(view==='week')d.setDate(d.getDate()+7*n);else d.setDate(d.getDate()+n);setCursor(d)}
 const title=view==='month'?cursor.toLocaleDateString('en-ZA',{month:'long',year:'numeric'}):view==='week'?'Week of '+dayLabel(weekStart(cursor)):dayLabel(cursor)
 const Item=({t})=><div className="cal-item"><b>{t.title}</b><small>{t.property_name||'All properties'} • {t.assigned_name||'Unassigned'} • {t.status} • {t.priority}</small>{t.description&&<small>{t.description}</small>}</div>
 let body
 if(view==='month'){
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1,12);const start=weekStart(first);const cells=[...Array(42)].map((_,i)=>addDays(start,i))
  body=<div className="cal-month">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=><div key={x} className="cal-dow">{x}</div>)}{cells.map(d=>{const k=iso(d);const list=byDay[k]||[];return <button key={k} className={'cal-cell'+(d.getMonth()!==cursor.getMonth()?' out':'')+(k===todayIso?' today':'')} onClick={()=>{setCursor(d);setView('day')}}><b>{d.getDate()}</b>{list.slice(0,3).map(t=><span key={t.id} className={'cal-chip '+(t.status==='done'?'done':t.priority)}>{t.title}</span>)}{list.length>3&&<span>+{list.length-3} more</span>}</button>})}</div>
 }else if(view==='week'){
  const s=weekStart(cursor)
  body=<div className="cal-week">{[...Array(7)].map((_,i)=>{const d=addDays(s,i),k=iso(d),list=byDay[k]||[];return <div key={k} className={'cal-day'+(k===todayIso?' today':'')}><strong>{dayLabel(d)}</strong>{list.length?list.map(t=><Item key={t.id} t={t}/>):<small>Nothing planned</small>}</div>})}</div>
 }else{
  const list=byDay[iso(cursor)]||[]
  body=<Card>{list.length?list.map(t=><Item key={t.id} t={t}/>):<Empty text="Nothing planned for this day. Add a task with a due date on the Tasks page."/>}</Card>
 }
 return <><PageTitle title="Work calendar" subtitle="See the work programme by day, week or month. Tasks appear on their due date."/>
 <div className="cal-bar"><button onClick={()=>step(-1)}>‹ Back</button><div className="cal-title">{title}</div><button onClick={()=>step(1)}>Next ›</button><button onClick={()=>{const d=new Date();d.setHours(12,0,0,0);setCursor(d)}}>Today</button></div>
 <div className="cal-bar">{['day','week','month'].map(v=><button key={v} className={view===v?'on':''} onClick={()=>setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}<select value={prop} onChange={e=>setProp(e.target.value)}><option value="all">All properties</option>{data.properties.map(p=><option key={p.id} value={String(p.id)}>{p.name}</option>)}</select></div>
 {body}</>
}
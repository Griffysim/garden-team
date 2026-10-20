import React,{useEffect} from 'react'
import {useApp} from '../state'
export const Card=({children,className=''})=><section className={'card '+className}>{children}</section>
export const PageTitle=({title,subtitle,actions})=><div className="page-title"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="page-actions">{actions}</div>}</div>
export const Badge=({children,tone=''})=><span className={'badge '+tone}>{String(children||'').replaceAll('_',' ')}</span>
export const Field=({label,children,hint})=><label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>
export const Empty=({text='Nothing recorded yet.'})=><div className="empty">{text}</div>
export const Modal=({title,onClose,children})=><div className="modal-bg" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}>×</button></div>{children}</div></div>
export function Notice(){const{notice,setNotice}=useApp();useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(null),4000);return()=>clearTimeout(t)},[notice,setNotice]);return notice?<div className={'notice '+notice.type}>{notice.text}</div>:null}
export const Spinner=()=> <div className="spinner-wrap"><div className="spinner"/><p>Loading the garden records…</p></div>
const parsedDate=v=>{if(!v)return null;const raw=String(v),date=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(raw+'T00:00:00'):new Date(raw);return Number.isNaN(date.getTime())?null:date}
export const fmtDate=v=>{const date=parsedDate(v);return date?new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium'}).format(date):'—'}
export const fmtTime=v=>{const date=parsedDate(v);return date?new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short'}).format(date):'—'}
export const today=()=>new Date().toISOString().slice(0,10)

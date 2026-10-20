import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react'
const C=createContext(null)
export function AppProvider({children}){
 const [token,setToken]=useState(localStorage.getItem('garden_token')||'')
 const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('garden_user')||'null'))
 const [data,setData]=useState(null),[loading,setLoading]=useState(!!token),[notice,setNotice]=useState(null)
 const api=useCallback(async(path,options={})=>{
  const res=await fetch('/api'+path,{...options,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{ }),...(options.headers||{})}})
  const body=await res.json().catch(()=>({}))
  if(res.status===401 && path!='/auth/login'){ localStorage.removeItem('garden_token');localStorage.removeItem('garden_user');setToken('');setUser(null) }
  if(!res.ok) throw new Error(body.error||'Request failed')
  return body
 },[token])
 const refresh=useCallback(async()=>{ if(!token)return;setLoading(true);try{setData(await api('/bootstrap'))}catch(e){setNotice({type:'error',text:e.message})}finally{setLoading(false)}},[api,token])
 useEffect(()=>{refresh()},[refresh])
 const login=async(email,password)=>{setLoading(true);try{const out=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});setToken(out.token);setUser(out.user);localStorage.setItem('garden_token',out.token);localStorage.setItem('garden_user',JSON.stringify(out.user))}catch(error){setLoading(false);throw error}}
 const logout=()=>{setToken('');setUser(null);setData(null);localStorage.removeItem('garden_token');localStorage.removeItem('garden_user')}
 const act=async(path,options,success='Saved')=>{try{await api(path,options);setNotice({type:'success',text:success});await refresh();return true}catch(e){setNotice({type:'error',text:e.message});return false}}
 const value=useMemo(()=>({token,user,data,loading,notice,setNotice,api,refresh,login,logout,act,canManage:['supervisor','owner'].includes(user?.role)}),[token,user,data,loading,notice,api,refresh])
 return <C.Provider value={value}>{children}</C.Provider>
}
export const useApp=()=>useContext(C)

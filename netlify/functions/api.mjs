import { neon } from '@neondatabase/serverless'
import { SignJWT, jwtVerify } from 'jose'

const db = () => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not configured')
  return neon(url)
}
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || '')
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type':'application/json', 'cache-control':'no-store' }, body: JSON.stringify(body) })
const bodyOf = event => { try { return event.body ? JSON.parse(event.body) : {} } catch { return {} } }
const routeOf = event => {
  const path = event.path || event.rawPath || ''
  return '/' + path.replace(/^.*\/api\/?/, '').replace(/^\/+/, '')
}
async function tokenFor(user){
  if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
  return new SignJWT({ role:user.role, name:user.name }).setProtectedHeader({alg:'HS256'}).setSubject(user.id).setIssuedAt().setExpirationTime('7d').sign(secret())
}
async function auth(event){
  const h = event.headers.authorization || event.headers.Authorization || ''
  if(!h.startsWith('Bearer ')) throw Object.assign(new Error('Please sign in'),{status:401})
  try { const {payload}=await jwtVerify(h.slice(7),secret()); return {id:payload.sub,role:payload.role,name:payload.name} }
  catch { throw Object.assign(new Error('Session expired. Please sign in again.'),{status:401}) }
}
const canManage = u => ['supervisor','owner'].includes(u.role)
const requireManage = u => { if(!canManage(u)) throw Object.assign(new Error('Supervisor or owner permission required'),{status:403}) }
const clean = value => typeof value === 'string' ? value.trim() : value

export async function handler(event){
  const method=event.httpMethod, route=routeOf(event), sql=db(), data=bodyOf(event)
  try{
    if(method==='OPTIONS') return json(204,{})
    if(method==='POST' && route==='/auth/login'){
      const email=clean(data.email)?.toLowerCase(), password=data.password || ''
      const rows=await sql`SELECT id,name,email,role FROM users WHERE lower(email)=${email} AND active=TRUE AND password_hash=crypt(${password},password_hash) LIMIT 1`
      if(!rows[0]) return json(401,{error:'Incorrect email or password'})
      return json(200,{token:await tokenFor(rows[0]),user:rows[0]})
    }
    const user=await auth(event)
    if(method==='GET' && route==='/bootstrap'){
      const [users,properties,tasks,messages,reads,onboarding,logs,vegetables,equipment,equipmentLogs,accommodation,reviews]=await Promise.all([
        sql`SELECT id,name,email,role FROM users WHERE active=TRUE ORDER BY CASE role WHEN 'supervisor' THEN 1 WHEN 'employee' THEN 2 ELSE 3 END`,
        sql`SELECT * FROM properties WHERE active=TRUE ORDER BY id`,
        sql`SELECT t.*,p.name property_name,u.name assigned_name,c.name created_name FROM tasks t LEFT JOIN properties p ON p.id=t.property_id LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN users c ON c.id=t.created_by ORDER BY CASE t.status WHEN 'done' THEN 2 ELSE 1 END,t.due_date NULLS LAST,t.created_at DESC LIMIT 500`,
        sql`SELECT m.*,s.name sender_name,r.name recipient_name,p.name property_name FROM messages m JOIN users s ON s.id=m.sender_id LEFT JOIN users r ON r.id=m.recipient_id LEFT JOIN properties p ON p.id=m.property_id WHERE m.recipient_id IS NULL OR m.recipient_id=${user.id} OR m.sender_id=${user.id} ORDER BY m.created_at DESC LIMIT 500`,
        sql`SELECT message_id FROM message_reads WHERE user_id=${user.id}`,
        sql`SELECT o.*,u.name signed_name FROM onboarding_items o LEFT JOIN users u ON u.id=o.signed_by ORDER BY phase,sort_order`,
        sql`SELECT l.*,p.name property_name,u.name user_name FROM daily_logs l JOIN properties p ON p.id=l.property_id JOIN users u ON u.id=l.user_id ORDER BY log_date DESC,created_at DESC LIMIT 300`,
        sql`SELECT v.*,p.name property_name,u.name created_name FROM vegetable_records v JOIN properties p ON p.id=v.property_id LEFT JOIN users u ON u.id=v.created_by ORDER BY record_date DESC,created_at DESC LIMIT 500`,
        sql`SELECT e.*,p.name property_name FROM equipment e LEFT JOIN properties p ON p.id=e.property_id ORDER BY e.name`,
        sql`SELECT el.*,e.name equipment_name,u.name user_name FROM equipment_logs el JOIN equipment e ON e.id=el.equipment_id JOIN users u ON u.id=el.user_id ORDER BY log_date DESC,created_at DESC LIMIT 300`,
        sql`SELECT a.*,u.name created_name FROM accommodation_notes a JOIN users u ON u.id=a.created_by WHERE a.visible_to_employee=TRUE OR ${user.role}<>'employee' ORDER BY a.created_at DESC LIMIT 300`,
        sql`SELECT r.*,u.name created_name FROM progress_reviews r LEFT JOIN users u ON u.id=r.created_by ORDER BY review_date DESC LIMIT 100`
      ])
      return json(200,{users,properties,tasks,messages,readMessageIds:reads.map(x=>String(x.message_id)),onboarding,logs,vegetables,equipment,equipmentLogs,accommodation,reviews})
    }
    if(method==='POST' && route==='/tasks'){
      requireManage(user)
      const rows=await sql`INSERT INTO tasks(title,description,property_id,assigned_to,created_by,due_date,priority,status,category) VALUES(${clean(data.title)},${clean(data.description)||''},${data.property_id||null},${data.assigned_to||null},${user.id},${data.due_date||null},${data.priority||'medium'},'todo',${data.category||'general'}) RETURNING *`
      return json(201,rows[0])
    }
    const taskMatch=route.match(/^\/tasks\/(\d+)$/)
    if(method==='PATCH' && taskMatch){
      const existing=await sql`SELECT * FROM tasks WHERE id=${taskMatch[1]} LIMIT 1`; if(!existing[0]) return json(404,{error:'Task not found'})
      if(!canManage(user) && existing[0].assigned_to!==user.id) throw Object.assign(new Error('This task is not assigned to you'),{status:403})
      const status=data.status ?? existing[0].status, completion=data.completion_note ?? existing[0].completion_note, proof=data.proof_note ?? existing[0].proof_note
      const rows=await sql`UPDATE tasks SET status=${status},completion_note=${completion},proof_note=${proof},title=${data.title??existing[0].title},description=${data.description??existing[0].description},due_date=${data.due_date??existing[0].due_date},priority=${data.priority??existing[0].priority},property_id=${data.property_id??existing[0].property_id},assigned_to=${data.assigned_to??existing[0].assigned_to},completed_at=CASE WHEN ${status}='done' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=${taskMatch[1]} RETURNING *`
      return json(200,rows[0])
    }
    if(method==='DELETE' && taskMatch){ requireManage(user); await sql`DELETE FROM tasks WHERE id=${taskMatch[1]}`; return json(200,{ok:true}) }
    if(method==='POST' && route==='/messages'){
      const announcement=!!data.is_announcement
      if(announcement && !canManage(user)) throw Object.assign(new Error('Only Simon or Karen may post an announcement'),{status:403})
      const rows=await sql`INSERT INTO messages(sender_id,recipient_id,property_id,subject,body,is_announcement) VALUES(${user.id},${data.recipient_id||null},${data.property_id||null},${clean(data.subject)||''},${clean(data.body)},${announcement}) RETURNING *`
      return json(201,rows[0])
    }
    const readMatch=route.match(/^\/messages\/(\d+)\/read$/)
    if(method==='POST' && readMatch){ await sql`INSERT INTO message_reads(message_id,user_id) VALUES(${readMatch[1]},${user.id}) ON CONFLICT DO NOTHING`; return json(200,{ok:true}) }
    const onboardMatch=route.match(/^\/onboarding\/(\d+)$/)
    if(method==='PATCH' && onboardMatch){
      const old=await sql`SELECT * FROM onboarding_items WHERE id=${onboardMatch[1]}`; if(!old[0]) return json(404,{error:'Item not found'})
      let status=data.employee_status??old[0].employee_status, employeeNote=data.employee_note??old[0].employee_note, supervisorNote=old[0].supervisor_note, signedBy=old[0].signed_by, signedAt=old[0].signed_at
      if(user.role==='employee' && status==='signed_off') status='ready_for_review'
      if(canManage(user)){ supervisorNote=data.supervisor_note??supervisorNote; if(data.sign_off){status='signed_off';signedBy=user.id;signedAt=new Date().toISOString()} if(data.needs_practice){status='needs_practice';signedBy=null;signedAt=null} }
      const rows=await sql`UPDATE onboarding_items SET employee_status=${status},employee_note=${employeeNote},supervisor_note=${supervisorNote},signed_by=${signedBy},signed_at=${signedAt},updated_at=NOW() WHERE id=${onboardMatch[1]} RETURNING *`
      return json(200,rows[0])
    }
    if(method==='POST' && route==='/logs'){
      const rows=await sql`INSERT INTO daily_logs(log_date,property_id,user_id,weather,priorities,work_completed,problems,next_actions,hours_worked) VALUES(${data.log_date},${data.property_id},${user.id},${data.weather||''},${data.priorities||''},${data.work_completed},${data.problems||''},${data.next_actions||''},${data.hours_worked||null}) ON CONFLICT(log_date,property_id,user_id) DO UPDATE SET weather=EXCLUDED.weather,priorities=EXCLUDED.priorities,work_completed=EXCLUDED.work_completed,problems=EXCLUDED.problems,next_actions=EXCLUDED.next_actions,hours_worked=EXCLUDED.hours_worked RETURNING *`
      return json(201,rows[0])
    }
    const logMatch=route.match(/^\/logs\/(\d+)\/feedback$/)
    if(method==='PATCH' && logMatch){ requireManage(user); const rows=await sql`UPDATE daily_logs SET supervisor_feedback=${data.supervisor_feedback||''} WHERE id=${logMatch[1]} RETURNING *`; return json(200,rows[0]) }
    if(method==='POST' && route==='/vegetables'){
      const rows=await sql`INSERT INTO vegetable_records(property_id,bed_name,record_type,record_date,crop,variety,quantity,details,next_action_date,created_by) VALUES(${data.property_id},${clean(data.bed_name)},${data.record_type},${data.record_date},${clean(data.crop)||''},${clean(data.variety)||''},${clean(data.quantity)||''},${clean(data.details)||''},${data.next_action_date||null},${user.id}) RETURNING *`
      return json(201,rows[0])
    }
    if(method==='POST' && route==='/equipment/logs'){
      const rows=await sql`INSERT INTO equipment_logs(equipment_id,user_id,log_date,precheck_passed,hours_used,fuel_used,fault,action_taken) VALUES(${data.equipment_id},${user.id},${data.log_date},${!!data.precheck_passed},${data.hours_used||null},${data.fuel_used||''},${data.fault||''},${data.action_taken||''}) RETURNING *`
      if(data.fault) await sql`UPDATE equipment SET condition='attention' WHERE id=${data.equipment_id} AND condition='good'`
      return json(201,rows[0])
    }
    const equipMatch=route.match(/^\/equipment\/(\d+)$/)
    if(method==='PATCH' && equipMatch){ requireManage(user); const rows=await sql`UPDATE equipment SET condition=COALESCE(${data.condition||null},condition),service_due=COALESCE(${data.service_due||null},service_due),notes=COALESCE(${data.notes??null},notes) WHERE id=${equipMatch[1]} RETURNING *`; return json(200,rows[0]) }
    if(method==='POST' && route==='/accommodation'){
      if(user.role==='employee' && data.category!=='request') throw Object.assign(new Error('Msesa may add accommodation requests; Simon and Karen manage other notes'),{status:403})
      const rows=await sql`INSERT INTO accommodation_notes(title,body,category,status,created_by,visible_to_employee) VALUES(${clean(data.title)},${clean(data.body)},${data.category||'general'},'open',${user.id},${data.visible_to_employee!==false}) RETURNING *`
      return json(201,rows[0])
    }
    const accomMatch=route.match(/^\/accommodation\/(\d+)$/)
    if(method==='PATCH' && accomMatch){ requireManage(user); const rows=await sql`UPDATE accommodation_notes SET status=COALESCE(${data.status||null},status),title=COALESCE(${data.title||null},title),body=COALESCE(${data.body||null},body),visible_to_employee=COALESCE(${typeof data.visible_to_employee==='boolean'?data.visible_to_employee:null},visible_to_employee),updated_at=NOW() WHERE id=${accomMatch[1]} RETURNING *`; return json(200,rows[0]) }
    if(method==='POST' && route==='/reviews'){
      requireManage(user)
      const rows=await sql`INSERT INTO progress_reviews(review_date,phase,safety,time_management,quality,equipment_care,vegetable_management,communication,strengths,improvement,goals,created_by) VALUES(${data.review_date},${data.phase},${data.safety},${data.time_management},${data.quality},${data.equipment_care},${data.vegetable_management},${data.communication},${data.strengths||''},${data.improvement||''},${data.goals||''},${user.id}) RETURNING *`
      return json(201,rows[0])
    }
    if(method==='POST' && route==='/auth/change-password'){
      if(!data.current_password || !data.new_password || data.new_password.length<12) return json(400,{error:'New password must contain at least 12 characters'})
      const ok=await sql`SELECT id FROM users WHERE id=${user.id} AND password_hash=crypt(${data.current_password},password_hash)`; if(!ok[0]) return json(400,{error:'Current password is incorrect'})
      await sql`UPDATE users SET password_hash=crypt(${data.new_password},gen_salt('bf',12)) WHERE id=${user.id}`; return json(200,{ok:true})
    }
    return json(404,{error:'Not found'})
  }catch(error){ console.error(error); return json(error.status||500,{error:error.status?error.message:'Server error. Check configuration and logs.'}) }
}

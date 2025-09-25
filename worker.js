// worker.js
// ✅ RY7 Login & Codes Dashboard on Cloudflare Workers + D1
// --------------------------------------------------------
// - /api/activate    : تفعيل كود وربطه بجهاز، وتوليد كود بديل تلقائي بنفس النوع
// - /api/generate    : توليد أكواد (شهري/سنوي) بعدد محدد
// - /api/list        : جلب القوائم (أكواد جديدة/مستخدمة/منتهية)
// - /api/delete      : حذف كود
// - /api/reset       : إعادة تعيين كود (فصل الجهاز عن الكود)
// - /api/bulk_import : استيراد أكواد يدوية (سطر لكل كود) بنوع محدد
// - /api/status      : فحص حالة الـ API
// - /admin           : لوحة إدارة (HTML مضمنة هنا) — تتطلب ADMIN_TOKEN
//
// 🔐 كل المسارات الإدارية تحتاج التوكن عبر:
//   - هيدر:  X-Admin-Token: <ADMIN_TOKEN>
//   - أو   : /admin?token=<ADMIN_TOKEN>
//
// 🗃️ الاعتماد على قاعدة D1 (binding: RY7_CODES)
// ومتغير البيئة للتوكن:
// [vars]
// ADMIN_TOKEN = "RY7YYAPICODESB"

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function textResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

// ✅ لوحة الأكواد HTML مضمنة مباشرة (بدل admin.html خارجي)
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>لوحة أكواد RY7</title>
<style>
  body{font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0f17;color:#e6edf3;margin:0;padding:16px}
  h1,h2{margin:8px 0}
  .wrap{max-width:980px;margin:0 auto}
  .card{background:#111827;border:1px solid #223; border-radius:12px; padding:16px; margin:12px 0}
  input,select,button,textarea{font-size:16px;padding:10px;border-radius:8px;border:1px solid #334;background:#0d1320;color:#e6edf3}
  button{cursor:pointer}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{border-bottom:1px solid #223;padding:8px;text-align:right}
  .muted{color:#9aa4b2}
  .mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace}
  .actions button{margin-inline-start:6px}
</style>
</head>
<body>
<div class="wrap">
  <h1>لوحة أكواد RY7</h1>
  <div class="card">
    <div class="row">
      <label>النوع:</label>
      <select id="genType"><option value="monthly">شهري</option><option value="yearly">سنوي</option></select>
      <label>العدد:</label>
      <input id="genCount" type="number" value="5" min="1" max="200"/>
      <button id="btnGen">توليد أكواد</button>
      <button id="btnRefresh">تحديث</button>
    </div>
    <textarea id="bulkBox" rows="4" style="width:100%;margin-top:8px" placeholder="RYABC123&#10;RYXYZ789"></textarea>
    <div id="msg" class="muted" style="margin-top:8px"></div>
  </div>
  <div class="card"><h2>أكواد جديدة</h2><div id="unused"></div></div>
  <div class="card"><h2>أكواد مستخدمة</h2><div id="used"></div></div>
  <div class="card"><h2>أكواد منتهية</h2><div id="expired"></div></div>
</div>
<script>
const token = new URLSearchParams(location.search).get("token") || "";
function api(path,opt={}){opt.headers=Object.assign({},opt.headers||{},{"X-Admin-Token":token,"Content-Type":"application/json"});return fetch(path,opt).then(r=>r.json());}
function setMsg(m){document.getElementById('msg').textContent=m||"";}
function tableFor(list){if(!list||!list.length)return "<div class='muted'>لا يوجد</div>";return "<table><thead><tr><th>الكود</th><th>النوع</th><th>الجهاز</th><th>التطبيق</th><th>آخر استخدام</th><th>إجراءات</th></tr></thead><tbody>"+list.map(r=>\`<tr><td class="mono">\${r.code}</td><td>\${r.type}</td><td>\${r.deviceId||"-"}</td><td>\${r.bundleId||"-"}</td><td>\${r.usedAt?new Date(r.usedAt).toLocaleString("ar-SA"):"-"}</td><td class="actions"><button onclick="delCode('\${r.code}')">حذف</button><button onclick="resetCode('\${r.code}')">إعادة</button></td></tr>\`).join("")+"</tbody></table>";}
function refresh(){api('/api/list').then(j=>{document.getElementById('unused').innerHTML=tableFor(j.unused);document.getElementById('used').innerHTML=tableFor(j.used);document.getElementById('expired').innerHTML=tableFor(j.expired);setMsg("👌 تم التحديث");}).catch(e=>setMsg("خطأ"));}
function delCode(code){api('/api/delete',{method:'POST',body:JSON.stringify({code})}).then(_=>{setMsg("🗑️ حذف");refresh();});}
function resetCode(code){api('/api/reset',{method:'POST',body:JSON.stringify({code})}).then(_=>{setMsg("♻️ إعادة");refresh();});}
document.getElementById('btnRefresh').onclick=refresh;
document.getElementById('btnGen').onclick=()=>{const type=document.getElementById('genType').value;const count=parseInt(document.getElementById('genCount').value||1);api('/api/generate',{method:'POST',body:JSON.stringify({type,count})}).then(j=>{setMsg(j.message);refresh();});};
refresh();
</script>
</body></html>`;

// 🔠 مولد الأكواد
const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len=8){return Array.from({length:len},()=>ALPH[Math.floor(Math.random()*ALPH.length)]).join("");}

function isAdmin(request,env,url){const q=url.searchParams.get("token");const h=request.headers.get("X-Admin-Token");return !!env.ADMIN_TOKEN&&(q===env.ADMIN_TOKEN||h===env.ADMIN_TOKEN);}

const CREATE_SQL=`CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY,type TEXT NOT NULL,deviceId TEXT,bundleId TEXT,usedAt INTEGER DEFAULT 0,createdAt INTEGER DEFAULT 0);`;
async function ensureSchema(env){await env.RY7_CODES.exec(CREATE_SQL);}
function splitLists(rows){const now=Date.now();const dur=(t)=>(t==="yearly"?365:30)*86400000;const unused=[],used=[],expired=[];for(const r of rows){if(!r.deviceId){unused.push(r);continue;}const end=(r.usedAt||0)+dur(r.type);if(now>=end)expired.push(r);else used.push(r);}return{unused,used,expired};}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);const path=url.pathname;
    try{
      if(path==="/admin"){if(!isAdmin(request,env,url))return textResponse("<h3>Unauthorized</h3>",401);return textResponse(ADMIN_HTML);}
      await ensureSchema(env);

      // ✅ تفعيل الكود
      if(path==="/api/activate"&&request.method==="POST"){
        const {code,deviceId,bundleId,deviceName}=await request.json().catch(()=>({}));
        if(!code)return jsonResponse({success:false,message:"⚠️ أرسل الكود"},400);
        const row=await env.RY7_CODES.prepare("SELECT * FROM codes WHERE code=?").bind(code).first();
        if(!row)return jsonResponse({success:false,message:"🚫 غير موجود"},400);
        const durationDays=row.type==="yearly"?365:30;
        if(row.deviceId&&row.deviceId!==deviceId)return jsonResponse({success:false,message:"🚫 مستخدم بجهاز آخر"},400);
        if(!row.deviceId){
          await env.RY7_CODES.prepare("UPDATE codes SET deviceId=?,bundleId=?,usedAt=? WHERE code=?").bind(deviceId||"unknown",bundleId||"unknown",Date.now(),code).run();
          await env.RY7_CODES.prepare("INSERT INTO codes (code,type,createdAt) VALUES (?,?,?)").bind(randomCode(8),row.type,Date.now()).run();
        }
        let remainingDays=durationDays;
        if(row.usedAt&&row.deviceId===deviceId){
          const elapsed=Math.floor((Date.now()-row.usedAt)/86400000);
          remainingDays=Math.max(durationDays-elapsed,0);
        }
        return jsonResponse({success:true,type:row.type,remainingDays,message:`🎉 تم التفعيل\n📱 ${deviceName||"?"}\n📦 ${bundleId||"?"}\n⏳ ${remainingDays} يوم`});
      }

      // 🔐 مسارات الإدارة
      const adminNeeded=["/api/generate","/api/list","/api/delete","/api/reset","/api/bulk_import"];
      if(adminNeeded.includes(path)&&!isAdmin(request,env,url))return jsonResponse({success:false,message:"Unauthorized"},401);

      if(path==="/api/generate"&&request.method==="POST"){
        const {type,count}=await request.json().catch(()=>({}));
        if(!["monthly","yearly"].includes(type))return jsonResponse({success:false,message:"❌ النوع غير صحيح"},400);
        const n=Math.max(1,Math.min(200,parseInt(count||1)));const out=[];
        for(let i=0;i<n;i++){const c=randomCode(8);await env.RY7_CODES.prepare("INSERT INTO codes (code,type,createdAt) VALUES (?,?,?)").bind(c,type,Date.now()).run();out.push(c);}
        return jsonResponse({success:true,generated:out,message:`✅ ${out.length} كود`});
      }

      if(path==="/api/list"&&request.method==="GET"){
        const res=await env.RY7_CODES.prepare("SELECT * FROM codes ORDER BY createdAt DESC").all();
        const {unused,used,expired}=splitLists(res.results||[]);
        return jsonResponse({success:true,unused,used,expired});
      }

      if(path==="/api/delete"&&request.method==="POST"){
        const {code}=await request.json().catch(()=>({}));
        await env.RY7_CODES.prepare("DELETE FROM codes WHERE code=?").bind(code).run();
        return jsonResponse({success:true,message:"🗑️ حذف "+code});
      }

      if(path==="/api/reset"&&request.method==="POST"){
        const {code}=await request.json().catch(()=>({}));
        await env.RY7_CODES.prepare("UPDATE codes SET deviceId=NULL,bundleId=NULL,usedAt=0 WHERE code=?").bind(code).run();
        return jsonResponse({success:true,message:"♻️ إعادة "+code});
      }

      if(path==="/api/bulk_import"&&request.method==="POST"){
        const {type,codes}=await request.json().catch(()=>({}));
        let ok=0,dup=0,bad=0;
        for(const raw of codes||[]){
          const c=String(raw||"").trim().toUpperCase();
          if(!/^[A-Z0-9]{8}$/.test(c)){bad++;continue;}
          try{await env.RY7_CODES.prepare("INSERT INTO codes (code,type,createdAt) VALUES (?,?,?)").bind(c,type,Date.now()).run();ok++;}
          catch(e){dup++;}
        }
        return jsonResponse({success:true,message:`✅ ${ok} | مكرر ${dup} | غير صالح ${bad}`});
      }

      if(path==="/api/status"){return jsonResponse({success:true,message:"✅ API يعمل"});}
      return jsonResponse({success:false,message:"❌ مسار غير موجود"},404);
    }catch(err){return jsonResponse({success:false,message:"❌ خطأ: "+err.message},500);}
  }
};
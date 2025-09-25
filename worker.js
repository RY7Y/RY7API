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
  :root{
    --bg:#0b0f17;--card:#101726;--muted:#9aa4b2;--line:#1e2a3a;
    --txt:#e6edf3;--brand:#6ee7ff;--brand2:#8b5cf6;--good:#22c55e;--bad:#ef4444;--warn:#f59e0b;
  }
  *{box-sizing:border-box}
  body{font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,rgba(139,92,246,.18),transparent),linear-gradient(180deg,rgba(110,231,255,.08),transparent 50%),var(--bg);color:var(--txt);margin:0}
  .wrap{max-width:1120px;margin:auto;padding:22px}
  h1{margin:8px 0 18px;font-size:34px;letter-spacing:.5px}
  .sub{color:var(--muted);font-size:14px;margin-top:-4px}
  .card{background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:16px;padding:16px;margin:14px 0;box-shadow:0 6px 24px rgba(0,0,0,.12)}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  input,select,button,textarea{font-size:16px;padding:12px 12px;border-radius:12px;border:1px solid var(--line);background:#0d1320;color:var(--txt);outline:none}
  input:focus,select:focus,textarea:focus{border-color:#334b6b;box-shadow:0 0 0 3px rgba(110,231,255,.18)}
  .btn{cursor:pointer;border:none;display:inline-flex;align-items:center;gap:8px;padding:12px 14px;border-radius:12px;background:linear-gradient(90deg,var(--brand),var(--brand2));color:#051018;font-weight:700}
  .btn.ghost{background:transparent;border:1px solid var(--line);color:var(--txt)}
  .btn.warn{background:linear-gradient(90deg,#fca5a5,#fb7185);color:#160a0a}
  .btn svg{width:18px;height:18px}
  .split{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:920px){.split{grid-template-columns:1fr}}
  .toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:#0e1625;color:var(--muted);font-size:13px}
  .list h2{margin:0 0 10px;font-size:22px}
  table{width:100%;border-collapse:collapse}
  th,td{border-bottom:1px solid var(--line);padding:10px;text-align:right}
  th{color:var(--muted);font-weight:600}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  .badge{padding:4px 10px;border-radius:999px;font-size:12px;border:1px solid var(--line);display:inline-flex;align-items:center;gap:6px}
  .b-new{background:#0b2a1a;border-color:#173929;color:#8ef3b6}
  .b-active{background:#071b2a;border-color:#15324b;color:#60d5ff}
  .b-exp{background:#2a0b0e;border-color:#3f0d12;color:#fca5a5}
  .muted{color:var(--muted)}
  .actions{display:flex;gap:6px}
  .iconbtn{background:transparent;border:1px solid var(--line);border-radius:10px;padding:8px;cursor:pointer}
  .iconbtn:hover{border-color:#375072}
  .hint{font-size:12px;color:var(--muted)}
  .toast{position:fixed;inset-inline:0;bottom:18px;margin:auto;background:rgba(13,19,32,.96);backdrop-filter:blur(8px);color:var(--txt);border:1px solid var(--line);padding:12px 14px;border-radius:12px;max-width:420px;text-align:center;box-shadow:0 10px 36px rgba(0,0,0,.3);display:none}
  .spinner{width:18px;height:18px;border-radius:50%;border:3px solid #27415f;border-left-color:var(--brand);animation:s .8s linear infinite}
  @keyframes s{to{transform:rotate(360deg)}}
  details{border:1px dashed var(--line);border-radius:12px;padding:10px}
  details[open]{background:#0c1524}
  summary{cursor:pointer;color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
  <h1>لوحة أكواد RY7</h1>
  <div class="sub">إدارة الأكواد مع D1: توليد، استيراد، متابعة الحالة والمدة المتبقية.</div>

  <div class="card">
    <div class="toolbar">
      <span class="pill">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>
        <label>النوع:</label>
        <select id="genType">
          <option value="monthly">شهري (30 يوم)</option>
          <option value="yearly">سنوي (365 يوم)</option>
        </select>
      </span>
      <span class="pill">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 11h10v2H7z"/></svg>
        <label>العدد:</label>
        <input id="genCount" type="number" value="5" min="1" max="200" style="width:90px"/>
      </span>

      <button id="btnGen" class="btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 100 18 9 9 0 000-18zm1 9V7h-2v7h6v-2h-4z"/></svg>
        توليد أكواد
      </button>

      <button id="btnRefresh" class="btn ghost">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6V3L8 7l4 4V8a4 4 0 11-4 4H6a6 6 0 106-6z"/></svg>
        تحديث
      </button>

      <div id="liveBadge" class="pill" style="margin-inline-start:auto">
        <span class="spinner"></span>
        <span>جارِ التحديث...</span>
      </div>
    </div>

    <details style="margin-top:12px">
      <summary>استيراد دفعي (سطر لكل كود) — يدعم monthly / yearly</summary>
      <div class="row" style="margin:10px 0">
        <select id="impType"><option value="monthly">شهري</option><option value="yearly">سنوي</option></select>
        <button id="btnImport" class="btn">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zM12 2l5 5h-3v6h-4V7H7l5-5z"/></svg>
          استيراد
        </button>
        <span class="hint">أدخل الأكواد أدناه (حروف/أرقام 8 خانات)</span>
      </div>
      <textarea id="bulkBox" rows="4" style="width:100%;resize:vertical" placeholder="RYABC123&#10;RYXYZ789"></textarea>
    </details>

    <div id="generatedBox" class="card" style="margin-top:12px;display:none">
      <div class="row" style="justify-content:space-between;align-items:center">
        <strong>أكواد تم توليدها الآن</strong>
        <button id="btnCopyAll" class="btn ghost">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14h13c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          نسخ الكل
        </button>
      </div>
      <div id="genList" class="mono" style="margin-top:8px;white-space:pre-wrap"></div>
    </div>

    <div id="msg" class="muted" style="margin-top:6px"></div>
  </div>

  <div class="split">
    <div class="card list">
      <h2>أكواد جديدة</h2>
      <div id="unused"></div>
    </div>
    <div class="card list">
      <h2>أكواد مستخدمة</h2>
      <div id="used"></div>
    </div>
  </div>

  <div class="card list">
    <h2>أكواد منتهية</h2>
    <div id="expired"></div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
/* ===== Helpers ===== */
const token = new URLSearchParams(location.search).get("token") || "";
function api(path, opt={}) {
  opt.headers = Object.assign({}, opt.headers||{}, {"X-Admin-Token": token, "Content-Type":"application/json"});
  return fetch(path, opt).then(async r=>{ const j = await r.json().catch(()=>({})); if(!r.ok){throw j.message||"خطأ غير معروف";} return j; });
}
function setMsg(m){document.getElementById('msg').textContent = m||"";}
function toast(t){const el=document.getElementById('toast'); el.textContent=t; el.style.display='block'; clearTimeout(window.__t); window.__t=setTimeout(()=>el.style.display='none',2200);}
function fmt(t){ if(!t) return "-"; const d=new Date(Number(t)); return d.toLocaleString("ar-SA"); }
function daysLeft(row){
  if(!row.usedAt) return {text:"لم يبدأ بعد", cls:"b-new"};
  const dur = row.type==="yearly"?365:30;
  const end = Number(row.usedAt) + dur*86400000;
  const now = Date.now();
  if(now>=end) return {text:"منتهي", cls:"b-exp"};
  const left = Math.ceil((end-now)/86400000);
  return {text:"نشط • متبقي "+left+" يوم", cls:"b-active"};
}
function statusBadge(row){
  const s = daysLeft(row);
  return '<span class="badge '+s.cls+'"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>'+s.text+'</span>';
}
function emptyBox(txt="لا يوجد بيانات"){ return '<div class="muted">'+txt+'</div>'; }

function tableFor(list){
  if(!list || !list.length) return emptyBox();
  let rows = list.map(r=>{
    const t = r.type==="yearly"?"سنوي":"شهري";
    return \`
      <tr>
        <td class="mono">\${r.code}</td>
        <td>\${t}</td>
        <td>\${statusBadge(r)}</td>
        <td>\${fmt(r.createdAt)}</td>
        <td>\${r.usedAt?fmt(r.usedAt):"-"}</td>
        <td class="mono">\${r.deviceId||"-"}</td>
        <td class="mono">\${r.bundleId||"-"}</td>
        <td class="actions">
          <button class="iconbtn" title="نسخ" onclick="copyCode('\${r.code}')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 1H4a2 2 0 00-2 2v12h2V3h12V1zm3 4H8a2 2 0 00-2 2v14h13a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="iconbtn" title="إعادة تعيين" onclick="resetCode('\${r.code}')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 6V3L8 7l4 4V8a4 4 0 11-4 4H6a6 6 0 106-6z"/></svg>
          </button>
          <button class="iconbtn" title="حذف" onclick="delCode('\${r.code}')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 7h12v2H6zm2 3h8l-1 10H9L8 10zm3-6h2l1 2H10l1-2z"/></svg>
          </button>
        </td>
      </tr>\`;
  }).join("");
  return \`
    <div style="overflow:auto">
      <table>
        <thead>
          <tr>
            <th>الكود</th>
            <th>النوع</th>
            <th>الحالة</th>
            <th>تم الإنشاء</th>
            <th>آخر استخدام</th>
            <th>الجهاز</th>
            <th>التطبيق</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>\${rows}</tbody>
      </table>
    </div>\`;
}

/* ===== Actions ===== */
const live = document.getElementById('liveBadge');

function refresh(){
  live.style.display='inline-flex';
  api('/api/list').then(j=>{
    document.getElementById('unused').innerHTML = tableFor(j.unused);
    document.getElementById('used').innerHTML   = tableFor(j.used);
    document.getElementById('expired').innerHTML= tableFor(j.expired);
    setMsg("👌 تم التحديث");
  }).catch(e=>{
    setMsg("خطأ: "+e);
    toast("خطأ أثناء جلب البيانات");
  }).finally(()=>{ live.style.display='none'; });
}

function delCode(code){
  if(!confirm("حذف الكود "+code+" ؟")) return;
  api('/api/delete',{method:'POST', body:JSON.stringify({code})})
    .then(_=>{ toast("🗑️ تم الحذف"); refresh(); })
    .catch(e=>toast("خطأ: "+e));
}

function resetCode(code){
  if(!confirm("إعادة تعيين الكود "+code+" (مسح الجهاز المرتبط) ؟")) return;
  api('/api/reset',{method:'POST', body:JSON.stringify({code})})
    .then(_=>{ toast("♻️ تم إعادة التعيين"); refresh(); })
    .catch(e=>toast("خطأ: "+e));
}

function copyCode(code){
  navigator.clipboard.writeText(code).then(()=>toast("تم نسخ "+code));
}

document.getElementById('btnRefresh').onclick = refresh;

document.getElementById('btnGen').onclick = ()=>{
  const type = document.getElementById('genType').value;
  const count = Math.max(1, Math.min(200, parseInt(document.getElementById('genCount').value||"1")));
  live.style.display='inline-flex';
  api('/api/generate',{method:'POST', body:JSON.stringify({type,count})})
    .then(j=>{
      setMsg(j.message||"تم");
      const list = (j.generated||[]).join("\\n");
      if(list){
        document.getElementById('genList').textContent = list;
        document.getElementById('generatedBox').style.display = 'block';
      }
      refresh();
    })
    .catch(e=>toast("خطأ: "+e))
    .finally(()=>{ live.style.display='none'; });
};

document.getElementById('btnImport').onclick = ()=>{
  const type = document.getElementById('impType').value;
  const lines = document.getElementById('bulkBox').value.split(/\\r?\\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length){toast("لا توجد أكواد"); return;}
  live.style.display='inline-flex';
  api('/api/bulk_import',{method:'POST', body:JSON.stringify({type,codes:lines})})
    .then(j=>{ toast(j.message||"تم"); document.getElementById('bulkBox').value=""; refresh(); })
    .catch(e=>toast("خطأ: "+e))
    .finally(()=>{ live.style.display='none'; });
};

document.getElementById('btnCopyAll').onclick = ()=>{
  const txt = document.getElementById('genList').textContent||"";
  if(!txt.trim()) return;
  navigator.clipboard.writeText(txt).then(()=>toast("تم نسخ الأكواد المولدة"));
};

/* init */
refresh();
</script>
</body>
</html>`;

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
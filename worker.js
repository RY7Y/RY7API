// worker.js
// ✅ RY7 Login & Codes Dashboard on Cloudflare Workers + D1
// --------------------------------------------------------
// - /api/activate         : تفعيل كود وربطه بجهاز، وتوليد كود بديل تلقائي
// - /api/generate         : توليد أكواد (شهري/سنوي) بعدد محدد
// - /api/list             : جلب القوائم (أكواد جديدة/مستخدمة/منتهية)
// - /api/delete           : حذف كود
// - /api/reset            : إعادة تعيين كود (إلغاء ربطه بالجهاز)
// - /api/bulk_import      : استيراد أكواد يدوية (سطر لكل كود) بنوع محدد
// - /admin                : يقدم index.html (لوحة الإدارة)
// كل مسارات الإدارة تتطلب ADMIN_TOKEN عبر هيدر X-Admin-Token أو query ?token=...

/* ========= مساعدات عامة ========= */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function textResponse(html, status = 200) {
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// حروف توليد الأكواد (بدون O/0 و I/1 لتجنب اللخبطة)
const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return s;
}

// التحقق من التوكن الإداري
function isAdmin(request, env, url) {
  const q = url.searchParams.get("token");
  const h = request.headers.get("X-Admin-Token");
  return !!env.ADMIN_TOKEN && (q === env.ADMIN_TOKEN || h === env.ADMIN_TOKEN);
}

/* ========= HTML لوحة الإدارة ========= */

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
  .tag{padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid #334}
  .ok{color:#16a34a;border-color:#14532d;background:#052e12}
  .bad{color:#ef4444;border-color:#3f0d12;background:#2a0b0e}
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
      <select id="genType">
        <option value="monthly">شهري (30 يوم)</option>
        <option value="yearly">سنوي (365 يوم)</option>
      </select>
      <label>العدد:</label>
      <input id="genCount" type="number" value="5" min="1" max="200"/>
      <button id="btnGen">توليد أكواد</button>
      <button id="btnRefresh">تحديث القوائم</button>
    </div>
    <div style="margin-top:10px" class="row">
      <label>استيراد دفعـي (سطر لكل كود):</label>
      <select id="impType">
        <option value="monthly">شهري</option>
        <option value="yearly">سنوي</option>
      </select>
      <button id="btnImport">استيراد</button>
    </div>
    <textarea id="bulkBox" rows="4" style="width:100%;margin-top:8px" placeholder="RYABC123\nRYXYZ789"></textarea>
    <div id="msg" class="muted" style="margin-top:8px"></div>
  </div>

  <div class="card">
    <h2>أكواد جديدة / غير مستخدمة</h2>
    <div id="unused"></div>
  </div>

  <div class="card">
    <h2>أكواد مستخدمة</h2>
    <div id="used"></div>
  </div>

  <div class="card">
    <h2>أكواد منتهية</h2>
    <div id="expired"></div>
  </div>
</div>

<script>
const token = new URLSearchParams(location.search).get("token") || "";
function api(path, opt={}) {
  opt.headers = Object.assign({}, opt.headers||{}, {"X-Admin-Token": token, "Content-Type":"application/json"});
  return fetch(path, opt).then(r=>r.json());
}
function el(tag, html){const e=document.createElement(tag); e.innerHTML=html; return e;}
function tableFor(list){
  if(!list || !list.length) return "<div class='muted'>لا يوجد بيانات</div>";
  let rows = list.map(r=>{
    const used = r.deviceId ? \`<span class="tag ok">مستخدم</span>\` : \`<span class="tag">جديد</span>\`;
    const t = r.type==="yearly"?"سنوي":"شهري";
    const ua = r.usedAt ? new Date(r.usedAt).toLocaleString() : "-";
    return \`
      <tr>
        <td class="mono">\${r.code}</td>
        <td>\${t}</td>
        <td>\${r.deviceId||"-"}</td>
        <td>\${r.bundleId||"-"}</td>
        <td>\${ua}</td>
        <td class="actions">
          <button onclick="delCode('\${r.code}')">حذف</button>
          <button onclick="resetCode('\${r.code}')">إعادة تعيين</button>
          <button onclick="copyCode('\${r.code}')">نسخ</button>
        </td>
      </tr>\`;
  }).join("");
  return \`
    <table>
      <thead>
        <tr><th>الكود</th><th>النوع</th><th>الجهاز</th><th>التطبيق</th><th>آخر استخدام</th><th>إجراءات</th></tr>
      </thead>
      <tbody>\${rows}</tbody>
    </table>\`;
}
function setMsg(m){document.getElementById('msg').textContent=m||"";}
function refresh(){
  api('/api/list').then(j=>{
    if(!j.success){setMsg(j.message||"خطأ"); return;}
    document.getElementById('unused').innerHTML = tableFor(j.unused);
    document.getElementById('used').innerHTML   = tableFor(j.used);
    document.getElementById('expired').innerHTML= tableFor(j.expired);
    setMsg("👌 تم التحديث");
  }).catch(e=>setMsg("خطأ: "+e));
}
function delCode(code){
  if(!confirm("حذف الكود "+code+" ?")) return;
  api('/api/delete',{method:'POST', body:JSON.stringify({code})}).then(_=>refresh());
}
function resetCode(code){
  if(!confirm("إعادة تعيين الكود "+code+" (مسح الجهاز المرتبط) ?")) return;
  api('/api/reset',{method:'POST', body:JSON.stringify({code})}).then(_=>refresh());
}
function copyCode(code){
  navigator.clipboard.writeText(code); setMsg("تم نسخ "+code);
}
document.getElementById('btnRefresh').onclick = refresh;
document.getElementById('btnGen').onclick = ()=>{
  const type = document.getElementById('genType').value;
  const count = Math.max(1, Math.min(200, parseInt(document.getElementById('genCount').value||"1")));
  api('/api/generate',{method:'POST', body:JSON.stringify({type,count})})
    .then(j=>{ setMsg(j.message||"تم"); refresh(); });
};
document.getElementById('btnImport').onclick = ()=>{
  const type = document.getElementById('impType').value;
  const lines = document.getElementById('bulkBox').value.split(/\\r?\\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length){setMsg("لا توجد أكواد"); return;}
  api('/api/bulk_import',{method:'POST', body:JSON.stringify({type,codes:lines})})
    .then(j=>{ setMsg(j.message||"تم"); refresh(); });
};
refresh();
</script>
</body></html>`;

/* ========= منطق قاعدة البيانات ========= */

// ننشئ الجدول إن لم يكن موجوداً
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'monthly' | 'yearly'
  deviceId TEXT,                -- UUID الجهاز إن استُخدم
  bundleId TEXT,                -- حزمة التطبيق إن استُخدم
  usedAt INTEGER DEFAULT 0,     -- وقت الاستخدام (ms)
  createdAt INTEGER DEFAULT 0   -- وقت الإنشاء (ms)
);
`;

async function ensureSchema(env) {
  await env.RY7_CODES.exec(CREATE_SQL);
}

// تصنيف القوائم
function splitLists(rows) {
  const now = Date.now();
  const dur = t => (t === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000;
  const unused = [];
  const used = [];
  const expired = [];
  for (const r of rows) {
    if (!r.deviceId) { unused.push(r); continue; }
    const end = (r.usedAt||0) + dur(r.type);
    if (now >= end) expired.push(r); else used.push(r);
  }
  return { unused, used, expired };
}

/* ========= التطبيق الرئيسي ========= */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // قدّم لوحة الإدارة
      if (path === "/admin") {
        if (!isAdmin(request, env, url)) {
          return textResponse("<h3 style='font-family:sans-serif'>Unauthorized</h3>", 401);
        }
        return textResponse(ADMIN_HTML);
      }

      // تأكد من وجود الجدول
      await ensureSchema(env);

      /* ======== تفعيل الكود ======== */
      if (path === "/api/activate") {
        if (request.method !== "POST") {
          return jsonResponse({ success:false, message:"🚫 الطريقة غير مسموحة (POST فقط)" }, 405);
        }
        const body = await request.json().catch(()=> ({}));
        const { code, deviceId, bundleId, deviceName } = body || {};
        if (!code || typeof code !== "string") {
          return jsonResponse({ success:false, message:"⚠️ يرجى إدخال الكود" }, 400);
        }
        if (code.length !== 8) {
          return jsonResponse({ success:false, message:"❌ الكود غير صالح (8 خانات)" }, 400);
        }

        const row = await env.RY7_CODES.prepare("SELECT * FROM codes WHERE code = ?").bind(code).first();
        if (!row) {
          return jsonResponse({ success:false, message:"🚫 الكود غير موجود" }, 400);
        }

        // مدة النوع
        const durationDays = row.type === "yearly" ? 365 : 30;

        // لو الكود مربوط بجهاز آخر
        if (row.deviceId && row.deviceId !== deviceId) {
          return jsonResponse({ success:false, message:"🚫 هذا الكود مستخدم على جهاز آخر" }, 400);
        }

        // لو الكود غير مربوط بعد → اربطه بالجهاز الحالي
        if (!row.deviceId) {
          await env.RY7_CODES
            .prepare("UPDATE codes SET deviceId=?, bundleId=?, usedAt=? WHERE code=?")
            .bind(deviceId || "unknown", bundleId || "unknown", Date.now(), code)
            .run();

          // توليد كود بديل جديد بنفس النوع للمخزون
          const newCode = randomCode(8);
          await env.RY7_CODES
            .prepare("INSERT INTO codes (code, type, createdAt) VALUES (?, ?, ?)")
            .bind(newCode, row.type, Date.now())
            .run();
        }

        // حساب الأيام المتبقية للجهاز نفسه
        let remainingDays = durationDays;
        if (row.usedAt && row.deviceId === deviceId) {
          const elapsed = Math.floor((Date.now() - row.usedAt) / (1000 * 60 * 60 * 24));
          remainingDays = Math.max(durationDays - elapsed, 0);
        }

        return jsonResponse({
          success: true,
          type: row.type,
          remainingDays,
          message: `🎉 تم التفعيل بنجاح\n📱 الجهاز: ${deviceName || "غير معروف"}\n📦 التطبيق: ${bundleId || "غير محدد"}\n🔑 النوع: ${row.type}\n⏳ الصلاحية: ${remainingDays} يوم`
        });
      }

      /* ======== APIs إدارية (تحتاج ADMIN_TOKEN) ======== */
      const adminNeeded = ["/api/generate","/api/list","/api/delete","/api/reset","/api/bulk_import"];
      if (adminNeeded.includes(path)) {
        if (!isAdmin(request, env, url)) {
          return jsonResponse({ success:false, message:"Unauthorized" }, 401);
        }
      }

      // توليد أكواد
      if (path === "/api/generate" && request.method === "POST") {
        const { type, count } = await request.json().catch(()=> ({}));
        if (!["monthly","yearly"].includes(type)) {
          return jsonResponse({ success:false, message:"❌ النوع يجب أن يكون monthly أو yearly" }, 400);
        }
        const n = Math.max(1, Math.min(200, parseInt(count||1)));
        const out = [];
        for (let i=0;i<n;i++){
          const c = randomCode(8);
          await env.RY7_CODES
            .prepare("INSERT INTO codes (code, type, createdAt) VALUES (?, ?, ?)")
            .bind(c, type, Date.now())
            .run();
          out.push(c);
        }
        return jsonResponse({ success:true, generated: out, message:`✅ تم توليد ${out.length} كود (${type})` });
      }

      // قائمة الأكواد
      if (path === "/api/list" && request.method === "GET") {
        const res = await env.RY7_CODES.prepare("SELECT * FROM codes ORDER BY createdAt DESC").all();
        const { unused, used, expired } = splitLists(res.results || []);
        return jsonResponse({ success:true, unused, used, expired });
      }

      // حذف كود
      if (path === "/api/delete" && request.method === "POST") {
        const { code } = await request.json().catch(()=> ({}));
        if (!code) return jsonResponse({ success:false, message:"⚠️ أرسل code" }, 400);
        await env.RY7_CODES.prepare("DELETE FROM codes WHERE code=?").bind(code).run();
        return jsonResponse({ success:true, message:`🗑️ تم حذف ${code}` });
      }

      // إعادة تعيين كود (إلغاء ربطه بالجهاز)
      if (path === "/api/reset" && request.method === "POST") {
        const { code } = await request.json().catch(()=> ({}));
        if (!code) return jsonResponse({ success:false, message:"⚠️ أرسل code" }, 400);
        await env.RY7_CODES
          .prepare("UPDATE codes SET deviceId=NULL, bundleId=NULL, usedAt=0 WHERE code=?")
          .bind(code)
          .run();
        return jsonResponse({ success:true, message:`♻️ تم إعادة تعيين ${code}` });
      }

      // استيراد دفعي
      if (path === "/api/bulk_import" && request.method === "POST") {
        const { type, codes } = await request.json().catch(()=> ({}));
        if (!["monthly","yearly"].includes(type)) {
          return jsonResponse({ success:false, message:"❌ النوع غير صحيح" }, 400);
        }
        if (!Array.isArray(codes) || !codes.length) {
          return jsonResponse({ success:false, message:"⚠️ أرسل مصفوفة أكواد" }, 400);
        }
        let ok=0, dup=0, bad=0;
        for (const raw of codes) {
          const c = String(raw||"").trim().toUpperCase();
          if (!/^[A-Z0-9]{8}$/.test(c)) { bad++; continue; }
          try {
            await env.RY7_CODES
              .prepare("INSERT INTO codes (code, type, createdAt) VALUES (?, ?, ?)")
              .bind(c, type, Date.now())
              .run();
            ok++;
          } catch(e){ dup++; }
        }
        return jsonResponse({ success:true, message:`تم الاستيراد ✅ ${ok} | مكررة ${dup} | غير صالحة ${bad}` });
      }

      /* ======== فحص الحالة ======== */
      if (path === "/api/status") {
        return jsonResponse({ success:true, message:"✅ API يعمل بشكل طبيعي" });
      }

      // غير موجود
      return jsonResponse({ success:false, message:"❌ مسار غير موجود" }, 404);

    } catch (err) {
      return jsonResponse({ success:false, message:"❌ خطأ داخلي: " + err.message }, 500);
    }
  }
};
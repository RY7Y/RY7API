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

// ✅ لوحة الأكواد HTML مضمنة مباشرة
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RY7Code New</title>
<style>
  @font-face {
    font-family: 'MontserratArabic';
    src: url('Montserrat-Arabic-Regular.ttf') format('truetype');
  }

  :root {
    --bg:#0b0f17; --card:#101726; --txt:#e6edf3; --muted:#9aa4b2;
    --line:#1e2a3a; --brand:#6ee7ff; --brand2:#8b5cf6;
    --good:#22c55e; --bad:#ef4444; --warn:#f59e0b; --info:#3b82f6;
  }
  [data-theme="light"] {
    --bg:#f5f5f5; --card:#ffffff; --txt:#222; --muted:#666;
    --line:#ddd; --brand:#06b6d4; --brand2:#9333ea;
    --good:#16a34a; --bad:#dc2626; --warn:#d97706; --info:#2563eb;
  }

*{box-sizing:border-box;font-family:'MontserratArabic',sans-serif}
body{margin:0;background:var(--bg);color:var(--txt);display:flex;justify-content:center;padding:0}
.wrap{width:100%;max-width:1200px;display:flex;flex-direction:column;gap:20px}
header{display:flex;align-items:center;justify-content:center;position:relative}
h1{text-align:center;font-size:28px;margin:10px 0;color:var(--brand2)}
.theme-toggle{position:absolute;right:0;background:transparent;border:1px solid var(--line);border-radius:50%;padding:8px;cursor:pointer;font-size:18px;color:var(--txt)}

.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0;box-shadow:0 4px 12px rgba(0,0,0,0.4)}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center}
select,input,button,textarea{padding:10px 12px;font-size:13px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--txt)}
.btn{background:linear-gradient(90deg,var(--brand),var(--brand2));border:none;color:#fff;font-weight:600;cursor:pointer}
.btn.ghost{background:transparent;color:var(--txt);border:1px solid var(--line)}

table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
th,td{padding:6px;border-bottom:1px solid var(--line);text-align:center}
th{color:var(--muted);font-weight:600;font-size:12px}

.badge{padding:3px 8px;border-radius:999px;font-size:11px;display:inline-block}
.b-new{background:#0b2a1a;color:#22c55e}
.b-active{background:#071b2a;color:#60d5ff}
.b-exp{background:#2a0b0e;color:#ef4444}

.actions{display:flex;gap:8px;justify-content:center}
.iconbtn{border:none;background:transparent;cursor:pointer;padding:6px;border-radius:8px;transition:0.2s}
.iconbtn:hover{background:rgba(255,255,255,0.08)}
.iconbtn svg{width:18px;height:18px}

.alert{position:fixed;bottom:20px;right:20px;min-width:220px;padding:14px 18px;border-radius:16px;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.25);animation:slideIn 0.3s ease;z-index:9999;text-align:right}
.alert svg{width:20px;height:20px;flex-shrink:0}
.alert.success{background:var(--good);color:#fff}
.alert.error{background:var(--bad);color:#fff}
.alert.warn{background:var(--warn);color:#fff}
.alert.info{background:var(--info);color:#fff}

@keyframes slideIn{from{opacity:0;transform:translateX(120%);}to{opacity:1;transform:translateX(0);}}

.tabs{display:flex;gap:10px;justify-content:center;margin-bottom:10px}
.tabs button{flex:1;max-width:140px}
.count{margin-top:6px;text-align:center;font-size:11px;color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>RY7Code New</h1>
    <button class="theme-toggle" onclick="toggleTheme()">☀️/🌙</button>
  </header>

  <div class="card">
    <div class="toolbar">
      <label>النوع:</label>
      <select id="genType"><option value="monthly">شهري</option><option value="yearly">سنوي</option></select>
      <label>العدد:</label>
      <input id="genCount" type="number" value="5" min="1" max="200"/>
      <button id="btnGen" class="btn">توليد أكواد</button>
      <button id="btnRefresh" class="btn ghost">تحديث</button>
      <button id="btnCopyAll" class="btn ghost">نسخ جميع الأكواد</button>
    </div>
    <div id="genOptions" style="display:none;margin-top:10px;text-align:center">
      <button class="btn" onclick="generateRandom()">توليد عشوائي</button>
      <div style="margin-top:8px">
        <input id="prefixInput" type="text" placeholder="اكتب البادئة مثل: RY7" style="width:50%"/>
        <button class="btn ghost" onclick="generateCustom()">توليد مخصص</button>
      </div>
    </div>
    <textarea id="bulkBox" rows="3" style="width:100%;margin-top:8px" placeholder="RYABC123&#10;RYXYZ789"></textarea>
    <button id="btnImport" class="btn" style="margin-top:8px">استيراد دفعي</button>
  </div>

  <div class="card">
    <h2 style="text-align:center">أكواد جديدة</h2>
    <div class="tabs">
      <button class="btn ghost" onclick="filterUnused('monthly')">شهري</button>
      <button class="btn ghost" onclick="filterUnused('yearly')">سنوي</button>
    </div>
    <div id="unused"></div>
    <div id="countUnused" class="count"></div>
  </div>

  <div class="card">
    <h2 style="text-align:center">أكواد مستخدمة</h2>
    <div id="used"></div>
    <div id="countUsed" class="count"></div>
  </div>

  <div class="card">
    <h2 style="text-align:center">أكواد منتهية</h2>
    <div id="expired"></div>
    <div id="countExpired" class="count"></div>
  </div>
</div>

<script>
const token = new URLSearchParams(location.search).get("token") || "";
function api(path,opt={}){opt.headers=Object.assign({},opt.headers||{},{"X-Admin-Token":token,"Content-Type":"application/json"});return fetch(path,opt).then(r=>r.json());}

function alertBox(type,msg){
  const icons={
    success:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>',
    error:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>',
    warn:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01M12 5a7 7 0 100 14 7 7 0 000-14z"/></svg>',
    info:'<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>'
  };
  const div=document.createElement("div");
  div.className="alert "+type;
  div.innerHTML=icons[type]+"<span>"+msg+"</span>";
  document.body.appendChild(div);
  setTimeout(()=>{div.remove();},3000);
}

function fmt(t){return t?new Date(Number(t)).toLocaleString("ar-SA"):"-";}
function status(r){if(!r.usedAt)return'<span class="badge b-new">جديد</span>';const dur=r.type==="yearly"?365:30;const end=r.usedAt+dur*86400000;if(Date.now()>=end)return'<span class="badge b-exp">منتهي</span>';const left=Math.ceil((end-Date.now())/86400000);return'<span class="badge b-active">نشط • متبقي '+left+' يوم</span>';}

function tableFor(list){if(!list.length)return"<div style='text-align:center;color:var(--muted)'>لا يوجد</div>";
  return "<table><thead><tr><th>الكود</th><th>النوع</th><th>الحالة</th><th>الإنشاء</th><th>إجراءات</th></tr></thead><tbody>"+
  list.map(r=>\`<tr>
    <td>\${r.code}</td>
    <td>\${r.type==="yearly"?"سنوي":"شهري"}</td>
    <td>\${status(r)}</td>
    <td style="font-size:10px;color:var(--muted)">\${fmt(r.createdAt)}</td>
    <td class='actions'>
      <button class="iconbtn" onclick="copyCode('\${r.code}')"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 16h8M8 12h8m-6 8h6a2 2 0 002-2V8a2 2 0 00-2-2h-3l-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></button>
      <button class="iconbtn" onclick="resetCode('\${r.code}')"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 1114-14l1 1"/></svg></button>
      <button class="iconbtn" onclick="delCode('\${r.code}')"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg></button>
    </td>
  </tr>\`).join("")+"</tbody></table>";
}

function refresh(){api("/api/list").then(j=>{window.__all=j;
  document.getElementById("unused").innerHTML=tableFor(j.unused);
  document.getElementById("used").innerHTML=tableFor(j.used);
  document.getElementById("expired").innerHTML=tableFor(j.expired);
  document.getElementById("countUnused").textContent="الإجمالي: "+j.unused.length;
  document.getElementById("countUsed").textContent="الإجمالي: "+j.used.length;
  document.getElementById("countExpired").textContent="الإجمالي: "+j.expired.length;
});}

function filterUnused(type){const all=window.__all?.unused||[];document.getElementById("unused").innerHTML=tableFor(all.filter(r=>r.type===type));document.getElementById("countUnused").textContent="الإجمالي: "+all.filter(r=>r.type===type).length;}

function delCode(code){api("/api/delete",{method:"POST",body:JSON.stringify({code})}).then(()=>{alertBox("success","تم الحذف");refresh();});}
function resetCode(code){api("/api/reset",{method:"POST",body:JSON.stringify({code})}).then(()=>{alertBox("info","تمت إعادة التعيين");refresh();});}
function copyCode(code){navigator.clipboard.writeText(code).then(()=>alertBox("success","تم النسخ: "+code));}

// ✅ خيارات التوليد
document.getElementById("btnGen").onclick=()=>{
  document.getElementById("genOptions").style.display="block";
};
function generateRandom(){
  const type=document.getElementById("genType").value;
  const count=parseInt(document.getElementById("genCount").value||1);
  api("/api/generate",{method:"POST",body:JSON.stringify({type,count})}).then(j=>{alertBox("success","تم توليد "+(j.generated||[]).length+" كود عشوائي");refresh();});
  document.getElementById("genOptions").style.display="none";
}
function generateCustom(){
  const type=document.getElementById("genType").value;
  const count=parseInt(document.getElementById("genCount").value||1);
  const prefix=document.getElementById("prefixInput").value||"RY7";
  api("/api/generate",{method:"POST",body:JSON.stringify({type,count,prefix})}).then(j=>{alertBox("success","تم توليد "+(j.generated||[]).length+" كود مخصص");refresh();});
  document.getElementById("genOptions").style.display="none";
}

document.getElementById("btnRefresh").onclick=()=>{refresh();alertBox("info","تم التحديث");};
document.getElementById("btnImport").onclick=()=>{const type=document.getElementById("genType").value;const codes=document.getElementById("bulkBox").value.split(/\\r?\\n/).filter(Boolean);api("/api/bulk_import",{method:"POST",body:JSON.stringify({type,codes})}).then(j=>{alertBox("warn",j.message);refresh();});};
document.getElementById("btnCopyAll").onclick=()=>{const all=[...(window.__all?.unused||[]),...(window.__all?.used||[]),...(window.__all?.expired||[])];if(!all.length)return alertBox("error","لا توجد أكواد");const txt=all.map(r=>r.code).join("\\n");navigator.clipboard.writeText(txt).then(()=>alertBox("success","تم نسخ جميع الأكواد"));};

refresh();
function toggleTheme(){const b=document.body;const isLight=b.getAttribute("data-theme")==="light";b.setAttribute("data-theme",isLight?"dark":"light");}
</script>
</body>
</html>`;

// worker.js — API (موحّد الرسائل: title + message + align:"center")

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
      if(path==="/admin"){if(!isAdmin(request,env,url))return textResponse("<h3>🚫 غير مصرح</h3>",401);return textResponse(ADMIN_HTML);}
      await ensureSchema(env);

      // ✅ تفعيل الكود
      // ===============================
      if (path === "/api/activate" && request.method === "POST") {
        const { code, deviceId, bundleId, deviceName } = await request.json().catch(() => ({}));

        // 1) التحقق من الإدخال
        if (!code) {
          return jsonResponse(
            fail("ادخل الكود اولاً\n ثم اضغط على دخول 🤍", "validation"),
            400
          );
        }

        // 2) جلب السجل
        let row = await env.RY7_CODES.prepare("SELECT * FROM codes WHERE code = ?")
          .bind(code)
          .first();

        if (!row) {
          return jsonResponse(
            fail("الكود غير صحيح\nيرجى كتابة الكود الصحيح 🙂", "invalid_code"),
            400
          );
        }

        const durationDays = row.type === "yearly" ? 365 : 30;

        // 3) مستخدم على جهاز آخر
        if (row.deviceId && row.deviceId !== deviceId) {
          return jsonResponse(
            fail("هذا الكود مستخدم بجهاز اخر\nاذهب واشتر كود جديد 🙂🏃🏻‍♂️", "device_mismatch"),
            400
          );
        }

        // 4) أوّل استخدام: اربط القيم واحفظ usedAt + أنشئ بديل تلقائي
        if (!row.deviceId) {
          await env.RY7_CODES.prepare(
            "UPDATE codes SET deviceId = ?, bundleId = ?, usedAt = ? WHERE code = ?"
          )
            .bind(deviceId || "unknown", bundleId || "unknown", Date.now(), code)
            .run();

          await env.RY7_CODES.prepare(
            "INSERT INTO codes (code, type, createdAt) VALUES (?,?,?)"
          )
            .bind(randomCode(8), row.type, Date.now())
            .run();

          // أعِد الجلب لضمان وجود usedAt
          row = await env.RY7_CODES.prepare("SELECT * FROM codes WHERE code = ?")
            .bind(code)
            .first();
        }

        // 5) حساب المتبقي/الانتهاء على أساس usedAt
        const startMs = Number(row.usedAt || Date.now());
        const endMs = startMs + durationDays * 86400000;
        const nowMs = Date.now();
        const remainingDays = Math.max(Math.ceil((endMs - nowMs) / 86400000), 0);
        const endDateISO = new Date(endMs).toISOString();
        const endDateLabel = new Date(endMs).toLocaleDateString("ar-SA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        // 6) نص النجاح الموحد — يُعرض كما هو في iOS (UIAlertController المخصص)
        const msg =
          `🎉 تم التفعيل بنجاح\n` +
          `📱 الجهاز: ${deviceName || "?"}\n` +
          `📦 التطبيق: ${bundleId || "?"}\n` +
          `🔑 النوع: ${row.type === "yearly" ? "سنوي" : "شهري"}\n` +
          `⏳ متبقي: ${remainingDays} يوم\n` +
          `📅 ينتهي في: ${endDateLabel}`;

        return jsonResponse(
          ok(msg, {
            title: "نجاح",
            status: "activated",
            type: row.type,        // "monthly" | "yearly"
            remainingDays,         // الأيام المتبقية
            endDate: endDateISO,   // ISO 8601
            deviceName: deviceName || "?",
            bundleId: bundleId || "?"
          })
        );
      }

      // ===============================
      // 🔐 مسارات الإدارة
      // ===============================
      const adminNeeded = ["/api/generate", "/api/list", "/api/delete", "/api/reset", "/api/bulk_import"];
      if (adminNeeded.includes(path) && !isAdmin(request, env, url)) {
        return jsonResponse(fail("🚫 الوصول مرفوض: غير مصرح لك.", "unauthorized", "مرفوض"), 401);
      }

      // ✅ توليد الأكواد
      if (path === "/api/generate" && request.method === "POST") {
        const { type, count, prefix } = await request.json().catch(() => ({}));
        if (!["monthly", "yearly"].includes(type)) {
          return jsonResponse(fail("❌ النوع غير صحيح. استخدم monthly أو yearly.", "validation"), 400);
        }
        const n = Math.max(1, Math.min(200, parseInt(count || 1)));
        const out = [];

        for (let i = 0; i < n; i++) {
          let c;
          if (prefix && /^[A-Z0-9]+$/i.test(prefix)) {
            const remain = Math.max(0, 8 - prefix.length);
            c = (prefix.toUpperCase() + randomCode(remain)).slice(0, 8);
          } else {
            c = randomCode(8);
          }
          await env.RY7_CODES.prepare(
            "INSERT INTO codes (code, type, createdAt) VALUES (?,?,?)"
          ).bind(c, type, Date.now()).run();
          out.push(c);
        }

        return jsonResponse(
          ok(`✅ تم توليد ${out.length} كود (${type === "yearly" ? "سنوي" : "شهري"})`, {
            generated: out,
            status: "generated"
          })
        );
      }

      // ✅ قائمة الأكواد
      if (path === "/api/list" && request.method === "GET") {
        const res = await env.RY7_CODES.prepare("SELECT * FROM codes ORDER BY createdAt DESC").all();
        const { unused, used, expired } = splitLists(res.results || []);
        return jsonResponse(
          ok("📋 تم جلب قائمة الأكواد بنجاح.", {
            unused, used, expired,
            status: "listed"
          })
        );
      }

      // ✅ حذف كود
      if (path === "/api/delete" && request.method === "POST") {
        const { code } = await request.json().catch(() => ({}));
        if (!code) return jsonResponse(fail("⚠️ يرجى إرسال الكود لحذفه.", "validation"), 400);
        await env.RY7_CODES.prepare("DELETE FROM codes WHERE code=?").bind(code).run();
        return jsonResponse(ok(`🗑️ تم حذف الكود ${code}`, { status: "deleted" }));
      }

      // ✅ إعادة تعيين كود
      if (path === "/api/reset" && request.method === "POST") {
        const { code } = await request.json().catch(() => ({}));
        if (!code) return jsonResponse(fail("⚠️ يرجى إرسال الكود لإعادة تعيينه.", "validation"), 400);
        await env.RY7_CODES.prepare(
          "UPDATE codes SET deviceId=NULL, bundleId=NULL, usedAt=0 WHERE code=?"
        ).bind(code).run();
        return jsonResponse(ok(`♻️ تم إعادة تعيين الكود ${code}`, { status: "reset" }));
      }

      // ✅ استيراد دفعي
      if (path === "/api/bulk_import" && request.method === "POST") {
        const { type, codes } = await request.json().catch(() => ({}));
        if (!["monthly", "yearly"].includes(type)) {
          return jsonResponse(fail("❌ النوع غير صحيح في الاستيراد.", "validation"), 400);
        }
        let okCount = 0, dup = 0, bad = 0;
        for (const raw of codes || []) {
          const c = String(raw || "").trim().toUpperCase();
          if (!/^[A-Z0-9]{8}$/.test(c)) { bad++; continue; }
          try {
            await env.RY7_CODES.prepare(
              "INSERT INTO codes (code, type, createdAt) VALUES (?,?,?)"
            ).bind(c, type, Date.now()).run();
            okCount++;
          } catch (e) { dup++; }
        }
        return jsonResponse(
          ok(`📥 استيراد: جديد ${okCount} | مكرر ${dup} | غير صالح ${bad}`, {
            status: "imported",
            imported: okCount, duplicated: dup, invalid: bad
          })
        );
      }

      // ✅ حالة السيرفر
      if (path === "/api/status") {
        return jsonResponse(ok("✅ API يعمل بشكل سليم.", { status: "alive" }));
      }

      // ❌ مسار غير موجود
      return jsonResponse(fail("❌ المسار المطلوب غير موجود.", "not_found", "غير موجود"), 404);

    } catch (err) {
      return jsonResponse(fail("❌ خطأ داخلي: " + err.message, "exception", "عطل"), 500);
    }
  }
};
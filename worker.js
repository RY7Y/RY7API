function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>RY7Code New</title>
<style>
  :root {
    --bg:#0b0f17; --card:#101726; --txt:#e6edf3; --muted:#9aa4b2;
    --line:#1e2a3a; --brand:#6ee7ff; --brand2:#8b5cf6;
    --good:#22c55e; --bad:#ef4444; --warn:#f59e0b;
  }
  [data-theme="light"] {
    --bg:#f5f5f5; --card:#fff; --txt:#222; --muted:#666;
    --line:#ddd; --brand:#06b6d4; --brand2:#9333ea;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--txt);}
  .wrap{max-width:1200px;margin:auto;padding:22px}
  h1{text-align:center;font-size:36px;margin:0;position:relative;animation:glow 2s infinite alternate;}
  @keyframes glow {
    from{text-shadow:0 0 10px var(--brand),0 0 20px var(--brand2);}
    to{text-shadow:0 0 20px var(--brand2),0 0 40px var(--brand);}
  }
  .theme-toggle{position:absolute;top:22px;right:22px;background:transparent;border:1px solid var(--line);border-radius:50%;padding:8px;cursor:pointer}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0;box-shadow:0 4px 20px rgba(0,0,0,.12)}
  .toolbar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center}
  select,input,button{padding:10px 14px;font-size:15px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--txt)}
  button{cursor:pointer}
  .btn{background:linear-gradient(90deg,var(--brand),var(--brand2));border:none;color:#fff;font-weight:600}
  .btn.ghost{background:transparent;color:var(--txt)}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{padding:10px;border-bottom:1px solid var(--line);text-align:right}
  th{color:var(--muted)}
  .badge{padding:4px 10px;border-radius:999px;font-size:12px;display:inline-block}
  .b-new{background:#0b2a1a;color:#22c55e}
  .b-active{background:#071b2a;color:#60d5ff}
  .b-exp{background:#2a0b0e;color:#ef4444}
  .actions{display:flex;gap:6px}
  .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card);color:var(--txt);padding:12px 16px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.2);display:none}
</style>
</head>
<body>
<div class="wrap">
  <button class="theme-toggle" onclick="toggleTheme()">☀️/🌙</button>
  <h1>RY7Code New</h1>

  <div class="card">
    <div class="toolbar">
      <label>النوع:</label>
      <select id="genType"><option value="monthly">شهري</option><option value="yearly">سنوي</option></select>
      <label>العدد:</label>
      <input id="genCount" type="number" value="5" min="1" max="200"/>
      <button id="btnGen" class="btn">توليد أكواد</button>
      <button id="btnRefresh" class="btn ghost">تحديث</button>
      <button id="btnCopyAll" class="btn ghost">📋 نسخ جميع الأكواد</button>
    </div>
    <textarea id="bulkBox" rows="3" style="width:100%;margin-top:8px" placeholder="RYABC123&#10;RYXYZ789"></textarea>
    <button id="btnImport" class="btn" style="margin-top:8px">استيراد دفعي</button>
    <div id="msg" style="margin-top:6px;color:var(--muted)"></div>
  </div>

  <div class="card">
    <h2>أكواد جديدة</h2>
    <div class="toolbar">
      <button class="btn ghost" onclick="filterUnused('monthly')">📅 شهري</button>
      <button class="btn ghost" onclick="filterUnused('yearly')">📆 سنوي</button>
    </div>
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

<div id="toast" class="toast"></div>

<script>
const token = new URLSearchParams(location.search).get("token") || "";
function api(path,opt={}){opt.headers=Object.assign({},opt.headers||{},{"X-Admin-Token":token,"Content-Type":"application/json"});return fetch(path,opt).then(r=>r.json());}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",2000);}
function fmt(t){return t?new Date(Number(t)).toLocaleString("ar-SA"):"-";}

function status(r){
  if(!r.usedAt) return '<span class="badge b-new">لم يبدأ بعد</span>';
  const dur=r.type==="yearly"?365:30;
  const end=r.usedAt+dur*86400000;
  if(Date.now()>=end) return '<span class="badge b-exp">منتهي</span>';
  const left=Math.ceil((end-Date.now())/86400000);
  return '<span class="badge b-active">نشط • متبقي '+left+' يوم</span>';
}

function tableFor(list){
  if(!list.length) return "<div class='muted'>لا يوجد</div>";
  return "<table><thead><tr><th>الكود</th><th>النوع</th><th>الحالة</th><th>إنشاء</th><th>إجراءات</th></tr></thead><tbody>"+
    list.map(r=>\`<tr>
      <td>\${r.code}</td>
      <td>\${r.type==="yearly"?"سنوي":"شهري"}</td>
      <td>\${status(r)}</td>
      <td>\${fmt(r.createdAt)}</td>
      <td class='actions'>
        <button onclick="copyCode('\${r.code}')">📋</button>
        <button onclick="resetCode('\${r.code}')">♻️</button>
        <button onclick="delCode('\${r.code}')">🗑️</button>
      </td>
    </tr>\`).join("")+"</tbody></table>";
}

function refresh(){api("/api/list").then(j=>{window.__all=j;document.getElementById("unused").innerHTML=tableFor(j.unused);document.getElementById("used").innerHTML=tableFor(j.used);document.getElementById("expired").innerHTML=tableFor(j.expired);});}
function filterUnused(type){const all=window.__all?.unused||[];const filtered=all.filter(r=>r.type===type);document.getElementById("unused").innerHTML=tableFor(filtered);}
function delCode(code){api("/api/delete",{method:"POST",body:JSON.stringify({code})}).then(()=>{toast("تم الحذف");refresh();});}
function resetCode(code){api("/api/reset",{method:"POST",body:JSON.stringify({code})}).then(()=>{toast("تم إعادة التعيين");refresh();});}
function copyCode(code){navigator.clipboard.writeText(code).then(()=>toast("نسخ "+code));}
document.getElementById("btnGen").onclick=()=>{const type=document.getElementById("genType").value;const count=parseInt(document.getElementById("genCount").value||1);api("/api/generate",{method:"POST",body:JSON.stringify({type,count})}).then(j=>{toast("تم توليد "+(j.generated||[]).length);refresh();});}
document.getElementById("btnRefresh").onclick=refresh;
document.getElementById("btnImport").onclick=()=>{const type="monthly";const codes=document.getElementById("bulkBox").value.split(/\\r?\\n/).filter(Boolean);api("/api/bulk_import",{method:"POST",body:JSON.stringify({type,codes})}).then(j=>{toast(j.message);refresh();});}
document.getElementById("btnCopyAll").onclick=()=>{const all=[...(window.__all?.unused||[]),...(window.__all?.used||[]),...(window.__all?.expired||[])];if(!all.length)return toast("لا توجد أكواد");const txt=all.map(r=>\`\${r.code} - \${r.type} - \${r.usedAt?"متبقي "+Math.max(0,Math.ceil(((r.usedAt+(r.type==="yearly"?365:30)*86400000)-Date.now())/86400000))+" يوم":"لم يبدأ"}\`).join("\\n");navigator.clipboard.writeText(txt).then(()=>toast("تم نسخ جميع الأكواد"));};
function toggleTheme(){const b=document.body;const isLight=b.getAttribute("data-theme")==="light";b.setAttribute("data-theme",isLight?"dark":"light");}
refresh();
</script>
</body>
</html>`;



const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len = 8) {
  return Array.from({ length: len }, () =>
    ALPH[Math.floor(Math.random() * ALPH.length)]
  ).join("");
}

function isAdmin(request, env, url) {
  const q = url.searchParams.get("token");
  const h = request.headers.get("X-Admin-Token");
  return !!env.ADMIN_TOKEN && (q === env.ADMIN_TOKEN || h === env.ADMIN_TOKEN);
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  deviceId TEXT,
  bundleId TEXT,
  usedAt INTEGER DEFAULT 0,
  createdAt INTEGER DEFAULT 0
);
`;

async function ensureSchema(env) {
  await env.RY7_CODES.exec(CREATE_SQL);
}

function splitLists(rows) {
  const now = Date.now();
  const dur = (t) => (t === "yearly" ? 365 : 30) * 86400000;
  const unused = [],
    used = [],
    expired = [];

  for (const r of rows) {
    if (!r.deviceId) {
      unused.push(r);
      continue;
    }
    const end = (r.usedAt || 0) + dur(r.type);
    if (now >= end) expired.push(r);
    else used.push(r);
  }
  return { unused, used, expired };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/admin") {
        if (!isAdmin(request, env, url))
          return textResponse("<h3>Unauthorized</h3>", 401);
        return textResponse(ADMIN_HTML);
      }

      await ensureSchema(env);

      if (path === "/api/activate" && request.method === "POST") {
        const { code, deviceId, bundleId, deviceName } = await request
          .json()
          .catch(() => ({}));
        if (!code)
          return jsonResponse(
            { success: false, message: "⚠️ أرسل الكود" },
            400
          );

        const row = await env.RY7_CODES.prepare(
          "SELECT * FROM codes WHERE code=?"
        )
          .bind(code)
          .first();
        if (!row)
          return jsonResponse({ success: false, message: "🚫 غير موجود" }, 400);

        const durationDays = row.type === "yearly" ? 365 : 30;
        if (row.deviceId && row.deviceId !== deviceId)
          return jsonResponse(
            { success: false, message: "🚫 مستخدم بجهاز آخر" },
            400
          );

        if (!row.deviceId) {
          await env.RY7_CODES.prepare(
            "UPDATE codes SET deviceId=?, bundleId=?, usedAt=? WHERE code=?"
          )
            .bind(deviceId || "unknown", bundleId || "unknown", Date.now(), code)
            .run();

          await env.RY7_CODES.prepare(
            "INSERT INTO codes (code, type, createdAt) VALUES (?,?,?)"
          )
            .bind(randomCode(8), row.type, Date.now())
            .run();
        }

        let remainingDays = durationDays;
        if (row.usedAt && row.deviceId === deviceId) {
          const elapsed = Math.floor((Date.now() - row.usedAt) / 86400000);
          remainingDays = Math.max(durationDays - elapsed, 0);
        }

        return jsonResponse({
          success: true,
          type: row.type,
          remainingDays,
          message: `🎉 تم التفعيل\n📱 ${deviceName || "?"}\n📦 ${
            bundleId || "?"
          }\n⏳ ${remainingDays} يوم`,
        });
      }

      const adminNeeded = [
        "/api/generate",
        "/api/list",
        "/api/delete",
        "/api/reset",
        "/api/bulk_import",
      ];
      if (adminNeeded.includes(path) && !isAdmin(request, env, url))
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);

      if (path === "/api/generate" && request.method === "POST") {
        const { type, count } = await request.json().catch(() => ({}));
        if (!["monthly", "yearly"].includes(type))
          return jsonResponse(
            { success: false, message: "❌ النوع غير صحيح" },
            400
          );

        const n = Math.max(1, Math.min(200, parseInt(count || 1)));
        const out = [];

        for (let i = 0; i < n; i++) {
          const c = randomCode(8);
          await env.RY7_CODES.prepare(
            "INSERT INTO codes (code, type, createdAt) VALUES (?,?,?)"
          )
            .bind(c, type, Date.now())
            .run();
          out.push(c);
        }
        return jsonResponse({
          success: true,
          generated: out,
          message: `✅ ${out.length} كود`,
        });
      }

      if (path === "/api/list" && request.method === "GET") {
        const res = await env.RY7_CODES.prepare(
          "SELECT * FROM codes ORDER BY createdAt DESC"
        ).all();
        const { unused, used, expired } = splitLists(res.results || []);
        return jsonResponse({ success: true, unused, used, expired });
      }

      if (path === "/api/delete" && request.method === "POST") {
        const { code } = await request.json().catch(() => ({}));
        await env.RY7_CODES.prepare("DELETE FROM codes WHERE code=?")
          .bind(code)
          .run();
        return jsonResponse({ success: true, message: "🗑️ حذف " + code });
      }

      if (path === "/api/reset" && request.method === "POST") {
        const { code } = await request.json().catch(() => ({}));
        await env.RY7_CODES.prepare(
          "UPDATE codes SET deviceId=NULL, bundleId=NULL, usedAt=0 WHERE code=?"
        )
          .bind(code)
          .run();
        return jsonResponse({ success: true, message: "♻️ إعادة " + code });
      }

      if (path === "/api/bulk_import" && request.method === "POST") {
        const { type, codes } = await request.json().catch(() => ({}));
        let ok = 0,
          dup = 0,
          bad = 0;

        for (const raw of codes || []) {
          const c = String(raw || "").trim().toUpperCase();
          if (!/^[A-Z0-9]{8}$/.test(c)) {
            bad++;
            continue;
          }
          try {
            await env.RY7_CODES.prepare(
              "INSERT INTO codes (code, type, createdAt) VALUES (?,?,?)"
            )
              .bind(c, type, Date.now())
              .run();
            ok++;
          } catch (e) {
            dup++;
          }
        }
        return jsonResponse({
          success: true,
          message: `✅ ${ok} | مكرر ${dup} | غير صالح ${bad}`,
        });
      }

      if (path === "/api/status") {
        return jsonResponse({ success: true, message: "✅ API يعمل" });
      }

      return jsonResponse(
        { success: false, message: "❌ مسار غير موجود" },
        404
      );
    } catch (err) {
      return jsonResponse(
        { success: false, message: "❌ خطأ: " + err.message },
        500
      );
    }
  },
};
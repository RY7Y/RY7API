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
// - /admin           : لوحة إدارة (HTML من admin.html) — تتطلب ADMIN_TOKEN
//
// 🔐 كل المسارات الإدارية تحتاج التوكن عبر:
//   - هيدر:  X-Admin-Token: <ADMIN_TOKEN>
//   - أو   : /admin?token=<ADMIN_TOKEN>
//
// 🗃️ الاعتماد على قاعدة D1 (binding: RY7_CODES)
// تأكد من وجود هذا في wrangler.toml:
// [[d1_databases]]
// binding = "RY7_CODES"
// database_name = "ry7-codes"
// database_id = "<your-d1-id>"
//
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

// 🆕 قراءة admin.html من الـ Assets
async function getAdminHTML(env) {
  const r = await env.ASSETS.fetch("http://internal/admin.html");
  return await r.text();
}

// 🔠 حروف توليد الأكواد (بدون O/0 و I/1 لتجنب اللخبطة)
const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return s;
}

function isAdmin(request, env, url) {
  const q = url.searchParams.get("token");
  const h = request.headers.get("X-Admin-Token");
  return !!env.ADMIN_TOKEN && (q === env.ADMIN_TOKEN || h === env.ADMIN_TOKEN);
}

/* =========== قاعدة البيانات (D1) =========== */

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'monthly' | 'yearly'
  deviceId TEXT,                -- UUID الجهاز إن استُخدم
  bundleId TEXT,                -- حزمة التطبيق إن استُخدم
  usedAt INTEGER DEFAULT 0,     -- وقت الاستخدام (ms منذ Epoch)
  createdAt INTEGER DEFAULT 0   -- وقت الإنشاء (ms منذ Epoch)
);
`;

async function ensureSchema(env) {
  await env.RY7_CODES.exec(CREATE_SQL);
}

function splitLists(rows) {
  const now = Date.now();
  const dur = (t) => (t === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000;
  const unused = [];
  const used = [];
  const expired = [];
  for (const r of rows) {
    if (!r.deviceId) { unused.push(r); continue; }
    const end = (r.usedAt || 0) + dur(r.type);
    if (now >= end) expired.push(r); else used.push(r);
  }
  return { unused, used, expired };
}

/* =========== التطبيق الرئيسي =========== */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ⭐ لوحة الإدارة (HTML من admin.html)
      if (path === "/admin") {
        if (!isAdmin(request, env, url)) {
          return textResponse("<h3 style='font-family:sans-serif'>Unauthorized</h3>", 401);
        }
        const html = await getAdminHTML(env);
        return textResponse(html);
      }

      // تأكد من جاهزية الجدول
      await ensureSchema(env);

      // ✅ تفعيل الكود
      if (path === "/api/activate") {
        if (request.method !== "POST") {
          return jsonResponse({ success:false, message:"🚫 الطريقة غير مسموحة (POST فقط)" }, 405);
        }
        const body = await request.json().catch(()=> ({}));
        const { code, deviceId, bundleId, deviceName } = body || {};

        if (!code || typeof code !== "string") {
          return jsonResponse({ success:false, message:"⚠️ يرجى إدخال الكود" }, 400);
        }
        if (!/^[A-Z0-9]{8}$/.test(code)) {
          return jsonResponse({ success:false, message:"❌ الكود غير صالح (8 خانات حروف/أرقام)" }, 400);
        }

        const row = await env.RY7_CODES
          .prepare("SELECT * FROM codes WHERE code = ?")
          .bind(code)
          .first();

        if (!row) {
          return jsonResponse({ success:false, message:"🚫 الكود غير موجود" }, 400);
        }

        const durationDays = row.type === "yearly" ? 365 : row.type === "monthly" ? 30 : 0;
        if (!durationDays) {
          return jsonResponse({ success:false, message:"⚠️ نوع الكود غير معروف" }, 400);
        }

        // مستخدم على جهاز مختلف
        if (row.deviceId && row.deviceId !== deviceId) {
          return jsonResponse({ success:false, message:"🚫 هذا الكود مستخدم بالفعل على جهاز آخر" }, 400);
        }

        // ربط أول مرة
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

        // حساب المتبقي للجهاز نفسه
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

      // 🔐 المسارات الإدارية — تتطلب ADMIN_TOKEN
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
        const res = await env.RY7_CODES
          .prepare("SELECT * FROM codes ORDER BY createdAt DESC")
          .all();
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

      // حالة السيرفر
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
// worker.js
// ✅ RY7 Login API على Cloudflare Workers
// ✅ يدعم activate + status
// ✅ يتحقق من الكود (طول 8 فقط)
// ✅ يقرأ ملف codes.json من GitHub Pages
// ✅ يمنع إعادة استخدام الكود بربطه مع deviceId

const GITHUB_CODES_URL = "https://devry7yy.org/codes.json";

// 🛠️ كاش مؤقت للـ codes (عشان ما يطلب كل مرة من GitHub)
let codesCache = null;
let codesCacheTime = 0;

// ⏳ مدة الكاش 1 دقيقة
const CACHE_DURATION = 60 * 1000;

// 🛠️ استرجاع الأكواد من GitHub
async function fetchCodes() {
  const now = Date.now();
  if (codesCache && now - codesCacheTime < CACHE_DURATION) {
    return codesCache;
  }
  const res = await fetch(GITHUB_CODES_URL);
  if (!res.ok) throw new Error("فشل تحميل ملف الأكواد");
  codesCache = await res.json();
  codesCacheTime = now;
  return codesCache;
}

// ✅ دالة الرد الموحدة
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

// ✅ نقطة البداية
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/activate") {
        if (request.method !== "POST") {
          return jsonResponse({ success: false, message: "الطريقة غير مسموحة 🚫" }, 405);
        }

        const body = await request.json();
        const { code, deviceId, bundleId, deviceName } = body;

        if (!code || typeof code !== "string") {
          return jsonResponse({ success: false, message: "⚠️ يرجى إدخال الكود" }, 400);
        }

        // ✅ التحقق من طول الكود
        if (code.length !== 8) {
          return jsonResponse({ success: false, message: "❌ الكود غير صالح (يجب أن يكون 8 خانات)" }, 400);
        }

        // ✅ قراءة الأكواد
        const codes = await fetchCodes();

        let type = null;
        let durationDays = 0;

        if (codes.monthly.includes(code)) {
          type = "monthly";
          durationDays = 30;
        } else if (codes.yearly.includes(code)) {
          type = "yearly";
          durationDays = 365;
        } else {
          return jsonResponse({ success: false, message: "🚫 الكود غير صحيح" }, 400);
        }

        // 🛠️ منع الاستخدام المتكرر (ربط الـ UUID)
        if (!codes.used) codes.used = {};
        if (codes.used[code] && codes.used[code] !== deviceId) {
          return jsonResponse({ success: false, message: "🚫 الكود مستخدم بالفعل على جهاز آخر" }, 400);
        }

        // حفظ UUID لأول مرة
        codes.used[code] = deviceId;

        const remainingDays = durationDays;

        return jsonResponse({
          success: true,
          type,
          remainingDays,
          message: `🎉 تم التفعيل بنجاح على الجهاز: ${deviceName || "غير معروف"}`
        });
      }

      else if (path === "/api/status") {
        return jsonResponse({ success: true, message: "✅ API شغال" });
      }

      else {
        return jsonResponse({ success: false, message: "❌ مسار API غير موجود" }, 404);
      }

    } catch (err) {
      return jsonResponse({ success: false, message: "❌ خطأ بالخادم: " + err.message }, 500);
    }
  }
};

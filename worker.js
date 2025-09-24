// worker.js
// ✅ RY7 Login API على Cloudflare Workers (باستخدام D1 Database)
// ✅ يدعم activate + status
// ✅ يتحقق من الكود (طول 8 فقط)
// ✅ يخزن الأكواد + يربطها مع UUID (deviceId)
// ✅ يمنع إعادة استخدام الكود على جهاز آخر
// ✅ يسمح للجهاز نفسه باستخدام الكود مرة أخرى (تسجيل دخول تلقائي)
// ✅ يظهر رسائل واضحة للمستخدم عن النجاح/الفشل

// ✅ دالة الرد الموحدة
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 🔹 تفعيل الكود
      if (path === "/api/activate") {
        if (request.method !== "POST") {
          return jsonResponse(
            { success: false, message: "🚫 الطريقة غير مسموحة (POST فقط)" },
            405
          );
        }

        const body = await request.json();
        const { code, deviceId, bundleId, deviceName } = body;

        // ⚠️ تحقق من الإدخال
        if (!code || typeof code !== "string") {
          return jsonResponse({ success: false, message: "⚠️ يرجى إدخال الكود" }, 400);
        }

        if (code.length !== 8) {
          return jsonResponse({
            success: false,
            message: "❌ الكود غير صالح (يجب أن يتكون من 8 خانات)"
          }, 400);
        }

        // ✅ تحقق من الكود داخل D1
        const row = await env.RY7_CODES.prepare(
          "SELECT * FROM codes WHERE code = ?"
        ).bind(code).first();

        if (!row) {
          return jsonResponse({
            success: false,
            message: "🚫 الكود غير صحيح أو غير موجود في قاعدة البيانات"
          }, 400);
        }

        // 🗓️ حدد المدة حسب النوع
        let durationDays = 0;
        if (row.type === "monthly") durationDays = 30;
        else if (row.type === "yearly") durationDays = 365;
        else {
          return jsonResponse({
            success: false,
            message: "⚠️ نوع الكود غير معروف في قاعدة البيانات"
          }, 400);
        }

        // 🛠️ تحقق من الاستخدام السابق
        if (row.deviceId && row.deviceId !== deviceId) {
          return jsonResponse({
            success: false,
            message: "🚫 هذا الكود مستخدم بالفعل على جهاز آخر"
          }, 400);
        }

        // ✅ إذا لم يُستخدم من قبل → تحديثه وربطه بالجهاز
        if (!row.deviceId) {
          await env.RY7_CODES.prepare(
            "UPDATE codes SET deviceId = ?, bundleId = ?, usedAt = ? WHERE code = ?"
          ).bind(deviceId, bundleId || "unknown", Date.now(), code).run();
        }

        // ✅ حساب الصلاحية المتبقية
        let remainingDays = durationDays;
        if (row.usedAt && row.deviceId === deviceId) {
          const elapsed = Math.floor((Date.now() - row.usedAt) / (1000 * 60 * 60 * 24));
          remainingDays = Math.max(durationDays - elapsed, 0);
        }

        // ✅ رسالة نجاح
        return jsonResponse({
          success: true,
          type: row.type,
          remainingDays,
          message: `🎉 تم التفعيل بنجاح\n📱 الجهاز: ${deviceName || "غير معروف"}\n📦 التطبيق: ${bundleId || "غير محدد"}\n🔑 النوع: ${row.type}\n⏳ الصلاحية: ${remainingDays} يوم`
        });
      }

      // 🔹 فحص حالة السيرفر
      else if (path === "/api/status") {
        return jsonResponse({ success: true, message: "✅ API يعمل بشكل طبيعي" });
      }

      // 🔹 أي مسار آخر
      else {
        return jsonResponse({ success: false, message: "❌ مسار API غير موجود" }, 404);
      }

    } catch (err) {
      return jsonResponse({
        success: false,
        message: "❌ خطأ داخلي: " + err.message
      }, 500);
    }
  }
};
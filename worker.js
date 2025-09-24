// worker.js
// ✅ RY7 Login API على Cloudflare Workers (باستخدام D1 Database)
// ✅ يدعم activate + status
// ✅ يتحقق من الكود (طول 8 فقط)
// ✅ يخزن الأكواد + يربطها مع UUID (deviceId)
// ✅ يمنع إعادة استخدام الكود على جهاز آخر
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

        // 🛠️ تحقق من الاستخدام السابق
        if (row.used_by && row.used_by !== deviceId) {
          return jsonResponse({
            success: false,
            message: "🚫 الكود مستخدم بالفعل على جهاز آخر"
          }, 400);
        }

        // ✅ إذا لم يُستخدم من قبل → تحديثه وربطه بالجهاز
        if (!row.used_by) {
          await env.RY7_CODES.prepare(
            "UPDATE codes SET used_by = ?, used_at = ? WHERE code = ?"
          ).bind(deviceId, Date.now(), code).run();
        }

        // ✅ رسالة نجاح
        return jsonResponse({
          success: true,
          type: row.type,
          remainingDays: row.duration_days,
          message: `🎉 تم التفعيل بنجاح\n📱 الجهاز: ${deviceName || "غير معروف"}\n📦 التطبيق: ${bundleId || "غير محدد"}\n🔑 النوع: ${row.type}\n⏳ الصلاحية: ${row.duration_days} يوم`
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
-- 📌 إنشاء جدول الأكواد إذا ما كان موجود
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,          -- الكود نفسه (8 خانات)
  deviceId TEXT,                  -- الـ UUID للجهاز اللي يستخدم الكود
  bundleId TEXT,                  -- معرف التطبيق (اختياري)
  usedAt INTEGER DEFAULT 0,       -- وقت الاستخدام (timestamp)
  type TEXT NOT NULL,             -- نوع الكود (monthly / yearly)
  duration_days INTEGER NOT NULL  -- مدة الصلاحية (عدد الأيام)
);

-- ✅ إضافة أكواد شهرية (30 يوم)
INSERT INTO codes (code, type, duration_days) VALUES
('RYM4CUY2', 'monthly', 30),
('RYZ8GF4B', 'monthly', 30),
('RYO4VN5J', 'monthly', 30),
('RYA0BX4S', 'monthly', 30);

-- ✅ إضافة أكواد سنوية (365 يوم)
INSERT INTO codes (code, type, duration_days) VALUES
('RYZ9YV9W', 'yearly', 365),
('RYB7KJ8Q', 'yearly', 365),
('RYC6PL2X', 'yearly', 365);
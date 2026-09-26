# ONE BULLET — Deno Deploy

جهزت اللعبة لتعمل مع **Deno Deploy** بدل Render.

## ماذا يوجد داخل المشروع؟
- `main.js` — سيرفر HTTP + WebSocket + matchmaking + الغرف العامة والخاصة + chat + reconnect + leaderboard داخل الذاكرة.
- `engine.js` — نفس محرك اللعب الموجود داخل ملف اللعبة، ويعمل على السيرفر authoritative.
- `public/index.html` — نسخة اللعبة التي تعمل مباشرة من نفس تطبيق Deno.
- `client-for-crazygames.html` — نسخة CrazyGames، وبها مكان رابط Deno النهائي.
- `PATCH_CRAZYGAMES_SERVER.bat` — بعد نشر Deno الصق رابط السيرفر وسيُنشئ `index-crazygames-final.html` جاهزًا للرفع إلى CrazyGames.
- `DEPLOY_WINDOWS.bat` — مساعد للنشر من Windows بعد تثبيت Deno.

## النشر
1. افتح `https://console.deno.com` وسجل الدخول وأنشئ Organization إذا لم يكن لديك واحد.
2. ثبّت Deno على Windows من الموقع الرسمي إذا لم يكن مثبتًا.
3. فك ضغط هذا المشروع وافتح المجلد، ثم شغّل `DEPLOY_WINDOWS.bat`.
4. سيستخدم Deno تسجيل الدخول الرسمي ثم ينشئ/ينشر التطبيق. لا تضع أي Token داخل الملفات.
5. بعد نجاح النشر افتح `https://رابط-تطبيقك/health`. يجب أن ترى `"ok":true`.
6. رابط التطبيق نفسه يشغّل اللعبة، لأن `public/index.html` يتصل بالسيرفر من نفس الـ origin.
7. إذا أردت رفع النسخة إلى CrazyGames، شغّل `PATCH_CRAZYGAMES_SERVER.bat` والصق رابط Deno النهائي، ثم ارفع `index-crazygames-final.html`.

## تقليل استهلاك البيانات
الخادم لا يرسل حالة اللعبة 60 مرة في الثانية. يرسل تقريبًا 10 مرات/ثانية في الوضع العادي ويرفع المعدل مؤقتًا أثناء وجود الرصاص. هذا يقلل egress بشكل كبير عن إعداد السيرفر القديم، مع بقاء محاكاة القتال نفسها على السيرفر عند 60 tick/s.

## الميزات المدعومة
Quick Match، private room code، حتى 8 لاعبين/خانات، bots، جميع الأطوار الموجودة في المحرك، تصويت الماب والطور بين المباريات، chat، ping، reconnect لمدة 30 ثانية، وواجهة leaderboard الأساسية.

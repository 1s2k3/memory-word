// 测试上传：用 FormData POST 一张图片到 /api/upload
const fs = require('fs');
const path = require('path');

const apiUrl = 'https://memory-world-nu.vercel.app/api/upload';
const secret = 'memory-world-2026';
const filePath = path.join(__dirname, 'assets', 'gallery-01.jpg');

(async () => {
  if (!fs.existsSync(filePath)) {
    console.log('测试文件不存在:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'gallery-01.jpg');
  form.append('title', '测试上传-清晨咖啡');
  form.append('category', '日常');
  form.append('mood', '一个温暖的早晨');

  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'X-Upload-Secret': secret },
      body: form
    });
    const text = await r.text();
    console.log('Status:', r.status);
    console.log('Body:', text);
  } catch (err) {
    console.log('ERR:', err.message);
    if (err.cause) console.log('CAUSE:', err.cause.message || err.cause);
  }
})();

import { put, head } from '@vercel/blob';

// 禁用 Vercel 默认 bodyParser，确保拿到原始字节流（修复中文乱码）
export const config = {
  api: {
    bodyParser: false
  }
};

const INDEX_PATH = '_index/photos.json';
const UPLOAD_SECRET = process.env.UPLOAD_SECRET || 'memory-world-2026';

async function getIndex() {
  try {
    const res = await head(INDEX_PATH);
    if (!res) return { photos: [] };
    const r = await fetch(res.url);
    if (!r.ok) return { photos: [] };
    return await r.json();
  } catch {
    return { photos: [] };
  }
}

async function saveIndex(index) {
  await put(INDEX_PATH, JSON.stringify(index, null, 2), {
    access: 'public',
    contentType: 'application/json'
  });
}

// 收集 Node 流为 Buffer
function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 解析 multipart/form-data
function parseMultipart(buffer, boundary) {
  const parts = {};
  const files = {};
  const delimiter = Buffer.from('--' + boundary);
  const CRLF = Buffer.from('\r\n');

  // 找到第一个分隔符位置
  let start = buffer.indexOf(delimiter);
  if (start === -1) return { parts, files };
  start += delimiter.length;

  while (true) {
    // 剩余必须以 CRLF 开头（或 -- 结束）
    if (buffer.slice(start, start + 2).equals(CRLF)) {
      start += 2;
    } else if (buffer.slice(start, start + 2).toString() === '--') {
      break; // 结束标记
    }

    // 找下一个分隔符
    let next = buffer.indexOf(Buffer.concat([CRLF, delimiter]), start);
    if (next === -1) break;

    // 当前块内容（不含尾部 CRLF）
    const block = buffer.slice(start, next);

    // 找 header 与 body 的分界 \r\n\r\n
    const headerEnd = block.indexOf(Buffer.concat([CRLF, CRLF]));
    if (headerEnd === -1) {
      start = next + CRLF.length + delimiter.length;
      continue;
    }

    const header = block.slice(0, headerEnd).toString('utf8');
    const body = block.slice(headerEnd + 4); // 跳过 \r\n\r\n

    const nameMatch = header.match(/name="([^"]+)"/);
    if (!nameMatch) {
      start = next + CRLF.length + delimiter.length;
      continue;
    }
    const name = nameMatch[1];
    const fileMatch = header.match(/filename="([^"]+)"/);
    if (fileMatch) {
      const typeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
      files[name] = {
        filename: fileMatch[1],
        type: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
        data: body
      };
    } else {
      parts[name] = body.toString('utf8');
    }

    start = next + CRLF.length + delimiter.length;
  }
  return { parts, files };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Upload-Secret');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 鉴权
  const secret = req.headers['x-upload-secret'];
  if (secret !== UPLOAD_SECRET) {
    res.status(401).json({ error: '未授权的上传请求' });
    return;
  }

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    res.status(400).json({ error: '需要 multipart/form-data 请求' });
    return;
  }
  const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '');

  // 收集 body
  let bodyBuffer;
  try {
    bodyBuffer = await collectBody(req);
  } catch (err) {
    res.status(400).json({ error: '读取请求体失败：' + (err.message || '') });
    return;
  }

  const { parts, files } = parseMultipart(bodyBuffer, boundary);
  const file = files.file || files.image || files.photo;
  if (!file) {
    res.status(400).json({ error: '未收到图片文件' });
    return;
  }
  if (!file.type.startsWith('image/')) {
    res.status(400).json({ error: '只支持图片文件' });
    return;
  }
  if (file.data.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: '图片不能超过 10MB' });
    return;
  }

  const title = parts.title || file.filename.replace(/\.[^.]+$/, '');
  const category = parts.category || '日常';
  const mood = parts.mood || '';

  const ext = (file.filename.split('.').pop() || 'jpg').toLowerCase();
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const pathname = `uploads/${id}.${ext}`;

  try {
    const blob = await put(pathname, file.data, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: true,
      allowOverwrite: false
    });

    const index = await getIndex();
    index.photos.unshift({
      id,
      url: blob.url,
      pathname: blob.pathname,
      title,
      category,
      mood,
      filename: file.filename,
      size: file.data.length,
      uploadedAt: new Date().toISOString()
    });
    await saveIndex(index);

    res.status(200).json({ success: true, photo: index.photos[0] });
  } catch (err) {
    res.status(500).json({ error: '上传失败：' + (err.message || '未知错误') });
  }
}

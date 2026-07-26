import { head } from '@vercel/blob';

const INDEX_PATH = '_index/photos.json';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const index = await getIndex();
  const category = req.query && req.query.category;
  let photos = index.photos || [];
  if (category && category !== '全部') {
    photos = photos.filter(p => p.category === category);
  }

  res.status(200).json({
    success: true,
    count: photos.length,
    photos
  });
}

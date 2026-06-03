import express from 'express';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN  = process.env.TOKEN  ?? 'r1-radio-2026';
const PORT   = process.env.PORT   ?? 15000;
const TUNEIN = 'https://opml.radiotime.com';

const app = express();

// Serve built client
app.use(express.static(join(__dirname, 'public')));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Token auth for API routes
app.use('/browse', auth);
app.use('/search', auth);
app.use('/tune',   auth);

function auth(req, res, next) {
  if (req.query.token !== TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('bad json')); } });
    }).on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function toStation(item) {
  return {
    id: item.guide_id ?? item.preset_id ?? '',
    name: item.text ?? '',
    logo: item.image ?? null,
    nowPlaying: item.current_track ?? null,
  };
}

async function resolvePls(url) {
  const text = await fetchText(url);
  const m = text.match(/File1=(.*)/);
  if (!m) throw new Error('no stream in pls');
  return m[1].trim();
}

app.get('/browse', async (req, res) => {
  try {
    const id  = req.query.id;
    const url = id
      ? `${TUNEIN}/Browse.ashx?id=${encodeURIComponent(id)}&render=json`
      : `${TUNEIN}/Browse.ashx?render=json`;
    const data = await fetchJson(url);
    const body = data.body ?? [];
    const links    = body.filter(i => i.type === 'link').map(i => ({ id: i.guide_id ?? i.URL ?? '', title: i.text ?? '' }));
    const stations = body.filter(i => i.type === 'audio').map(toStation);
    res.json({ links, stations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/search', async (req, res) => {
  try {
    const q   = req.query.q ?? '';
    const url = `${TUNEIN}/Search.ashx?query=${encodeURIComponent(q)}&render=json`;
    const data = await fetchJson(url);
    const stations = (data.body ?? []).filter(i => i.type === 'audio').map(toStation);
    res.json({ stations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/tune', async (req, res) => {
  try {
    const id  = req.query.id;
    const url = `${TUNEIN}/Tune.ashx?id=${encodeURIComponent(id)}&render=json`;
    const data = await fetchJson(url);
    const item = (data.body ?? [])[0];
    if (!item) return res.status(404).json({ error: 'no stream' });

    let stream = item.url ?? '';
    const ct   = item.content_type ?? '';
    let codec  = 'mp3';

    if (ct.includes('aac') || ct.includes('aacp'))              codec = 'aac';
    else if (stream.endsWith('.m3u8') || ct.includes('mpegurl')) codec = 'hls';

    if (stream.endsWith('.pls')) stream = await resolvePls(stream);

    res.json({ stream, codec, bitrate: item.bitrate ?? 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`r1-radio on :${PORT}`));

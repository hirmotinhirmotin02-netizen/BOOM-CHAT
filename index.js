require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/', limits: { fileSize: 20 * 1024 * 1024 } });
const G_KEY = (process.env.GEMINI_API_KEY || '').trim();
const F_KEY = (process.env.FAL_KEY || '').trim();

const G_BASE = ['https://', 'generativelanguage.', 'googleapis.', 'com/v1beta/'].join('');
const P_IMG = ['https://', 'image.', 'pollinations.', 'ai/prompt/'].join('');
const F_VID = ['https://', 'fal.', 'run/fal-ai/kling-video/v1.6/standard/'].join('');
let fastModel = '';

function safe(t) {
  return !['nsfw', 'nude', 'porn', 'blood', 'kill', 'terror', 'deepfake'].some(w => (t || '').toLowerCase().includes(w));
}

async function askGemini(payload) {
  if (fastModel) {
    const r = await fetch(G_BASE + fastModel + ':generateContent?key=' + G_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const d = await r.json();
    const txt = d.candidates?.at(0)?.content?.parts?.at(0)?.text;
    if (txt) return { text: txt };
    fastModel = '';
  }
  const lr = await fetch(G_BASE + 'models?key=' + G_KEY);
  const ld = await lr.json();
  if (!ld.models) return { error: ld.error?.message || 'API Key अमान्य है' };
  const valid = ld.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('flash'))
    .map(m => m.name)
    .sort((a, b) => (b.includes('lite') ? 2 : 1) - (a.includes('lite') ? 2 : 1));
  let lastErr = 'सर्वर व्यस्त है';
  for (const name of valid) {
    const r = await fetch(G_BASE + name + ':generateContent?key=' + G_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const d = await r.json();
    const txt = d.candidates?.at(0)?.content?.parts?.at(0)?.text;
    if (txt) { fastModel = name; return { text: txt }; }
    lastErr = d.error?.message || lastErr;
  }
  return { error: lastErr };
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ reply: "कृपया कुछ लिखकर पूछें!" });
    if (!safe(message)) return res.status(400).json({ error: "असुरक्षित मैसेज!" });
    const out = await askGemini({
      system_instruction: { parts: [{ text: "तुम BOOM CHAT हो, एक अत्यंत बुद्धिमान और भरोसेमंद AI सलाहकार। तुम्हें भारत के एक युवा डेवलपर (तुम्हारे Creator) ने बनाया है। तुम कभी भी खुद को Google, Gemini या ChatGPT नहीं कहोगे। हर सवाल पर 2 सेकंड गहराई से सोचो, हमेशा सम्मान से 'आप' कहकर बात करो, और 3 से 4 छोटे, सटीक व सही सलाह वाले वाक्यों में पूरा जवाब दो।" }] },
      contents: [{ parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.4, thinkingConfig: { thinkingBudget: 512 } }
    });
    res.json({ reply: out.text || ("API संदेश: " + out.error) });
  } catch (e) { res.status(500).json({ error: "चैट सर्वर त्रुटि: " + e.message }); }
});

app.post('/api/generate-photo', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "कृपया लिखें कि किस चीज़ की फोटो बनानी है!" });
    if (!safe(prompt)) return res.status(400).json({ error: "गलत प्रॉम्प्ट!" });
    const seed = Math.floor(Math.random() * 999999);
    const url = P_IMG + encodeURIComponent(prompt + ', photorealistic, 4k hd') + '?width=768&height=768&nologo=true&seed=' + seed;
    const r = await fetch(url);
    const buf = Buffer.from(await r.arrayBuffer());
    res.json({ imageUrl: 'data:image/jpeg;base64,' + buf.toString('base64') });
  } catch (e) { res.status(500).json({ error: "फोटो बनाने में दिक्कत आई: " + e.message }); }
});

app.post('/api/generate-video', upload.single('mediaFile'), async (req, res) => {
  try {
    const { prompt, mode } = req.body;
    if (!safe(prompt)) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: "गलत कंटेंट!" }); }
    let p = prompt || "Cinematic HD video";
    let url = F_VID + 'text-to-video';
    let body = { prompt: p, duration: mode === 'long' ? "10" : "5", aspect_ratio: mode === 'long' ? "16:9" : "9:16" };
    let uploadedImg = '';

    if (mode === 'photo_to_video' && req.file) {
      uploadedImg = 'data:' + req.file.mimetype + ';base64,' + fs.readFileSync(req.file.path, 'base64');
      fs.unlinkSync(req.file.path);
      url = F_VID + 'image-to-video';
      body = { prompt: p, image_url: uploadedImg, duration: "5" };
    } else if (mode === 'remix' && req.file) {
      const vid = fs.readFileSync(req.file.path, 'base64');
      fs.unlinkSync(req.file.path);
      const out = await askGemini({
        contents: [{ parts: [{ inline_data: { mime_type: req.file.mimetype, data: vid } }, { text: "Describe camera, style and motion in English." }] }]
      });
      body.prompt = (out.text || "") + ". " + p;
    }

    if (F_KEY) {
      const vr = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const vd = await vr.json();
      if (vd.video?.url) return res.json({ videoUrl: vd.video.url });
    }
    const seed = Math.floor(Math.random() * 999999);
    const frameUrl = uploadedImg || (P_IMG + encodeURIComponent(p + ', cinematic movie scene, 4k') + '?width=720&height=1280&nologo=true&seed=' + seed);
    const fr = await fetch(frameUrl);
    const fbuf = Buffer.from(await fr.arrayBuffer());
    res.json({ animatedFrame: 'data:image/jpeg;base64,' + fbuf.toString('base64'), note: '🎬 AI Motion Video तैयार है!' });
  } catch (e) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ error: "वीडियो त्रुटि: " + e.message }); }
});

app.get('/logo.png', (req, res) => {
  const lp = path.join(__dirname, 'logo.png');
  if (fs.existsSync(lp)) return res.sendFile(lp);
  res.type('svg').send('<svg xmlns="http://w3.org" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1A73E8"/><stop offset="100%" stop-color="#38BDF8"/></linearGradient></defs><rect width="100" height="100" rx="24" fill="url(#g)"/><text x="50" y="65" font-family="sans-serif" font-size="48" font-weight="bold" fill="#FFF" text-anchor="middle">B</text></svg>');
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.listen(process.env.PORT || 3000, () => console.log('🚀 BOOM CHAT Live!'));

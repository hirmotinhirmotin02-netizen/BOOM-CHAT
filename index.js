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
const F_IMG = ['https://', 'fal.', 'run/fal-ai/flux/schnell'].join('');
const F_VID = ['https://', 'fal.', 'run/fal-ai/kling-video/v1.6/standard/'].join('');

function safe(t) {
  return !['nsfw', 'nude', 'porn', 'blood', 'kill', 'terror', 'deepfake'].some(w => (t || '').toLowerCase().includes(w));
}

async function askGemini(payload) {
  const lr = await fetch(G_BASE + 'models?key=' + G_KEY);
  const ld = await lr.json();
  if (!ld.models) return { error: ld.error?.message || 'API Key अमान्य है' };
  const valid = ld.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name)
    .sort((a, b) => (b.includes('flash') ? 1 : 0) - (a.includes('flash') ? 1 : 0));
  let lastErr = 'कोई मॉडल उपलब्ध नहीं है';
  for (const name of valid) {
    const r = await fetch(G_BASE + name + ':generateContent?key=' + G_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const d = await r.json();
    const txt = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (txt) return { text: txt };
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
      system_instruction: { parts: [{ text: "तुम BOOM CHAT हो। हर भाषा में दोस्ताना और समझदारी से जवाब दो।" }] },
      contents: [{ parts: [{ text: message }] }]
    });
    res.json({ reply: out.text || ("API संदेश: " + out.error) });
  } catch (e) { res.status(500).json({ error: "चैट सर्वर त्रुटि: " + e.message }); }
});

app.post('/api/generate-photo', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "कृपया लिखें कि किस चीज़ की फोटो बनानी है!" });
    if (!safe(prompt)) return res.status(400).json({ error: "गलत प्रॉम्प्ट!" });
    const r = await fetch(F_IMG, {
      method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const d = await r.json();
    if (d.images?.[0]?.url) return res.json({ imageUrl: d.images[0].url });
    res.status(500).json({ error: "फोटो नहीं बनी: " + (d.detail || d.message || "FAL_KEY या बैलेंस चेक करें") });
  } catch (e) { res.status(500).json({ error: "फोटो सर्वर त्रुटि: " + e.message }); }
});

app.post('/api/generate-video', upload.single('mediaFile'), async (req, res) => {
  try {
    const { prompt, mode } = req.body;
    if (!safe(prompt)) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: "गलत कंटेंट!" }); }
    let p = prompt || "Cinematic HD video";
    let url = F_VID + 'text-to-video';
    let body = { prompt: p, duration: mode === 'long' ? "10" : "5", aspect_ratio: mode === 'long' ? "16:9" : "9:16" };

    if (mode === 'photo_to_video' && req.file) {
      const img = 'data:' + req.file.mimetype + ';base64,' + fs.readFileSync(req.file.path, 'base64');
      fs.unlinkSync(req.file.path);
      url = F_VID + 'image-to-video';
      body = { prompt: p, image_url: img, duration: "5" };
    } else if (mode === 'remix' && req.file) {
      const vid = fs.readFileSync(req.file.path, 'base64');
      fs.unlinkSync(req.file.path);
      const out = await askGemini({
        contents: [{ parts: [{ inline_data: { mime_type: req.file.mimetype, data: vid } }, { text: "Describe camera, style and motion in English." }] }]
      });
      body.prompt = (out.text || "") + ". " + p;
    }

    const vr = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const vd = await vr.json();
    if (vd.video?.[0]?.url) return res.json({ videoUrl: vd.video[0].url });
    if (vd.video?.url) return res.json({ videoUrl: vd.video.url });
    res.status(500).json({ error: "वीडियो नहीं बना: " + (vd.detail || vd.message || "FAL_KEY या बैलेंस चेक करें") });
  } catch (e) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ error: "वीडियो त्रुटि: " + e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.listen(process.env.PORT || 3000, () => console.log('🚀 BOOM CHAT Live!'));

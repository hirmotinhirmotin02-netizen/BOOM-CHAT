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
const G_KEY = process.env.GEMINI_API_KEY;
const F_KEY = process.env.FAL_KEY;

const G_API = ['https://', 'generativelanguage.', 'googleapis.', 'com/v1beta/models/gemini-2.5-flash:generateContent?key='].join('');
const F_IMG = ['https://', 'fal.', 'run/fal-ai/flux/schnell'].join('');
const F_VID = ['https://', 'fal.', 'run/fal-ai/kling-video/v1.6/standard/'].join('');

function safe(t) {
  return !['nsfw', 'nude', 'porn', 'blood', 'kill', 'terror', 'deepfake'].some(w => (t || '').toLowerCase().includes(w));
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!safe(message)) return res.status(400).json({ error: "असुरक्षित मैसेज!" });
    const r = await fetch(G_API + G_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "तुम BOOM CHAT हो। हर भाषा में दोस्ताना और समझदारी से जवाब दो।" }] },
        contents: [{ parts: [{ text: message }] }]
      })
    });
    const d = await r.json();
    const txt = d.candidates && d.candidates && d.candidates.content && d.candidates.content.parts && d.candidates.content.parts && d.candidates.content.parts.text;
    res.json({ reply: txt || "फिर से प्रयास करें।" });
  } catch (e) { res.status(500).json({ error: "चैट सर्वर व्यस्त है।" }); }
});

app.post('/api/generate-photo', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!safe(prompt)) return res.status(400).json({ error: "गलत प्रॉम्प्ट!" });
    const r = await fetch(F_IMG, {
      method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const d = await r.json();
    if (d.images && d.images && d.images.url) res.json({ imageUrl: d.images.url });
    else res.status(500).json({ error: "फोटो नहीं बन पाई, कोटा सुरक्षित है।" });
  } catch (e) { res.status(500).json({ error: "फोटो बनाने में दिक्कत आई।" }); }
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
      const gr = await fetch(G_API + G_KEY, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: req.file.mimetype, data: vid } }, { text: "Describe camera, style and motion in English." }] }] })
      });
      const gd = await gr.json();
      const desc = gd.candidates && gd.candidates && gd.candidates.content && gd.candidates.content.parts && gd.candidates.content.parts && gd.candidates.content.parts.text;
      body.prompt = (desc || "") + ". " + p;
    }

    const vr = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const vd = await vr.json();
    if (vd.video && vd.video.url) res.json({ videoUrl: vd.video.url });
    else res.status(500).json({ error: "वीडियो नहीं बन पाया, कोटा सुरक्षित है।" });
  } catch (e) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ error: "वीडियो सर्वर एरर।" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.listen(process.env.PORT || 3000, () => console.log('🚀 BOOM CHAT Live!'));

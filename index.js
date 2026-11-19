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

async function makeImageBase64(engPrompt, w, h) {
  try {
    const ir = await fetch(G_BASE + 'models/imagen-3.0-generate-002:predict?key=' + G_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt: engPrompt }], parameters: { sampleCount: 1, aspectRatio: w < h ? "9:16" : (w > h ? "16:9" : "1:1") } })
    });
    const id = await ir.json();
    const b64 = id.predictions?.at(0)?.bytesBase64Encoded;
    if (b64) return 'data:image/jpeg;base64,' + b64;
  } catch (e) {}
  try {
    const seed = Math.floor(Math.random() * 999999);
    const url = P_IMG + encodeURIComponent(engPrompt + ', 3d animation style, vibrant, 4k') + `?width=${w}&height=${h}&nologo=true&seed=${seed}`;
    const r = await fetch(url);
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 2000) return 'data:image/jpeg;base64,' + buf.toString('base64');
    }
  } catch (e) {}
  const fb = await fetch(`https://picsum.photos{Math.floor(Math.random()*9999)}/${w}/${h}`);
  const fbuf = Buffer.from(await fb.arrayBuffer());
  return 'data:image/jpeg;base64,' + fbuf.toString('base64');
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ reply: "कृपया कुछ लिखकर पूछें!" });
    if (!safe(message)) return res.status(400).json({ error: "असुरक्षित मैसेज!" });
    const out = await askGemini({
      system_instruction: { parts: [{ text: "तुम BOOM CHAT हो—ChatGPT की तरह अत्यंत बुद्धिमान, तार्किक और सहायक AI। हर सवाल को गहराई से समझो और 2 सेकंड में सटीक, आसान व पॉइंट-वाइज़ जवाब दो। यदि यूज़र फोटो या वीडियो बनाने को कहे, तो कहो: 'जी ज़रूर! नीचे बाईं तरफ + बटन दबाकर Photo या Video चुनें और अपना विषय लिखें, मैं तुरंत बना दूँगा।' हमेशा केवल शुद्ध हिंदी (देवनागरी लिपि) या शुद्ध अंग्रेजी में लिखो—एक ही शब्द में दोनों लिपियाँ कभी मत मिलाओ।" }] },
      contents: [{ parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 250, temperature: 0.4, thinkingConfig: { thinkingBudget: 512 } }
    });
    res.json({ reply: out.text || ("API संदेश: " + out.error) });
  } catch (e) { res.status(500).json({ error: "चैट सर्वर त्रुटि: " + e.message }); }
});

app.post('/api/generate-photo', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "कृपया लिखें कि किस चीज़ की फोटो बनानी है!" });
    if (!safe(prompt)) return res.status(400).json({ error: "गलत प्रॉम्प्ट!" });
    const en = await askGemini({ contents: [{ parts: [{ text: "Convert this into a detailed 3D/realistic English image prompt (only prompt): " + prompt }] }] });
    const img = await makeImageBase64((en.text || prompt).trim(), 768, 768);
    res.json({ imageUrl: img });
  } catch (e) { res.status(500).json({ error: "फोटो बनाने में दिक्कत आई: " + e.message }); }
});

app.post('/api/generate-video', upload.single('mediaFile'), async (req, res) => {
  try {
    const { prompt, mode } = req.body;
    if (!safe(prompt)) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: "गलत कंटेंट!" }); }
    let p = prompt || "Cute animated story";
    let isLong = mode === 'long';
    let w = isLong ? 1280 : 720, h = isLong ? 720 : 1280;
    let uploadedImg = '';

    if (mode === 'photo_to_video' && req.file) {
      uploadedImg = 'data:' + req.file.mimetype + ';base64,' + fs.readFileSync(req.file.path, 'base64');
      fs.unlinkSync(req.file.path);
    } else if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    if (F_KEY) {
      let url = uploadedImg ? F_VID + 'image-to-video' : F_VID + 'text-to-video';
      let body = uploadedImg ? { prompt: p, image_url: uploadedImg, duration: "5" } : { prompt: p, duration: isLong ? "10" : "5", aspect_ratio: isLong ? "16:9" : "9:16" };
      const vr = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const vd = await vr.json();
      if (vd.video?.url) return res.json({ videoUrl: vd.video.url });
    }

    const sb = await askGemini({
      contents: [{ parts: [{ text: `Create a 4-scene animated story video script for: "${p}". Return ONLY a valid JSON array of 4 objects like [{"en":"3D Pixar style cute red apple and green chili talking happily","hi":"एक दिन रसोई में लाल सेब और हरी मिर्ची की दोस्ती हुई।"}]. Keep "hi" in pure Hindi Devanagari (1 short sentence per scene).` }] }]
    });
    let scenes = [];
    try {
      const raw = (sb.text || '').replace(/```json|```/g, '').trim();
      scenes = JSON.parse(raw);
    } catch (e) {
      scenes = [
        { en: "3D Pixar style cute animated characters " + p + ", scene 1, bright colors", hi: p + " की मज़ेदार कहानी शुरू होती है।" },
        { en: "3D Pixar style cute animated characters " + p + ", funny moment, scene 2", hi: "कहानी में एक नया और मज़ेदार मोड़ आता है।" },
        { en: "3D Pixar style cute animated characters " + p + ", happy ending, scene 3", hi: "आखिर में सब कुछ बहुत अच्छा हो जाता है।" }
      ];
    }
    const frames = [];
    for (const sc of scenes.slice(0, 4)) {
      const img = uploadedImg || await makeImageBase64(sc.en, w, h);
      frames.push({ img, text: sc.hi });
    }
    res.json({ storyVideo: frames, note: isLong ? '🎬 AI Story Long Video तैयार है!' : '📱 AI Story Shorts तैयार है!' });
  } catch (e) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ error: "वीडियो त्रुटि: " + e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.listen(process.env.PORT || 3000, () => console.log('🚀 BOOM CHAT Live!'));

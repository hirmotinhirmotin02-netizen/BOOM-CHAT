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
  if (!ld.models) return { error: ld.error?.message || 'GEMINI_API_KEY अमान्य है' };
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

async function makeGeminiImage(engPrompt, aspect) {
  const imgModels = ['models/gemini-2.0-flash-exp-image-generation', 'models/gemini-2.5-flash-image', 'models/gemini-2.0-flash-preview-image-generation'];
  for (const m of imgModels) {
    try {
      const r = await fetch(G_BASE + m + ':generateContent?key=' + G_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Generate a vibrant 3D Pixar cartoon style image: ' + engPrompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] }
        })
      });
      const d = await r.json();
      const parts = d.candidates?.at(0)?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData?.data);
      if (imgPart) return 'data:' + (imgPart.inlineData.mimeType || 'image/png') + ';base64,' + imgPart.inlineData.data;
    } catch (e) {}
  }
  try {
    const ir = await fetch(G_BASE + 'models/imagen-3.0-generate-002:predict?key=' + G_KEY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt: engPrompt }], parameters: { sampleCount: 1, aspectRatio: aspect || '1:1' } })
    });
    const id = await ir.json();
    const b64 = id.predictions?.at(0)?.bytesBase64Encoded;
    if (b64) return 'data:image/jpeg;base64,' + b64;
  } catch (e) {}
  return '';
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ reply: "कृपया कुछ लिखकर पूछें!" });
    if (!safe(message)) return res.status(400).json({ error: "असुरक्षित मैसेज!" });
    const isHard = message.length > 45 || /क्यों|कैसे|अंतर|गणित|कोड|इतिहास|विज्ञान|समझाओ|why|how|explain|code|math/i.test(message);
    const out = await askGemini({
      system_instruction: { parts: [{ text: "तुम BOOM CHAT हो—Google और ChatGPT की तरह अत्यंत बुद्धिमान, तार्किक और तेज़ AI सहायक। आसान सवालों का तुरंत 2 छोटे वाक्यों में और कठिन सवालों का गहराई से सोचकर स्पष्ट पॉइंट्स में सटीक जवाब दो। यदि यूज़र फोटो या वीडियो बनाने को कहे, तो कहो: 'जी ज़रूर! नीचे बाईं तरफ + बटन दबाकर Photo या Video चुनें और अपना विषय लिखें, मैं तुरंत बना दूँगा।' हमेशा शुद्ध हिंदी (देवनागरी) या शुद्ध अंग्रेजी में लिखो—एक ही शब्द में दोनों लिपियाँ कभी मत मिलाओ।" }] },
      contents: [{ parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: isHard ? 350 : 160, temperature: 0.35, thinkingConfig: { thinkingBudget: isHard ? 1024 : 128 } }
    });
    res.json({ reply: out.text || ("API संदेश: " + out.error) });
  } catch (e) { res.status(500).json({ error: "चैट सर्वर त्रुटि: " + e.message }); }
});

app.post('/api/generate-photo', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "कृपया लिखें कि किस चीज़ की फोटो बनानी है!" });
    if (!safe(prompt)) return res.status(400).json({ error: "गलत प्रॉम्प्ट!" });
    const en = await askGemini({ contents: [{ parts: [{ text: "Translate and enhance into a detailed 3D/photorealistic English image prompt (only prompt): " + prompt }] }] });
    const img = await makeGeminiImage((en.text || prompt).trim(), '1:1');
    if (!img) return res.status(500).json({ error: "अभी आपकी GEMINI_API_KEY से इमेज जनरेशन उपलब्ध नहीं है—कृपया Google AI Studio में नई फ्री Key बनाएं।" });
    res.json({ imageUrl: img });
  } catch (e) { res.status(500).json({ error: "फोटो बनाने में दिक्कत आई: " + e.message }); }
});

app.post('/api/generate-video', upload.single('mediaFile'), async (req, res) => {
  try {
    const { prompt, mode } = req.body;
    if (!safe(prompt)) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: "गलत कंटेंट!" }); }
    let p = prompt || "Cute 3D Pixar animated funny characters talking";
    let isLong = mode === 'long';
    let uploadedImg = '';
    if (mode === 'photo_to_video' && req.file) {
      uploadedImg = 'data:' + req.file.mimetype + ';base64,' + fs.readFileSync(req.file.path, 'base64');
      fs.unlinkSync(req.file.path);
    } else if (req.file) fs.unlinkSync(req.file.path);

    const en = await askGemini({ contents: [{ parts: [{ text: "Convert this into a vivid 3D Pixar cartoon video scene prompt in English (only prompt): " + p }] }] });
    const engPrompt = (en.text || p).trim();

    if (F_KEY) {
      let url = uploadedImg ? F_VID + 'image-to-video' : F_VID + 'text-to-video';
      let body = uploadedImg ? { prompt: engPrompt, image_url: uploadedImg, duration: "5" } : { prompt: engPrompt, duration: isLong ? "10" : "5", aspect_ratio: isLong ? "16:9" : "9:16" };
      const vr = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const vd = await vr.json();
      if (vd.video?.url) return res.json({ videoUrl: vd.video.url });
    }

    const sb = await askGemini({
      contents: [{ parts: [{ text: `Create a 4-scene funny 3D Pixar story script for: "${p}". Return ONLY valid JSON array of 4 objects [{"en":"3D Pixar style cute funny character scene in English","hi":"शुद्ध हिंदी में एक छोटा मज़ेदार वाक्य"}].` }] }]
    });
    let scenes = [];
    try { scenes = JSON.parse((sb.text || '').replace(/```json|```/g, '').trim()); } catch (e) {
      scenes = [{ en: engPrompt + ", scene 1", hi: p + " की मज़ेदार कहानी शुरू होती है।" }, { en: engPrompt + ", funny reaction, scene 2", hi: "तभी वहाँ एक मज़ेदार घटना घटती है!" }];
    }
    const frames = [];
    for (const sc of scenes.slice(0, 4)) {
      const img = uploadedImg || await makeGeminiImage(sc.en, isLong ? '16:9' : '9:16');
      if (img) frames.push({ img, text: sc.hi });
    }
    if (!frames.length) return res.status(500).json({ error: "आपकी GEMINI_API_KEY के लिए इमेज/वीडियो मॉडल अभी उपलब्ध नहीं है।" });
    res.json({ storyVideo: frames, note: isLong ? '🎬 AI Story Long Video तैयार है!' : '📱 AI Story Shorts तैयार है!' });
  } catch (e) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ error: "वीडियो त्रुटि: " + e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.listen(process.env.PORT || 3000, () => console.log('🚀 BOOM CHAT Live!'));

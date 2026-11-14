require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const { fal } = require('@fal-ai/client');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/', limits: { fileSize: 20 * 1024 * 1024 } });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
fal.config({ credentials: process.env.FAL_KEY });

function isPromptSafe(text) {
  const blocked = ['nsfw', 'nude', 'porn', 'blood', 'kill', 'terror', 'deepfake'];
  const lower = (text || '').toLowerCase();
  return !blocked.some(w => lower.includes(w));
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!isPromptSafe(message)) return res.status(400).json({ error: "यह मैसेज सुरक्षित नहीं है।" });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: { systemInstruction: "तुम BOOM CHAT हो। दुनिया की हर भाषा में समझदारी और दोस्ताना तरीके से जवाब दो।" }
    });
    res.json({ reply: response.text });
  } catch (e) {
    res.status(500).json({ error: "चैट में दिक्कत आई है।" });
  }
});

app.post('/api/generate-photo', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!isPromptSafe(prompt)) return res.status(400).json({ error: "गलत प्रॉम्प्ट की अनुमति नहीं है।" });
    const result = await fal.subscribe("fal-ai/flux/schnell", { input: { prompt } });
    res.json({ imageUrl: result.data.images.url });
  } catch (e) {
    res.status(500).json({ error: "फोटो नहीं बन पाई, कोटा सुरक्षित है।" });
  }
});

app.post('/api/generate-video', upload.single('mediaFile'), async (req, res) => {
  try {
    const { prompt, mode } = req.body;
    if (!isPromptSafe(prompt)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "गलत कंटेंट की अनुमति नहीं है।" });
    }
    let finalPrompt = prompt || "Cinematic high quality video";
    let videoResult;

    if (mode === 'photo_to_video' && req.file) {
      const buf = fs.readFileSync(req.file.path);
      const url = await fal.storage.upload(new Blob([buf], { type: req.file.mimetype }));
      fs.unlinkSync(req.file.path);
      videoResult = await fal.subscribe("fal-ai/kling-video/v1.6/standard/image-to-video", {
        input: { prompt: finalPrompt, image_url: url, duration: "5" }
      });
    } else if (mode === 'remix' && req.file) {
      const bytes = fs.readFileSync(req.file.path);
      const analysis = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { inlineData: { data: bytes.toString("base64"), mimeType: req.file.mimetype } },
          "Describe camera movement, lighting, style, and motion of this video as a detailed English AI video prompt."
        ]
      });
      finalPrompt = `${analysis.text}. ${finalPrompt}`;
      fs.unlinkSync(req.file.path);
      videoResult = await fal.subscribe("fal-ai/kling-video/v1.6/standard/text-to-video", {
        input: { prompt: finalPrompt, duration: "5", aspect_ratio: "9:16" }
      });
    } else {
      videoResult = await fal.subscribe("fal-ai/kling-video/v1.6/standard/text-to-video", {
        input: { prompt: finalPrompt, duration: mode === 'long' ? "10" : "5", aspect_ratio: mode === 'long' ? "16:9" : "9:16" }
      });
    }
    res.json({ videoUrl: videoResult.data.video.url });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "वीडियो बनाने में दिक्कत आई, कोटा सुरक्षित है।" });
  }
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BOOM CHAT</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; }
  body { background: #0A0A0A; color: #fff; height: 100vh; display: flex; flex-direction: column; }
  #loginScreen { position: fixed; inset: 0; background: #0A0A0A; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 24px; z-index: 100; }
  .logo-title { font-size: 32px; font-weight: bold; color: #00A8FF; letter-spacing: 2px; margin-bottom: 10px; }
  input.login-input { width: 100%; max-width: 340px; padding: 14px; border-radius: 14px; border: none; background: #1A1D24; color: #fff; margin: 14px 0; font-size: 16px; }
  button.primary-btn { width: 100%; max-width: 340px; padding: 14px; border-radius: 14px; border: none; background: linear-gradient(90deg, #00A8FF, #0051FF); color: #fff; font-weight: bold; font-size: 16px; cursor: pointer; }
  header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #1C1F26; }
  .pro-btn { background: linear-gradient(90deg, #00A8FF, #0051FF); border: none; color: #fff; padding: 6px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; }
  #chatBox { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .welcome { margin: auto; text-align: center; color: #888; }
  .msg { max-width: 80%; padding: 12px 16px; border-radius: 18px; line-height: 1.5; position: relative; }
  .user { align-self: flex-end; background: #00A8FF; color: #fff; }
  .ai { align-self: flex-start; background: #1C1F26; color: #eee; }
  .media-wrap { position: relative; margin-top: 8px; }
  .media-wrap img, .media-wrap video { width: 100%; border-radius: 12px; }
  .watermark { position: absolute; bottom: 8px; right: 10px; font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.65); background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; }
  #modeTag { display: none; background: #1C1F26; padding: 6px 16px; font-size: 12px; color: #00A8FF; justify-content: space-between; }
  .input-area { padding: 10px; background: #0A0A0A; }
  .input-bar { display: flex; align-items: center; background: #1A1D24; border-radius: 30px; padding: 6px 10px; gap: 8px; }
  .icon-btn { background: none; border: none; color: #00A8FF; font-size: 24px; cursor: pointer; padding: 4px; }
  #msgInput { flex: 1; background: none; border: none; color: #fff; font-size: 15px; outline: none; }
  .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); justify-content: center; align-items: flex-end; z-index: 50; }
  .sheet { background: #16181D; width: 100%; max-width: 500px; border-radius: 24px 24px 0 0; padding: 20px; }
  .menu-item { padding: 12px; border-radius: 12px; background: #1F222A; margin-bottom: 10px; cursor: pointer; display: flex; justify-content: space-between; }
  .plan-box { border: 1px solid #00A8FF; padding: 14px; border-radius: 14px; margin-bottom: 12px; background: #1C1F26; }
</style>
</head>
<body>
<div id="loginScreen">
  <div class="logo-title">⚡ BOOM CHAT</div>
  <p style="color:#aaa; text-align:center;">हर भाषा में अनलिमिटेड AI चैट, फोटो और वीडियो</p>
  <input type="text" id="userNameInput" class="login-input" placeholder="अपना नाम लिखें...">
  <button class="primary-btn" onclick="doLogin()">लॉगिन करें</button>
</div>
<header>
  <button class="icon-btn" onclick="alert('My Creations: बनाए गए फोटो और वीडियो नीचे डाउनलोड बटन से सेव करें!')">☰</button>
  <button class="pro-btn" onclick="openModal('proModal')">👑 Get PRO</button>
  <button class="icon-btn" onclick="document.getElementById('chatBox').innerHTML=''">📝</button>
</header>
<div id="chatBox">
  <div class="welcome">
    <h2 style="color:#00A8FF;">BOOM CHAT</h2>
    <p>अनलिमिटेड चैट • वॉइस • 4 फ्री फोटो • AI वीडियो</p>
  </div>
</div>
<div id="modeTag">
  <span id="modeText"></span>
  <span style="cursor:pointer;" onclick="resetMode()">✖</span>
</div>
<div class="input-area">
  <div class="input-bar">
    <button class="icon-btn" onclick="openModal('plusModal')">➕</button>
    <input type="file" id="fileInput" style="display:none;" onchange="fileSelected()">
    <input type="text" id="msgInput" placeholder="BOOM CHAT से कुछ भी पूछें..." oninput="toggleSendBtn()">
    <button class="icon-btn" id="actionBtn" onclick="handleAction()">🎧</button>
  </div>
</div>
<div class="modal" id="plusModal" onclick="closeModals(event)">
  <div class="sheet">
    <h3 style="margin-bottom:14px;">क्या बनाना चाहते हैं?</h3>
    <div class="menu-item" onclick="selectMode('photo', false)"><span>🎨 AI Photo Generate</span><small id="qPhoto">4/4 फ्री</small></div>
    <div class="menu-item" onclick="selectMode('shorts', false)"><span>📱 AI Shorts Video</span><small id="qShorts">2/2 फ्री</small></div>
    <div class="menu-item" onclick="selectMode('long', false)"><span>🎬 AI Long Video</span><small id="qLong">1/1 फ्री</small></div>
    <div class="menu-item" onclick="selectMode('photo_to_video', true, 'image/*')"><span>🖼️ Photo se AI Video</span><small>फोटो चुनें</small></div>
    <div class="menu-item" onclick="selectMode('remix', true, 'video/*')"><span>🔥 Social Media Video Remix</span><small>वीडियो अपलोड करें</small></div>
  </div>
</div>
<div class="modal" id="proModal" onclick="closeModals(event)">
  <div class="sheet">
    <h2 style="color:#00A8FF; margin-bottom:10px;">👑 BOOM CHAT PRO</h2>
    <div class="plan-box">
      <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>Shorts & Photo Pack</span><span style="color:gold;">₹399 / महीना</span></div>
      <p style="font-size:12px; color:#ccc; margin-top:6px;">• 30 AI Shorts + 100 AI Photos<br>• कोई छोटा लोगो (Watermark) नहीं<br>• अनलिमिटेड चैट और वॉइस चैट</p>
    </div>
    <div class="plan-box">
      <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>Pro All-In-One Pack</span><span style="color:gold;">₹499 / महीना</span></div>
      

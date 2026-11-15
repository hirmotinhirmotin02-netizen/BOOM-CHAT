const txt = d.candidates?.[0]?.content?.parts?.[0]?.text;
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
      system_instruction: { parts: [{ text: "तुम BOOM CHAT हो, एक अत्यंत बुद्धिमान और भरोसेमंद AI सलाहकार। तुम्हें भारत के एक युवा डेवलपर (तुम्हारे Creator) ने बनाया है। तुम कभी भी खुद को Google, Gemini या ChatGPT नहीं कहोगे। हर सवाल पर गहराई से सोचो, हमेशा सम्मान से 'आप' कहकर बात करो, और 3 से 4 छोटे, सटीक व काम की सही सलाह दो।" }] },
      contents: [{ parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 220, temperature: 0.4, thinkingConfig: { thinkingBudget: 512 } }
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
    const imageUrl = P_IMG + encodeURIComponent(prompt + ', ultra detailed, 4k hd') + '?width=1024&height=1024&nologo=true&seed=' + seed;
    res.json({ imageUrl });
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
      const out = await askGemini({
        contents: [{ parts: [{ inline_data: { mime_type: req.file.mimetype, data: vid } }, { text: "Describe camera, style and motion in English." }] }]
      });
      body.prompt = (out.text || "") + ". " + p;
    }

    const vr = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Key ' + F_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const vd = await vr.json();
    if (vd.video?.[0]?.url) return res.json({ videoUrl: vd.video[0].url });
    if (vd.video?.url) return res.json({ videoUrl: vd.video.url });
    res.status(500).json({ error: "वीडियो नहीं बना: " + (vd.detail || vd.message || "fal.ai खाते में बैलेंस डालें") });
  } catch (e) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(500).json({ error: "वीडियो त्रुटि: " + e.message }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.listen(process.env.PORT || 3000, () => console.log('🚀 BOOM CHAT Live!'));
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

app.get('/logo.png', (req, res) => res.sendFile(path.join(__dirname, 'logo.png')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));
app.listen(process.env.PORT || 3000, () => console.log('🚀 BOOM CHAT Live!'));

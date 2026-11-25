
<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BOOM CHAT</title>
<meta name="theme-color" content="#080812">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="app">
<div id="messages"></div>
</div>
<div class="input-area">
<input type="text" id="userInput" placeholder="Ask BOOM CHAT...">
<button id="sendBtn">➤</button>
</div>
</main>
<footer>
<p>Powered by BOOM CHAT AI</p>
</footer>
</div>
<script src="app.js"></script>
<script>
const appName = "BOOM CHAT";
console.log("BOOM CHAT Started");
</script>
</body>
</html>
<!-- BOOM CHAT FEATURES -->
<section id="features">
<h2>Explore BOOM CHAT</h2>
<div class="feature-list">
<div class="feature">AI Chat</div>
<div class="feature">Voice Chat</div>
<div class="feature">Image Generator</div>
<div class="feature">Video Generator</div>
</div>
</section>
<section id="account">
<h2>My Account</h2>
<button id="loginBtn">Login</button>
<button id="signupBtn">Sign Up</button>
</section>
<section id="settings">
<h2>Settings</h2>
<button id="themeBtn">Change Theme</button>
</section>
<section id="subscription">
<h2>BOOM CHAT PRO</h2>
<div class="plan">Pro ₹199</div>
<div class="plan">Pro Max ₹699</div>
<button id="upgradeBtn">Upgrade Now</button>
</section>
<section id="report">
<h2>Report a Problem</h2>
<textarea id="reportText" placeholder="Write your report"></textarea>
</section>
<button id="reportBtn">Submit Report</button>
<section id="wallpapers">
<h2>Wallpapers</h2>
<div class="wallpaper-list">
<div class="wallpaper">Morning Sky</div>
<div class="wallpaper">Night Galaxy</div>
</div>
</section>
<section id="help">
<h2>Help Center</h2>
</section>
<p>How can we help you?</p>
<button id="helpBtn">Contact Support</button>
<section id="about">
<h2>About BOOM CHAT</h2>
<p>Your AI Space</p>
<p>Chat, Create and Explore</p>
</section>
<div id="notification"></div>
<div id="loading"></div>

<section id="voice">
<h2>Voice Assistant</h2>
<button id="voiceBtn">🎤 Start Voice</button>
</section>
<section id="language">
<h2>Select Language</h2>
<select id="languageSelect">
<option value="hi">Hindi</option>
<option value="en">English</option>
</select>
</section>
<section id="history">
<h2>Chat History</h2>
<div id="historyList"></div>
</section>
<section id="imageUpload">
<h2>Upload Image</h2>
<input type="file" id="imageFile" accept="image/*">
</section>
<section id="videoUpload">
<h2>Upload Video</h2>
</section>
<input type="file" id="videoFile" accept="video/*">
<button id="uploadBtn">Upload</button>
<section id="shorts">
<h2>AI Shorts</h2>
<p>Create Short Videos</p>
</section>
<section id="longVideos">
<h2>AI Long Videos</h2>
<p>Create Long Videos</p>
</section>
<section id="security">
<h2>Privacy & Security</h2>
<p>Your account matters</p>
</section>
<section id="feedback">
<h2>Send Feedback</h2>
<textarea id="feedbackText" placeholder="Your feedback"></textarea>
<button id="feedbackBtn">Send</button>
</section>
</main>
<!-- BOOM CHAT APP END -->
<div id="appStatus">
<p>BOOM CHAT is ready</p>
</div>
<div id="modalContainer"></div>
<div id="toastContainer"></div>
</body>
</html>
 

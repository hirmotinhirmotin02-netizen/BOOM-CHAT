DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BOOM CHAT</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
background:#080b14;
color:white;
font-family:Arial,sans-serif;
min-height:100vh;
}
header{
padding:22px;
text-align:center;
font-size:27px;
font-weight:bold;
color:#58c7ff;
}
#logo{
width:90px;height:90px;
border:4px solid #58c7ff;
border-radius:50%;
margin:40px auto 20px;
display:flex;
align-items:center;
justify-content:center;
font-size:30px;
font-weight:bold;
animation:rotate 5s linear infinite;
}
@keyframes rotate{
to{transform:rotate(360deg)}
}
.welcome{text-align:center;margin:20px}
.welcome h2{font-size:25px;margin-bottom:12px}
.welcome p{color:#aab5ca}
#chat{
max-width:600px;
margin:30px auto;
padding:15px;
}
#messages{
height:300px;
overflow-y:auto;
padding:12px;
background:#111827;
border-radius:15px;
}
#inputArea{
display:flex;
gap:8px;
margin-top:12px;
}
input{
flex:1;
min-width:0;
padding:14px;
border:1px solid #334155;
border-radius:12px;
background:#172033;
color:white;
}
button{
padding:13px 18px;
border:0;
border-radius:12px;
background:#168bff;
color:white;
font-weight:bold;
}
</style>
</head>
<body>
<header>BOOM CHAT</header>
<div id="logo">B</div>
<div class="welcome">
<h2>Namaste Dost!</h2>
<p>Your AI Space</p>
</div>
<div id="chat">
<div id="messages">
<p>BOOM CHAT: Namaste dost! ❤️</p>
</div>
<div id="inputArea">
<input id="userInput" placeholder="Message BOOM CHAT...">
<button onclick="sendMessage()">Send</button>
</div>
</div>
</body>
</html>

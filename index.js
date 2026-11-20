
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// BOOM CHAT API information
const APP_NAME = "BOOM CHAT";
const VERSION = "1.0.0";

// Home API
app.get("/", (req, res) => {
  res.json({
    app: APP_NAME,
    version: VERSION,
    message: "Welcome to BOOM CHAT API!",
    status: "running"
  });
});

// API status
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    server: "online",
    app: APP_NAME,
    version: VERSION
  });
});

// AI Chat placeholder
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "Please enter a message."
      });
    }

    res.json({
      success: true,
      app: APP_NAME,
      reply: "BOOM CHAT API is ready. AI model connection is pending."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${APP_NAME} API running on port ${PORT}`);
});

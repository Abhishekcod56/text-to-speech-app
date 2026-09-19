// server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3001";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Must match the React frontend limit.
const MAX_TEXT_LENGTH = 50;

// Allowed languages for this application.
const ALLOWED_LANGUAGES = ["en", "hi", "gu"];

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(
  cors({
    origin: CLIENT_URL,
  })
);

app.use(express.json({ limit: "1mb" }));

// --------------------------------------------------
// Local Voice Configuration
// --------------------------------------------------
//
// IMPORTANT:
// We do NOT call ElevenLabs /voices here.
// This avoids requiring the "voices_read" permission.
//
// Voice IDs and names come from .env.
//

const VOICES = [
  {
    id: process.env.ELEVEN_VOICE_ID_1,
    name: process.env.ELEVEN_VOICE_NAME_1 || "English",
    language: "en",
  },
  {
    id: process.env.ELEVEN_VOICE_ID_2,
    name: process.env.ELEVEN_VOICE_NAME_2 || "Hindi",
    language: "hi",
  },
  {
    id: process.env.ELEVEN_VOICE_ID_3,
    name: process.env.ELEVEN_VOICE_NAME_3 || "Gujarati",
    language: "gu",
  },
].filter((voice) => voice.id);

// --------------------------------------------------
// Health Check
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Text-to-Speech server is running",
  });
});

// --------------------------------------------------
// Get Voices
// --------------------------------------------------
//
// Returns the locally configured voices.
// No ElevenLabs /voices API is called.
//

app.get("/api/voices", (req, res) => {
  res.json({
    success: true,
    voices: VOICES,
  });
});

// --------------------------------------------------
// Text-to-Speech
// --------------------------------------------------

app.post("/api/tts", async (req, res) => {
  try {
    const {
      text,
      voiceId,
      language,
      speed,
      stability,
      similarityBoost,
      style,
      speakerBoost,
    } = req.body;

    // --------------------------------------------------
    // 1. Empty Text Validation
    // --------------------------------------------------

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Text is required.",
      });
    }

    const cleanText = text.trim();


// --------------------------------------------------
// Invalid / Meaningless Text Validation
// --------------------------------------------------
    const repeatedCharacterPattern = /^(.)(\1)+$/;

if (repeatedCharacterPattern.test(cleanText)) {
  return res.status(400).json({
    success: false,
    message: "Invalid text. Please enter meaningful text.",
  });
}
    // --------------------------------------------------
    // 2. Text Length Validation
    // --------------------------------------------------

    if (cleanText.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Text cannot exceed ${MAX_TEXT_LENGTH} characters.`,
      });
    }

    // --------------------------------------------------
    // 3. Language Validation
    // --------------------------------------------------

    if (
      !language ||
      typeof language !== "string" ||
      !ALLOWED_LANGUAGES.includes(language)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid language selected.",
      });
    }

    // --------------------------------------------------
    // 4. Voice Validation
    // --------------------------------------------------

    if (!voiceId || typeof voiceId !== "string") {
      return res.status(400).json({
        success: false,
        message: "A valid voice is required.",
      });
    }

    // Find the voice in our locally configured list.
    const selectedVoice = VOICES.find(
      (voice) => voice.id === voiceId
    );

    if (!selectedVoice) {
      return res.status(400).json({
        success: false,
        message: "Invalid voice selected.",
      });
    }

    // Make sure the selected voice matches the language.
    if (selectedVoice.language !== language) {
      return res.status(400).json({
        success: false,
        message: "Selected voice does not match the selected language.",
      });
    }

    const selectedVoiceId = selectedVoice.id;

    // --------------------------------------------------
    // 5. API Key Validation
    // --------------------------------------------------

    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is missing.");

      return res.status(500).json({
        success: false,
        message: "ElevenLabs API key is not configured.",
      });
    }

    // --------------------------------------------------
    // ElevenLabs Request Body
    // --------------------------------------------------

    const requestBody = {
      text: cleanText,
      model_id: "eleven_multilingual_v2",
    };

    // --------------------------------------------------
    // Optional Voice Settings
    // --------------------------------------------------

    if (
      speed !== undefined ||
      stability !== undefined ||
      similarityBoost !== undefined ||
      style !== undefined ||
      speakerBoost !== undefined
    ) {
      requestBody.voice_settings = {};

      if (stability !== undefined) {
        requestBody.voice_settings.stability = Number(stability);
      }

      if (similarityBoost !== undefined) {
        requestBody.voice_settings.similarity_boost =
          Number(similarityBoost);
      }

      if (style !== undefined) {
        requestBody.voice_settings.style = Number(style);
      }

      if (speed !== undefined) {
        requestBody.voice_settings.speed = Number(speed);
      }

      if (speakerBoost !== undefined) {
        requestBody.voice_settings.use_speaker_boost =
          Boolean(speakerBoost);
      }
    }

    // --------------------------------------------------
    // ElevenLabs API URL
    // --------------------------------------------------

    const elevenLabsUrl =
      "https://api.elevenlabs.io/v1/text-to-speech/" +
      `${encodeURIComponent(selectedVoiceId)}` +
      "?output_format=mp3_44100_128";

    console.log(
      `Generating speech with voice: ${selectedVoice.name} (${selectedVoice.language})`
    );

    // --------------------------------------------------
    // Call ElevenLabs
    // --------------------------------------------------

    let response;

    try {
      response = await fetch(elevenLabsUrl, {
        method: "POST",

        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },

        body: JSON.stringify(requestBody),
      });
    } catch (networkError) {
      // --------------------------------------------------
      // 6. Network Failure
      // --------------------------------------------------

      console.error(
        "Network error while connecting to ElevenLabs:",
        networkError
      );

      return res.status(503).json({
        success: false,
        message:
          "Unable to connect to the text-to-speech service. Please try again later.",
      });
    }

    // --------------------------------------------------
    // ElevenLabs API Error Handling
    // --------------------------------------------------

    if (!response.ok) {
      let errorData = null;

      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }

      console.error("ElevenLabs API error:", {
        status: response.status,
        error: errorData,
      });

      // --------------------------------------------------
      // Authentication / API Key Failure
      // --------------------------------------------------

      if (response.status === 401) {
        return res.status(502).json({
          success: false,
          message:
            "Invalid ElevenLabs API key or the API key does not have the required permission.",
        });
      }

      // --------------------------------------------------
      // Access Denied
      // --------------------------------------------------

      if (response.status === 403) {
        return res.status(502).json({
          success: false,
          message:
            "ElevenLabs access was denied. Please check your API key permissions.",
        });
      }

      // --------------------------------------------------
      // Invalid Voice / Voice Not Found
      // --------------------------------------------------

      if (response.status === 404) {
        return res.status(400).json({
          success: false,
          message: "The selected voice was not found.",
        });
      }

      // --------------------------------------------------
      // Rate Limit
      // --------------------------------------------------

      if (response.status === 429) {
        return res.status(429).json({
          success: false,
          message:
            "ElevenLabs rate limit exceeded. Please try again later.",
        });
      }

      // --------------------------------------------------
      // ElevenLabs Server Error
      // --------------------------------------------------

      if (response.status >= 500) {
        return res.status(502).json({
          success: false,
          message:
            "ElevenLabs service is temporarily unavailable. Please try again later.",
        });
      }

      // --------------------------------------------------
      // Other API Errors
      // --------------------------------------------------

      let message = "Failed to generate speech.";

      if (errorData?.detail?.message) {
        message = errorData.detail.message;
      } else if (errorData?.message) {
        message = errorData.message;
      }

      return res.status(502).json({
        success: false,
        message,
      });
    }

    // --------------------------------------------------
    // Convert ElevenLabs Response to Audio Buffer
    // --------------------------------------------------

    const audioArrayBuffer = await response.arrayBuffer();

    const audioBuffer = Buffer.from(audioArrayBuffer);

    if (!audioBuffer.length) {
      console.error("ElevenLabs returned an empty audio response.");

      return res.status(502).json({
        success: false,
        message: "The text-to-speech service returned empty audio.",
      });
    }

    // --------------------------------------------------
    // Return Audio to React
    // --------------------------------------------------

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": 'inline; filename="speech.mp3"',
      "Cache-Control": "no-store",
    });

    return res.send(audioBuffer);
  } catch (error) {
    // --------------------------------------------------
    // 8. General Server Error
    // --------------------------------------------------

    console.error("TTS server error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while generating speech.",
    });
  }
});

// --------------------------------------------------
// 404 Handler
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

// --------------------------------------------------
// Global Error Handler
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  res.status(500).json({
    success: false,
    message: "Something went wrong on the server.",
  });
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
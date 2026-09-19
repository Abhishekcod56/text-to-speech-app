import React, { useEffect, useState } from "react";
import "./App.css";
const API_URL = "https://text-to-speech-app-fgu4.onrender.com/api";

const MAX_TEXT_LENGTH = 50;

const LANGUAGES = [
  {
    code: "en",
    name: "English",
  },
  {
    code: "hi",
    name: "Hindi",
  },
  {
    code: "gu",
    name: "Gujarati",
  },
];

function App() {
  const [text, setText] = useState("");

  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("");

  const [language, setLanguage] = useState("en");

  const [audioUrl, setAudioUrl] = useState("");

  const [loadingVoices, setLoadingVoices] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --------------------------------------------------
  // Load voices
  // --------------------------------------------------

  useEffect(() => {
    loadVoices();
  }, []);

  async function loadVoices() {
    try {
      setLoadingVoices(true);
      setError("");

      const response = await fetch(`${API_URL}/voices`);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load voices."
        );
      }

      setVoices(data.voices || []);

      // Select English voice by default
      const englishVoice = data.voices?.find(
        (voice) => voice.language === "en"
      );

      if (englishVoice) {
        setSelectedVoice(englishVoice.id);
      } else if (data.voices?.length > 0) {
        setSelectedVoice(data.voices[0].id);
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to connect to the backend server."
      );
    } finally {
      setLoadingVoices(false);
    }
  }

  // --------------------------------------------------
  // Generate Speech
  // --------------------------------------------------

  async function generateSpeech() {
    setError("");
    setSuccess("");

    if (!text.trim()) {
      setError("Please enter some text.");
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      setError(
        `Text cannot exceed ${MAX_TEXT_LENGTH} characters.`
      );
      return;
    }

    if (!selectedVoice) {
      setError("Please select a voice.");
      return;
    }

    try {
      setGenerating(true);

      // Remove previous audio
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl("");
      }

      const response = await fetch(`${API_URL}/tts`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          text,
          voiceId: selectedVoice,
          language,
        }),
      });

      // Handle errors
      if (!response.ok) {
        let errorData;

        try {
          errorData = await response.json();
        } catch {
          errorData = null;
        }

        throw new Error(
          errorData?.message ||
            "Failed to generate speech."
        );
      }

      // Convert response to audio
      const audioBlob = await response.blob();

      const newAudioUrl = URL.createObjectURL(audioBlob);

      setAudioUrl(newAudioUrl);

      setSuccess("Speech generated successfully.");
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Something went wrong while generating speech."
      );
    } finally {
      setGenerating(false);
    }
  }

  // --------------------------------------------------
  // Clear
  // --------------------------------------------------

  function clearText() {
    setText("");
    setError("");
    setSuccess("");

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
  }

  // --------------------------------------------------
  // Download Audio
  // --------------------------------------------------

  function downloadAudio() {
    if (!audioUrl) {
      return;
    }

    const link = document.createElement("a");

    link.href = audioUrl;
    link.download = "generated-speech.mp3";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --------------------------------------------------
  // Language changed
  // --------------------------------------------------

  function handleLanguageChange(event) {
    const newLanguage = event.target.value;

    setLanguage(newLanguage);

    // Automatically select voice for selected language
    const matchingVoice = voices.find(
      (voice) => voice.language === newLanguage
    );

    if (matchingVoice) {
      setSelectedVoice(matchingVoice.id);
    } else {
      setSelectedVoice("");
    }
  }

  // --------------------------------------------------
  // Get voice for selected language
  // --------------------------------------------------

  const filteredVoices = voices.filter(
    (voice) => voice.language === language
  );

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app">
      <div className="container">

        {/* Header */}

        <header className="header">
          <h1>Text to Speech</h1>

         
        </header>

        {/* Main Card */}

        <main className="card">

          {/* Text */}

          <div className="form-group">

            <div className="label-row">
              <label htmlFor="text">
                Enter your text
              </label>
            </div>

            <textarea
              id="text"
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              placeholder="Enter your text here..."
              maxLength={MAX_TEXT_LENGTH}
              rows={9}
            />

            <div className="text-info">
              <span>
                Maximum characters allowed:{" "}
                {MAX_TEXT_LENGTH}
              </span>
            </div>

          </div>

          {/* Language */}

          <div className="form-group">
            <label htmlFor="language">
              Language
            </label>

            <select
              id="language"
              value={language}
              onChange={handleLanguageChange}
            >
              {LANGUAGES.map((item) => (
                <option
                  key={item.code}
                  value={item.code}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voice */}

          <div className="form-group">
            <label htmlFor="voice">
              Voice
            </label>

            <select
              id="voice"
              value={selectedVoice}
              onChange={(event) =>
                setSelectedVoice(event.target.value)
              }
              disabled={loadingVoices}
            >
              {loadingVoices && (
                <option>
                  Loading voices...
                </option>
              )}

              {!loadingVoices &&
                filteredVoices.length === 0 && (
                  <option value="">
                    No voice available
                  </option>
                )}

              {filteredVoices.map((voice) => (
                <option
                  key={voice.id}
                  value={voice.id}
                >
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          {/* Messages */}

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {success && (
            <div className="success">
              {success}
            </div>
          )}

          {/* Buttons */}

          <div className="buttons">

            <button
              className="generate-button"
              onClick={generateSpeech}
              disabled={
                generating || !text.trim()
              }
            >
              {generating
                ? "Generating..."
                : "Generate Speech"}
            </button>

            <button
              className="clear-button"
              onClick={clearText}
              disabled={!text && !audioUrl}
            >
              Clear
            </button>

          </div>

          {/* Audio */}

          {audioUrl && (
            <section className="audio-section">

              <h2>Generated Audio</h2>

              <audio
                controls
                src={audioUrl}
                className="audio-player"
              />

              <button
                className="download-button"
                onClick={downloadAudio}
              >
                Download Audio
              </button>

            </section>
          )}

        </main>

        

      </div>
    </div>
  );
}

export default App;
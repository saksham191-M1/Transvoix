# 🌐 TransVoix — Universal Real-Time AI Communication Platform

> **Break every language barrier in real time.** TransVoix enables multi-participant, real-time bidirectional speech translation across 50+ languages with instant neural voice synthesis, dynamic pitch/gender persona matching, and zero audio feedback loops.

---

## ✨ Features

- ⚡ **Instant Real-Time Speech Translation**: Sub-150ms chunked streaming translation powered by FastAPI WebSockets and Neural TTS engines.
- 🌍 **50+ Supported Languages**: Translate conversations seamlessly across English, Spanish, Hindi, Japanese, French, German, Mandarin, Arabic, Russian, and 40+ more.
- 👨‍👩‍👧 **Dual Male & Female Neural Voice Personas**: Choose your preferred AI voice gender per language with realistic Microsoft Edge Neural Voices.
- 🎵 **3-Stage CPU Voice Matching Pipeline**:
  1. **$O(N)$ Real-Time Pitch Detection**: Measures speaker fundamental frequency ($f_0$ in Hz) with zero CPU lag.
  2. **SSML Pitch & Speed Modulation**: Dynamically modulates target language pitch and speaking speed to match the speaker's vocal characteristics.
  3. **Web Audio Formant EQ Polish**: Applies acoustic low-shelf equalization for rich vocal warmth on playback.
- 📱 **Mobile-Optimized & Acoustic Echo Suppression**: Features hardware noise suppression, auto-gain control, and automatic mic pauses during speech playback to prevent repeating audio echo loops on mobile devices.
- 📚 **Custom Dictionaries**: Override translations with domain-specific terms (Legal, Medical, Tech, Gaming).
- 📜 **Session History & Export**: Record live transcripts and export full summaries in TXT or JSON format.
- 🎨 **3D Glassmorphism UI/UX**: Built with modern CSS design tokens, dynamic 3D cards, and floating responsive navigation.

---

## 🛠️ Tech Stack

### **Backend**
* **Framework**: Python 3.11+ / [FastAPI](https://fastapi.tiangolo.com/) (ASGI)
* **Real-Time Communication**: WebSockets (`websockets`)
* **Speech Synthesis (TTS)**: `edge-tts` (Microsoft Edge Neural Voices) with `gTTS` fallback
* **Translation**: `deep-translator`
* **Database**: SQLite via `aiosqlite`
* **Security & Auth**: PyJWT, bcrypt

### **Frontend**
* **Core**: Vanilla JavaScript (ES Modules, SPA Router, State Store)
* **Styling**: Vanilla CSS (3D Glassmorphism design system, CSS Variables)
* **Audio Engine**: Web Audio API (`AudioContext`, `AnalyserNode`, `BiquadFilterNode`)
* **Speech Recognition**: Web Speech API (`SpeechRecognition`)

---

## 📂 Project Structure

```text
TV/
├── engine/                   # Core business & audio processing logic
│   ├── audio-pipeline.js     # Client-side pitch detection & Web Audio pipeline
│   ├── database.py           # SQLite database initialization & connection
│   ├── session_manager.py    # Multi-participant WebSocket room router
│   ├── security.py           # JWT generation & bcrypt password hashing
│   └── translation.py        # Translation wrapper engine
├── routes/                   # API endpoint controllers
│   ├── user_routes.py        # Authentication & user profile routes
│   ├── session_routes.py     # Live room creation & join management
│   ├── websocket_routes.py   # WebSocket real-time audio/text stream
│   └── tts_routes.py         # Chunked streaming Neural TTS engine
├── static/                   # SPA Single Page Application assets
│   ├── css/                  # 3D Glassmorphism design system & components
│   ├── js/                   # Router, pages (Landing, Dashboard, Room, Settings)
│   └── index.html            # Main HTML entry point
├── config.py                 # Application configuration & language mappings
├── main.py                   # FastAPI server entry point
├── netlify.toml              # Netlify SPA deployment configuration
├── Procfile                  # Render / Railway startup command
└── requirements.txt          # Python library dependencies

import { store } from "../store.js";
import { navbar } from "../components/navbar.js";
import { AudioPipeline } from "../engine/audio-pipeline.js";
import { SpeechClient } from "../engine/speech-client.js";
import { WebSocketClient } from "../engine/ws-client.js";
import { AudioVisualizer } from "../components/audio-visualizer.js";

export class TranslationRoomPage {
  constructor() {
    this.audioPipeline = new AudioPipeline();
    this.speechClient = new SpeechClient();
    this.wsClient = null;
    this.visualizer = null;
    
    this.spokenLang = "en";
    this.listeningLang = "en";
    this.isMuted = false;
    this.startTime = Date.now();
    this.transcriptEntries = [];
  }

  render(sessionId) {
    const user = store.get("user");
    const session = store.get("session");
    const languages = store.get("languages") || [];
    
    if (!user) {
      setTimeout(() => window.location.hash = "#/", 0);
      return "";
    }

    const title = session ? session.title : "Live Session";
    const roomCode = session ? session.room_code : "------";

    return `
      ${navbar.render()}
      <main class="main-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <div>
            <span class="section-tag">Live Room</span>
            <h2 style="font-size: 2.2rem; font-weight: 800;">${title}</h2>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px;">
              <span class="fc3d-tag fc3d-tag--cyan" style="font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em;">
                Room Code: ${roomCode}
              </span>
              <span class="live-badge-pill">
                <span class="live-dot" aria-hidden="true"></span>
                Live Audio & Translation
              </span>
            </div>
          </div>
          
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="enable-audio-btn" class="btn btn-secondary" style="border-color: var(--accent-primary); color: var(--accent-secondary);">🔊 Enable Audio</button>
            <button id="mute-btn" class="btn btn-secondary">🎙️ Mute Mic</button>
            <button id="leave-btn" class="btn btn-secondary btn-danger">Leave Room</button>
          </div>
        </div>

        <div class="room-layout">
          <!-- Left: Captions, Speech Visualizer -->
          <div class="glass-card" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
            <div id="caption-container" class="caption-area" style="flex: 1; min-height: 280px; max-height: 480px;">
              <div style="color: var(--text-muted); text-align: center; margin-top: 100px; font-size: 0.95rem;">
                Waiting for participants to speak...
              </div>
            </div>

            <!-- Chat input fallback -->
            <div style="display: flex; gap: 10px; margin-top: 16px; border-top: 1px solid var(--border-glass); padding-top: 16px;">
              <input id="chat-text-input" type="text" class="form-input" placeholder="Type a message to translate... (Keyboard fallback)" style="flex: 1;" />
              <button id="send-chat-btn" class="btn btn-primary">Send</button>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-glass); padding-top: 16px; margin-top: 16px; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; gap: 14px; flex: 1; min-width: 280px; flex-wrap: wrap;">
                <div style="flex: 1;">
                  <label for="spoken-lang-select">Spoken Language</label>
                  <select id="spoken-lang-select" class="form-select">
                    ${languages.map(l => `<option value="${l.code}" ${l.code === this.spokenLang ? "selected" : ""}>${l.flag} ${l.name}</option>`).join("")}
                  </select>
                </div>
                
                <div style="flex: 1;">
                  <label for="listening-lang-select">Listening Language</label>
                  <select id="listening-lang-select" class="form-select">
                    ${languages.map(l => `<option value="${l.code}" ${l.code === this.listeningLang ? "selected" : ""}>${l.flag} ${l.name}</option>`).join("")}
                  </select>
                </div>
              </div>

              <div style="width: 110px; height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.1); border-radius: var(--radius-md); border: 1px solid var(--border-glass);">
                <canvas id="mic-visualizer" width="100" height="50"></canvas>
              </div>
            </div>
          </div>

          <!-- Right: Participants -->
          <div class="glass-card" style="height: 100%; display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-family: var(--font-family-heading); font-weight: 700;">Participants</h3>
            <div id="participants-list" class="participants-panel" style="flex: 1; overflow-y: auto;">
              <!-- Dynamic List -->
            </div>
          </div>
        </div>
      </main>
    `;
  }

  mounted(sessionId) {
    navbar.mounted();
    
    const user = store.get("user");
    if (!user) return;

    // 1. Setup Canvas Visualizer
    this.visualizer = new AudioVisualizer("mic-visualizer");
    this.visualizer.init();

    // 2. Establish WebSocket connection
    this.wsClient = new WebSocketClient(
      sessionId,
      user.id,
      user.display_name,
      this.spokenLang,
      this.listeningLang
    );

    // Event handlers
    this.wsClient.on("open", () => {
      // Start microphone stream
      this.audioPipeline.start((level) => {
        if (!this.isMuted) {
          this.visualizer.draw(level);
        }
      });
      
      // Start speech recognition
      this.speechClient.initialize(this.spokenLang, (transcript) => {
        if (!this.isMuted) {
          if (transcript.interim) {
            this.wsClient.sendSpeech(transcript.interim, false);
          }
          if (transcript.final) {
            this.wsClient.sendSpeech(transcript.final, true);
          }
        }
      });
      this.speechClient.start();
    });

    const captionContainer = document.getElementById("caption-container");

    this.wsClient.on("caption", (data) => {
      if (data.is_final) {
        // Append our own final speech block to our chat feed
        this._appendFinalCaption(data.speaker, data.text, data.text, this.spokenLang);
        
        // Save our own entry to local transcript array for history
        this.transcriptEntries.push({
          speaker: data.speaker,
          text: data.text,
          translation: data.text,
          language: this.spokenLang
        });
      } else {
        // Render transient or interim speech
        this._updateInterimCaption(data.speaker, data.text);
      }
    });

    this.wsClient.on("translation", (data) => {
      // Render final translated speech block
      this._appendFinalCaption(data.speaker, data.original, data.translated, data.target_lang);
      
      // Save entry to local transcript array for export history
      this.transcriptEntries.push({
        speaker: data.speaker,
        text: data.original,
        translation: data.translated,
        language: data.target_lang
      });
      
      // Trigger voice read-out if not our own speech
      if (data.speaker !== user.display_name) {
        this._speakText(data.translated, data.target_lang);
      }
    });

    this.wsClient.on("participant_joined", (data) => {
      this._addParticipantUI(data.participant.id, data.participant.display_name, data.participant.language);
    });

    this.wsClient.on("participant_left", (data) => {
      this._removeParticipantUI(data.participant_id);
    });

    this.wsClient.on("auth_success", (data) => {
      // Load initial participants
      const list = document.getElementById("participants-list");
      if (list) {
        list.innerHTML = "";
        data.participants.forEach(p => {
          this._addParticipantUI(p.id, p.display_name, p.language);
        });
      }
    });

    this.wsClient.connect();

    // 3. Bind UI interactions
    const muteBtn = document.getElementById("mute-btn");
    const leaveBtn = document.getElementById("leave-btn");
    const spokenSelect = document.getElementById("spoken-lang-select");
    const listeningSelect = document.getElementById("listening-lang-select");
    const chatInput = document.getElementById("chat-text-input");
    const sendChatBtn = document.getElementById("send-chat-btn");

    const sendTextMessage = () => {
      const text = chatInput.value.trim();
      if (text) {
        this.wsClient.sendSpeech(text, true);
        chatInput.value = "";
      }
    };

    if (sendChatBtn) {
      sendChatBtn.addEventListener("click", sendTextMessage);
    }
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          sendTextMessage();
        }
      });
    }

    const enableAudioBtn = document.getElementById("enable-audio-btn");
    if (enableAudioBtn) {
      enableAudioBtn.addEventListener("click", () => {
        // Play silent audio chunk to unlock browser autoplay restriction
        const dummyAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        dummyAudio.play().then(() => {
          enableAudioBtn.innerText = "🔊 Audio Unlocked";
          enableAudioBtn.style.borderColor = "#10b981";
          enableAudioBtn.style.color = "#10b981";
        }).catch(err => {
          console.warn("Audio unlock notice:", err);
        });
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        this.isMuted = !this.isMuted;
        muteBtn.innerText = this.isMuted ? "🔇 Unmute" : "🎙️ Mute";
        muteBtn.classList.toggle("speaking-pulse", !this.isMuted);
      });
    }

    if (leaveBtn) {
      leaveBtn.addEventListener("click", async () => {
        this.audioPipeline.stop();
        this.speechClient.stop();
        
        // Save transcript before leaving if there are entries
        if (this.transcriptEntries.length > 0 && !user.id.startsWith("guest_")) {
          const duration = Math.round((Date.now() - this.startTime) / 1000);
          try {
            await fetch("/api/recordings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: sessionId,
                user_id: user.id,
                title: store.get("session") ? store.get("session").title : "Live Conversation",
                duration_seconds: duration,
                transcript_entries: this.transcriptEntries
              })
            });
          } catch (err) {
            console.error("Failed to save transcript:", err);
          }
        }
        
        this.wsClient.disconnect();
        window.location.hash = "#/app";
      });
    }

    if (spokenSelect) {
      spokenSelect.addEventListener("change", (e) => {
        this.spokenLang = e.target.value;
        this.speechClient.updateLanguage(this.spokenLang);
        this.wsClient.changeLanguage(this.spokenLang, this.listeningLang);
      });
    }

    if (listeningSelect) {
      listeningSelect.addEventListener("change", (e) => {
        this.listeningLang = e.target.value;
        this.wsClient.changeLanguage(this.spokenLang, this.listeningLang);
      });
    }
  }

  _updateInterimCaption(speaker, text) {
    let interimDiv = document.getElementById("interim-caption-bubble");
    if (!interimDiv) {
      interimDiv = document.createElement("div");
      interimDiv.id = "interim-caption-bubble";
      interimDiv.className = "glass-card";
      interimDiv.style.opacity = "0.7";
      interimDiv.style.borderStyle = "dashed";
      document.getElementById("caption-container").appendChild(interimDiv);
    }
    interimDiv.innerHTML = `<strong>${speaker}:</strong> <span>${text}</span>`;
    
    const container = document.getElementById("caption-container");
    container.scrollTop = container.scrollHeight;
  }

  _appendFinalCaption(speaker, original, translated, langCode) {
    // Remove interim bubble if exists
    const interim = document.getElementById("interim-caption-bubble");
    if (interim) interim.remove();

    const container = document.getElementById("caption-container");
    
    // Clear initial label if present
    if (container.innerText.includes("Waiting for conversation")) {
      container.innerHTML = "";
    }

    const isSelf = this.wsClient && (speaker === this.wsClient.displayName);
    
    const card = document.createElement("div");
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = isSelf ? "flex-end" : "flex-start";
    card.style.marginBottom = "var(--space-md)";
    card.style.width = "100%";

    const bubble = document.createElement("div");
    bubble.className = "glass-card";
    bubble.style.maxWidth = "75%";
    bubble.style.padding = "var(--space-sm) var(--space-md)";
    bubble.style.borderRadius = isSelf ? "16px 16px 4px 16px" : "16px 16px 16px 4px";
    bubble.style.background = isSelf 
      ? "rgba(16, 185, 129, 0.15)"  // Emerald tinted glass
      : "rgba(255, 255, 255, 0.05)"; // Gray tinted glass
    bubble.style.border = isSelf
      ? "1px solid rgba(16, 185, 129, 0.3)"
      : "1px solid rgba(255, 255, 255, 0.1)";
    bubble.style.cursor = "pointer";

    bubble.innerHTML = `
      <div style="display: flex; justify-content: space-between; gap: var(--space-lg); margin-bottom: var(--space-xs); font-size: 0.8rem;">
        <strong style="color: ${isSelf ? "var(--accent-secondary)" : "var(--accent-primary)"};">${isSelf ? "You" : speaker}</strong>
        <span style="color: var(--text-muted); font-weight: 600;">${langCode.toUpperCase()}</span>
      </div>
      <p style="font-size: 1.05rem; margin: 0; line-height: 1.4; color: var(--text-primary); word-break: break-word;">${translated}</p>
    `;

    card.appendChild(bubble);
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  _speakText(text, langCode) {
    if (!text) return;
    const cleanLang = langCode.split("-")[0].toLowerCase();
    
    // 1. Play Server Neural TTS (Microsoft Edge Neural Voices)
    const playServerNeuralTTS = () => {
      try {
        const encodedText = encodeURIComponent(text);
        const ttsUrl = `/api/tts?text=${encodedText}&lang=${cleanLang}`;
        const audio = new Audio(ttsUrl);
        audio.play().catch(err => {
          console.warn("Server Neural TTS playback notice:", err.message || err);
          playNativeBrowserTTS();
        });
      } catch (e) {
        console.error("Server TTS Error:", e);
        playNativeBrowserTTS();
      }
    };

    // 2. Browser Native TTS Fallback
    const playNativeBrowserTTS = () => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const localeMap = {
        ru: "ru-RU", en: "en-US", es: "es-ES", zh: "zh-CN",
        fr: "fr-FR", de: "de-DE", hi: "hi-IN", ja: "ja-JP",
        ko: "ko-KR", ar: "ar-SA", it: "it-IT", pt: "pt-PT",
        tr: "tr-TR", vi: "vi-VN", nl: "nl-NL", pl: "pl-PL",
        sv: "sv-SE", no: "nb-NO", da: "da-DK", fi: "fi-FI"
      };
      const locale = localeMap[langCode] || langCode;
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(cleanLang) || v.lang.toLowerCase().includes(cleanLang));
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      if (matchingVoice) utterance.voice = matchingVoice;
      window.speechSynthesis.speak(utterance);
    };

    playServerNeuralTTS();
  }

  _addParticipantUI(id, displayName, language) {
    const list = document.getElementById("participants-list");
    if (!list) return;

    let pDiv = document.getElementById(`part-${id}`);
    if (!pDiv) {
      pDiv = document.createElement("div");
      pDiv.id = `part-${id}`;
      pDiv.className = "glass-card";
      pDiv.style.display = "flex";
      pDiv.style.alignItems = "center";
      pDiv.style.justifyContent = "space-between";
      pDiv.style.padding = "10px var(--space-md)";
      list.appendChild(pDiv);
    }

    pDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: #22c55e;"></div>
        <strong>${displayName}</strong>
      </div>
      <span style="font-size: 0.8rem; background: var(--border-glass); padding: 2px 6px; border-radius: 4px;">
        ${language.toUpperCase()}
      </span>
    `;
  }

  _removeParticipantUI(id) {
    const pDiv = document.getElementById(`part-${id}`);
    if (pDiv) pDiv.remove();
  }
}

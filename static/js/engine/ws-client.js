export class WebSocketClient {
  constructor(sessionId, participantId, displayName, spokenLang, listeningLang) {
    this.sessionId = sessionId;
    this.participantId = participantId;
    this.displayName = displayName;
    this.spokenLang = spokenLang;
    this.listeningLang = listeningLang;
    
    this.ws = null;
    this.callbacks = {};
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/session/${this.sessionId}?participant_id=${this.participantId}&display_name=${encodeURIComponent(this.displayName)}&spoken_lang=${this.spokenLang}&listening_lang=${this.listeningLang}`;
    
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("WebSocket connected to session:", this.sessionId);
      this._trigger("open", null);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this._trigger(message.type, message.payload);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      this._trigger("close", null);
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      this._trigger("error", err);
    };
  }

  on(type, callback) {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
  }

  _trigger(type, data) {
    if (this.callbacks[type]) {
      this.callbacks[type].forEach(cb => cb(data));
    }
  }

  sendSpeech(text, isFinal = true) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "speech",
        payload: {
          text: text,
          is_final: isFinal
        }
      }));
    }
  }

  changeLanguage(spokenLang, listeningLang) {
    this.spokenLang = spokenLang || this.spokenLang;
    this.listeningLang = listeningLang || this.listeningLang;
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "language_change",
        payload: {
          spoken_lang: this.spokenLang,
          listening_lang: this.listeningLang
        }
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

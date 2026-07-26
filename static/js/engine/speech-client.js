export class SpeechClient {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.lang = "en-US";
    this._restartTimer = null;
    this._isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this._errorRetryCount = 0;
    this._maxErrorRetries = 3; // Auto-recover up to 3 times before giving up
    this._micStream = null; // Pre-claimed mic stream: request permission once, reuse for session
    this._hardwareError = false; // Stop restart loop on permission/hardware errors
  }

  _getLocale(lang) {
    const localeMap = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
      it: "it-IT",
      pt: "pt-PT",
      ru: "ru-RU",
      ja: "ja-JP",
      ko: "ko-KR",
      zh: "zh-CN",
      hi: "hi-IN",
      ar: "ar-SA",
      tr: "tr-TR",
      vi: "vi-VN",
      nl: "nl-NL",
      pl: "pl-PL",
      sv: "sv-SE",
      no: "nb-NO",
      da: "da-DK",
      fi: "fi-FI"
    };
    return localeMap[lang] || lang;
  }

  /**
   * Pre-claim the microphone ONCE via getUserMedia. This makes the OS grant
   * permission a single time and keeps one long-lived audio session open, so
   * SpeechRecognition restarts do not re-prompt or replay the mobile
   * activation chime. Safe to call repeatedly — guarded by _micStream.
   */
  async _preclaimMic() {
    if (this._micStream) return; // Already claimed — request permission only once
    try {
      this._micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log("Mic stream pre-claimed for speech recognition");
    } catch (e) {
      console.warn("Could not pre-claim mic stream:", e.message);
      // Not fatal — SpeechRecognition may still work on some browsers
    }
  }

  initialize(lang, onResultCallback, onStatusCallback = null) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.onStatusCallback = onStatusCallback;
    
    if (!SpeechRecognition) {
      console.error("SpeechRecognition API not supported in this browser.");
      if (this.onStatusCallback) {
        const isHttps = window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        this.onStatusCallback(isHttps ? "unsupported" : "insecure_context");
      }
      return false;
    }

    this.lang = lang;
    this.onResultCallback = onResultCallback;
    this._errorRetryCount = 0;
    this._hardwareError = false;

    try {
      this.recognition = new SpeechRecognition();
      // Use continuous=true everywhere — the key to avoiding Android chimes is
      // NOT restarting recognition frequently. continuous=true keeps a single
      // long-lived mic session open, preventing repeated OS permission prompts.
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this._getLocale(this.lang);

      this.recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Reset error counter on successful result — mic is working
        this._errorRetryCount = 0;

        if (this.onResultCallback) {
          this.onResultCallback({
            interim: interimTranscript,
            final: finalTranscript
          });
        }
      };

      this.recognition.onstart = () => {
        if (this.onStatusCallback) {
          this.onStatusCallback("listening");
        }
      };

      this.recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          // Normal idle cycles on mobile/desktop — not a real error
        } else if (event.error === "network") {
          console.warn("Speech recognition network notice. Will retry...");
        } else if (event.error === "audio-capture" || event.error === "not-allowed") {
          console.error("Microphone access denied or unavailable:", event.error);
          this._hardwareError = true;
          this.isListening = false;
          if (this.onStatusCallback) {
            this.onStatusCallback("permission_denied");
          }
        } else {
          console.warn("Speech recognition notice:", event.error);
        }
      };

      this.recognition.onend = () => {
        // Do NOT restart if the user stopped, or a hardware/permission error
        // occurred (restarting would just loop the OS chime).
        if (!this.isListening || this._hardwareError) return;

        clearTimeout(this._restartTimer);

        // If we've hit max retries, don't restart
        if (this._errorRetryCount >= this._maxErrorRetries) return;

        // Exponential backoff on errors: 500ms → 1000ms → 2000ms
        // Normal restart (no errors): 500ms on mobile, 250ms on desktop
        let restartDelay;
        if (this._errorRetryCount > 0) {
          restartDelay = Math.min(500 * Math.pow(2, this._errorRetryCount), 4000);
        } else {
          restartDelay = this._isMobile ? 500 : 250;
        }

        this._restartTimer = setTimeout(() => {
          if (this.isListening && this.recognition && !this._hardwareError) {
            try {
              this.recognition.start();
            } catch (e) {
              console.warn("Recognition restart notice:", e.message);
            }
          }
        }, restartDelay);
      };

      return true;
    } catch (e) {
      console.error("Failed to initialize SpeechRecognition:", e);
      return false;
    }
  }

  async start() {
    if (!this.recognition || this.isListening) return;

    // On mobile, pre-claim the mic once so the OS asks for permission a single
    // time and keeps one long-lived audio session (no repeated chime).
    if (this._isMobile && !this._micStream) {
      await this._preclaimMic();
    }

    this.isListening = true;
    this._errorRetryCount = 0;
    this._hardwareError = false;
    try {
      this.recognition.start();
    } catch (e) {
      console.warn("Recognition start notice:", e.message);
    }
  }

  stop() {
    this.isListening = false;
    clearTimeout(this._restartTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }
  }

  /**
   * Release all resources (call on page leave / cleanup)
   */
  destroy() {
    this.stop();
    // Release the pre-claimed mic stream so the OS recording indicator clears.
    if (this._micStream) {
      this._micStream.getTracks().forEach(t => t.stop());
      this._micStream = null;
    }
    this.recognition = null;
  }

  updateLanguage(lang) {
    this.lang = lang;
    if (this.recognition) {
      const wasListening = this.isListening;
      this.stop();
      this.recognition.lang = this._getLocale(lang);
      if (wasListening) {
        setTimeout(() => this.start(), 300);
      }
    }
  }
}

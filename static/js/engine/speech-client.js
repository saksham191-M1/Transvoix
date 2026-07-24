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
  }

  _getLocale(lang) {
    const localeMap = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
      it: "it-IT",
      pt: "pt-PT",
      ja: "ja-JP",
      ko: "ko-KR",
      zh: "zh-CN",
      hi: "hi-IN",
      ar: "ar-SA",
      ru: "ru-RU",
      tr: "tr-TR",
      vi: "vi-VN",
      nl: "nl-NL",
      pl: "pl-PL",
      sv: "sv-SE",
      no: "no-NO",
      da: "da-DK",
      fi: "fi-FI"
    };
    return localeMap[lang] || lang;
  }

  initialize(lang, onResultCallback) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not supported in this browser.");
      return false;
    }

    this.lang = lang;
    this.onResultCallback = onResultCallback;
    this._errorRetryCount = 0;

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

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
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

      this.recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          // Normal idle cycles on mobile/desktop — not a real error
          // Will restart via onend handler
        } else if (event.error === "network") {
          console.warn("Speech recognition network notice. Will retry...");
        } else if (event.error === "audio-capture" || event.error === "not-allowed") {
          // Hardware or permission error — increment retry counter
          console.error("Microphone access issue:", event.error);
          this._errorRetryCount++;
          if (this._errorRetryCount >= this._maxErrorRetries) {
            console.error("Max mic retries reached. Speech recognition stopped. Refresh page to retry.");
            this.isListening = false;
          }
        } else {
          console.warn("Speech recognition notice:", event.error);
        }
      };

      this.recognition.onend = () => {
        if (!this.isListening) return;

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
          if (this.isListening && this.recognition) {
            try {
              this.recognition.start();
            } catch (e) {
              // Ignore InvalidStateError if already active
            }
          }
        }, restartDelay);
      };

      return true;
    } catch (err) {
      console.error("Failed to initialize SpeechRecognition:", err);
      return false;
    }
  }

  start() {
    if (!this.recognition || this.isListening) return;
    this.isListening = true;
    this._errorRetryCount = 0;
    try {
      this.recognition.start();
    } catch (e) {
      // Catch InvalidStateError if browser recognition engine is still cycling
    }
  }

  stop() {
    this.isListening = false;
    clearTimeout(this._restartTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Stop failed (already stopped)
      }
    }
  }

  /**
   * Release all resources (call on page leave / cleanup)
   */
  destroy() {
    this.stop();
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

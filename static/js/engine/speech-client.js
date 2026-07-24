export class SpeechClient {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.lang = "en-US";
    this._restartTimer = null;
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

    try {
      this.recognition = new SpeechRecognition();
      // Mobile Safari / Chrome Android optimization: continuous works best on desktop, set to true with fallback handling
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

        if (this.onResultCallback) {
          this.onResultCallback({
            interim: interimTranscript,
            final: finalTranscript
          });
        }
      };

      this.recognition.onerror = (event) => {
        if (event.error === "no-speech") {
          // Normal idle cycle on mobile
        } else if (event.error === "network") {
          console.warn("Speech recognition network notice. Retrying...");
        } else if (event.error === "audio-capture" || event.error === "not-allowed") {
          console.error("Microphone hardware access notice:", event.error);
          this.isListening = false;
        } else {
          console.warn("Speech recognition notice:", event.error);
        }
      };

      this.recognition.onend = () => {
        // Mobile clean restart with 300ms buffer to prevent hardware lock
        if (this.isListening) {
          clearTimeout(this._restartTimer);
          this._restartTimer = setTimeout(() => {
            if (this.isListening && this.recognition) {
              try {
                this.recognition.start();
              } catch (e) {
                // Ignore if already active
              }
            }
          }, 300);
        }
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

  updateLanguage(lang) {
    this.lang = lang;
    if (this.recognition) {
      const wasListening = this.isListening;
      this.stop();
      this.recognition.lang = this._getLocale(lang);
      if (wasListening) {
        setTimeout(() => this.start(), 200);
      }
    }
  }
}

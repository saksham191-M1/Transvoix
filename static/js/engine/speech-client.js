export class SpeechClient {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.lang = "en-US";
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

    this.recognition = new SpeechRecognition();
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
        console.log("No speech detected. Browser speech engine cycling...");
      } else if (event.error === "network") {
        console.warn("Speech recognition network glitch detected. Auto-reconnecting in 2s...");
        setTimeout(() => {
          if (this.isListening) {
            try { this.recognition.start(); } catch (e) {}
          }
        }, 2000);
      } else {
        console.error("Speech recognition error:", event.error);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if we are supposed to be listening
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          // Already running
        }
      }
    };

    return true;
  }

  start() {
    if (!this.recognition || this.isListening) return;
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (e) {
      console.error("Error starting speech recognition:", e);
    }
  }

  stop() {
    this.isListening = false;
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
        this.start();
      }
    }
  }
}

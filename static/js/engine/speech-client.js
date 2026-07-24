export class SpeechClient {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.lang = "en-US";
    this._restartTimer = null;
    this._isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this._micStream = null; // Pre-claimed mic stream to avoid repeated permission prompts
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

  /**
   * Pre-claim the microphone once on mobile to prevent Android OS from 
   * showing permission prompts on every SpeechRecognition.start() call.
   */
  async _preclaimMic() {
    if (this._micStream) return; // Already claimed
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

  initialize(lang, onResultCallback) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not supported in this browser.");
      return false;
    }

    this.lang = lang;
    this.onResultCallback = onResultCallback;
    this._hardwareError = false;

    try {
      this.recognition = new SpeechRecognition();
      
      // Mobile: continuous=false prevents Android from keeping mic hardware 
      // locked open, which causes the OS to play repeated activation chimes.
      // Desktop: continuous=true for seamless dictation.
      this.recognition.continuous = !this._isMobile;
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
          // Normal idle cycle — not an error, will restart via onend
        } else if (event.error === "aborted") {
          // User or system aborted — normal during navigation or mute
        } else if (event.error === "network") {
          console.warn("Speech recognition network notice. Will retry...");
        } else if (event.error === "audio-capture" || event.error === "not-allowed") {
          // CRITICAL: Hardware or permission error — STOP the restart loop entirely
          console.error("Microphone access denied or unavailable:", event.error);
          this._hardwareError = true;
          this.isListening = false;
        } else {
          console.warn("Speech recognition notice:", event.error);
        }
      };

      this.recognition.onend = () => {
        // Do NOT restart if:
        // 1. User explicitly stopped (isListening = false)
        // 2. Hardware/permission error occurred (would just loop chimes)
        if (!this.isListening || this._hardwareError) return;

        clearTimeout(this._restartTimer);

        // Mobile: 1500ms delay to let Android OS fully release mic hardware
        // and prevent rapid chime loop. Desktop: 300ms for responsiveness.
        const restartDelay = this._isMobile ? 1500 : 300;

        this._restartTimer = setTimeout(() => {
          if (this.isListening && this.recognition && !this._hardwareError) {
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

  async start() {
    if (!this.recognition || this.isListening) return;
    
    // On mobile, pre-claim mic once to prevent repeated OS permission prompts
    if (this._isMobile && !this._micStream) {
      await this._preclaimMic();
    }

    this.isListening = true;
    this._hardwareError = false;
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
   * Release the pre-claimed mic stream (call on page leave / cleanup)
   */
  destroy() {
    this.stop();
    if (this._micStream) {
      this._micStream.getTracks().forEach(t => t.stop());
      this._micStream = null;
    }
  }

  updateLanguage(lang) {
    this.lang = lang;
    if (this.recognition) {
      const wasListening = this.isListening;
      this.stop();
      this.recognition.lang = this._getLocale(lang);
      if (wasListening) {
        setTimeout(() => this.start(), 500);
      }
    }
  }
}

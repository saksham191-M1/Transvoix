export class AudioPipeline {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.source = null;
    this.isRecording = false;
    this.levelCallback = null;
  }

  async start(levelCallback) {
    if (this.isRecording) return;
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.source.connect(this.analyser);
      
      this.isRecording = true;
      this.levelCallback = levelCallback;
      this._pollAudioLevel();
    } catch (err) {
      console.error("Failed to start audio pipeline:", err);
      throw err;
    }
  }

  stop() {
    if (!this.isRecording) return;
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.isRecording = false;
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
  }

  _pollAudioLevel() {
    if (!this.isRecording || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Compute simple average level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    
    if (this.levelCallback) {
      this.levelCallback(average);
    }

    requestAnimationFrame(() => this._pollAudioLevel());
  }
}

export class AudioPipeline {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.source = null;
    this.isRecording = false;
    this.levelCallback = null;
    this.lastDetectedPitch = 0;
    this._lastPitchCalcTime = 0;
  }

  async start(levelCallback) {
    if (this.isRecording) return;
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true }
        },
        video: false
      });
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      
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

  // Hyper-optimized O(N) pitch estimator with 300ms throttling (0% CPU load)
  getDetectedPitchHz() {
    if (!this.analyser || !this.audioContext) return this.lastDetectedPitch;
    
    const now = Date.now();
    if (now - this._lastPitchCalcTime < 300) {
      return this.lastDetectedPitch;
    }
    this._lastPitchCalcTime = now;

    const buffer = new Float32Array(256);
    this.analyser.getFloatTimeDomainData(buffer);
    
    // Fast O(N) Zero-Crossing Rate calculation
    let crossings = [];
    let isPositive = buffer[0] > 0;
    for (let i = 1; i < buffer.length; i++) {
      const currentPositive = buffer[i] > 0;
      if (currentPositive !== isPositive) {
        if (currentPositive) crossings.push(i);
        isPositive = currentPositive;
      }
    }

    if (crossings.length < 2) return this.lastDetectedPitch;

    let totalDelta = 0;
    for (let i = 1; i < crossings.length; i++) {
      totalDelta += (crossings[i] - crossings[i - 1]);
    }
    const avgPeriod = totalDelta / (crossings.length - 1);
    if (avgPeriod <= 0) return this.lastDetectedPitch;

    const fundamentalFreq = this.audioContext.sampleRate / avgPeriod;
    if (fundamentalFreq >= 85 && fundamentalFreq <= 350) {
      this.lastDetectedPitch = Math.round(fundamentalFreq);
    }
    return this.lastDetectedPitch;
  }

  _pollAudioLevel() {
    if (!this.isRecording || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

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

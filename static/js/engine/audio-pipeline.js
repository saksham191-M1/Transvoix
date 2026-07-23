export class AudioPipeline {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.source = null;
    this.isRecording = false;
    this.levelCallback = null;
    this.lastDetectedPitch = 0;
  }

  async start(levelCallback) {
    if (this.isRecording) return;
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      
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

  getDetectedPitchHz() {
    if (!this.analyser || !this.audioContext) return 0;
    
    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    
    const sampleRate = this.audioContext.sampleRate;
    let SIZE = buffer.length;
    let r1 = 0, r2 = SIZE - 1, thres = 0.1;
    
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    const sliced = buffer.slice(r1, r2);
    SIZE = sliced.length;

    let c = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE - i; j++) {
        c[i] = c[i] + sliced[j] * sliced[j + i];
      }
    }

    let d = 0; 
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    
    const T0 = maxpos;
    if (T0 === -1 || T0 === 0) return this.lastDetectedPitch;
    
    const fundamentalFreq = sampleRate / T0;
    if (fundamentalFreq >= 75 && fundamentalFreq <= 400) {
      this.lastDetectedPitch = Math.round(fundamentalFreq);
      return this.lastDetectedPitch;
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

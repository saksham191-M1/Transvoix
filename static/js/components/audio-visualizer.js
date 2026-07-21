export class AudioVisualizer {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.canvas = null;
    this.ctx = null;
  }

  init() {
    this.canvas = document.getElementById(this.canvasId);
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.draw(0);
    }
  }

  draw(level) {
    if (!this.canvas || !this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    // Draw nice glowing center sphere that pulses with speech levels
    const radius = 20 + (level / 255) * 40;
    
    // Background glow
    const grad = this.ctx.createRadialGradient(width/2, height/2, 5, width/2, height/2, radius + 20);
    grad.addColorStop(0, "rgba(99, 102, 241, 0.6)");
    grad.addColorStop(0.5, "rgba(6, 182, 212, 0.3)");
    grad.addColorStop(1, "rgba(11, 13, 25, 0)");
    
    this.ctx.beginPath();
    this.ctx.arc(width/2, height/2, radius + 20, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Center active circle
    this.ctx.beginPath();
    this.ctx.arc(width/2, height/2, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = "rgba(99, 102, 241, 0.85)";
    this.ctx.strokeStyle = "#06b6d4";
    this.ctx.lineWidth = 3;
    this.ctx.stroke();
    this.ctx.fill();
  }
}

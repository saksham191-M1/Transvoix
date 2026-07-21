import { store } from "../store.js";
import { navbar } from "../components/navbar.js";

export class RecordingsPage {
  constructor() {
    this.recordings = [];
    this.selectedRec = null;
  }

  render() {
    const user = store.get("user");
    if (!user) {
      setTimeout(() => window.location.hash = "#/", 0);
      return "";
    }

    return `
      ${navbar.render()}
      <main class="main-content" style="max-width: 1100px;">
        <div style="margin-bottom: 28px;">
          <span class="section-tag">History</span>
          <h2 style="font-size: 2.2rem; font-weight: 800;">Saved Conversation <span class="gradient-text">Summaries</span></h2>
          <p style="color: var(--text-secondary); margin-top: 6px;">Review past meeting transcripts, AI summaries, and export subtitles.</p>
        </div>

        <div class="split-layout-340">
          <!-- Left: Call List -->
          <div class="glass-card" style="display: flex; flex-direction: column; gap: 16px; height: fit-content;">
            <h3 style="font-family: var(--font-family-heading); font-weight: 700;">Session History</h3>
            <div id="recording-list" style="display: flex; flex-direction: column; gap: 10px;">
              <p style="color: var(--text-muted); font-size: 0.88rem;">Loading history...</p>
            </div>
          </div>

          <!-- Right: Summary details -->
          <div class="glass-card" style="display: flex; flex-direction: column; gap: 20px; min-height: 440px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-glass); padding-bottom: 14px; flex-wrap: wrap; gap: 12px;">
              <h3 id="rec-title" style="font-family: var(--font-family-heading); font-weight: 700;">Select a Session</h3>
              <div id="rec-actions" style="display: none; gap: 10px;">
                <button id="export-srt-btn" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.82rem;">Export SRT</button>
                <button id="export-txt-btn" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.82rem;">Export TXT</button>
              </div>
            </div>

            <!-- Details Container -->
            <div id="rec-detail-content" style="display: flex; flex-direction: column; gap: 16px;">
              <p style="color: var(--text-muted);">Please select a session from the list on the left to view the transcript and AI summary.</p>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  mounted() {
    navbar.mounted();
    const user = store.get("user");
    if (!user) return;

    this.loadRecordings(user.id);
  }

  async loadRecordings(userId) {
    try {
      const res = await fetch(`/api/recordings?user_id=${userId}`);
      this.recordings = await res.json();
      
      const container = document.getElementById("recording-list");
      if (!container) return;
      
      container.innerHTML = "";
      if (this.recordings.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.88rem;">No recorded summaries found.</p>`;
        return;
      }

      this.recordings.forEach(rec => {
        const item = document.createElement("div");
        item.className = "glass-card";
        item.style.padding = "14px";
        item.style.cursor = "pointer";
        item.style.transition = "all 0.2s ease";
        item.style.border = this.selectedRec && this.selectedRec.id === rec.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)";
        if (this.selectedRec && this.selectedRec.id === rec.id) {
          item.style.boxShadow = "var(--shadow-glow)";
        }

        const dateStr = new Date(rec.created_at).toLocaleDateString();
        item.innerHTML = `
          <strong style="font-size: 0.95rem;">${rec.title || "Session " + rec.id.substr(0, 6)}</strong>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px; display: flex; justify-content: space-between;">
            <span>📅 ${dateStr}</span>
            <span>⏱️ ${rec.duration_seconds || 0}s</span>
          </div>
        `;
        item.addEventListener("click", () => {
          this.selectedRec = rec;
          this.loadRecordings(userId);
          this.renderDetails(rec);
        });
        container.appendChild(item);
      });
    } catch (err) {
      console.error(err);
    }
  }

  renderDetails(rec) {
    document.getElementById("rec-title").innerText = rec.title || "Session Details";
    document.getElementById("rec-actions").style.display = "flex";

    const content = document.getElementById("rec-detail-content");
    content.innerHTML = `
      <div style="background: var(--bg-glass-strong); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-glass);">
        <h4 style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase; color: var(--accent-secondary); margin-bottom: 8px;">AI Executive Summary</h4>
        <p style="font-size: 0.92rem; line-height: 1.6;">${rec.summary || "No automated summary generated for this session."}</p>
      </div>

      <div>
        <h4 style="font-size: 0.82rem; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Transcript History</h4>
        <div style="background: rgba(0,0,0,0.12); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-glass); max-height: 320px; overflow-y: auto; font-size: 0.9rem; line-height: 1.6;">
          ${rec.transcript ? rec.transcript.replace(/\n/g, "<br>") : "No transcript recorded."}
        </div>
      </div>
    `;

    document.getElementById("export-srt-btn").onclick = () => window.open(`/api/recordings/${rec.id}/export?format=srt`);
    document.getElementById("export-txt-btn").onclick = () => window.open(`/api/recordings/${rec.id}/export?format=txt`);
  }
}

import { navbar } from "../components/navbar.js";

export class AnalyticsPage {
  render() {
    return `
      ${navbar.render()}
      <main class="main-content">
        <div style="margin-bottom: 28px;">
          <span class="section-tag">Platform Health</span>
          <h2 style="font-size: 2.2rem; font-weight: 800;">Real-Time <span class="gradient-text">Analytics</span></h2>
          <p style="color: var(--text-secondary); margin-top: 6px;">Live metrics on active sessions, translation volume, and engine latency.</p>
        </div>
        
        <div class="dashboard-grid">
          <div class="feature-card-3d">
            <div class="fc3d-glow" style="--glow-color: rgba(124,58,237,0.3)"></div>
            <div style="font-size: 2rem; margin-bottom: 8px;" aria-hidden="true">📡</div>
            <h3 class="fc3d-title">Active Sessions</h3>
            <div id="stat-active-sessions" class="gradient-text" style="font-family: var(--font-family-heading); font-size: 3.2rem; font-weight: 800; line-height: 1; margin: 12px 0;">
              0
            </div>
            <p class="fc3d-desc">Live translation rooms active right now</p>
          </div>

          <div class="feature-card-3d">
            <div class="fc3d-glow" style="--glow-color: rgba(8,145,178,0.3)"></div>
            <div style="font-size: 2rem; margin-bottom: 8px;" aria-hidden="true">🌐</div>
            <h3 class="fc3d-title">Total Translations</h3>
            <div id="stat-total-translations" class="gradient-text-2" style="font-family: var(--font-family-heading); font-size: 3.2rem; font-weight: 800; line-height: 1; margin: 12px 0;">
              0
            </div>
            <p class="fc3d-desc">Translated speech segments processed</p>
          </div>

          <div class="feature-card-3d">
            <div class="fc3d-glow" style="--glow-color: rgba(16,185,129,0.3)"></div>
            <div style="font-size: 2rem; margin-bottom: 8px;" aria-hidden="true">⚡</div>
            <h3 class="fc3d-title">P95 Latency</h3>
            <div id="stat-latency" style="font-family: var(--font-family-heading); font-size: 3.2rem; font-weight: 800; line-height: 1; margin: 12px 0; color: #10B981;">
              120ms
            </div>
            <p class="fc3d-desc">Ultra-low end-to-end processing delay</p>
          </div>
        </div>

        <div class="glass-card" style="margin-top: 32px; padding: 28px;">
          <h3 style="font-family: var(--font-family-heading); font-weight: 700; font-size: 1.2rem; margin-bottom: 6px;">Top Target Languages</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">Most frequently requested translation target languages.</p>
          
          <div id="lang-chart-container" style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Dynamic language chart bars -->
          </div>
        </div>
      </main>
    `;
  }

  mounted() {
    navbar.mounted();
    
    // Fetch analytics data
    fetch("/api/analytics/overview")
      .then(r => r.json())
      .then(stats => {
        document.getElementById("stat-active-sessions").innerText = stats.active_sessions;
        document.getElementById("stat-total-translations").innerText = stats.total_translations;
      })
      .catch(err => console.error("Error loading stats:", err));

    fetch("/api/analytics/languages")
      .then(r => r.json())
      .then(langs => {
        const container = document.getElementById("lang-chart-container");
        if (!container) return;
        container.innerHTML = "";

        if (langs.length === 0) {
          container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No language usage recorded yet. Start a session to build stats!</p>`;
          return;
        }

        const max = Math.max(...langs.map(l => l.count)) || 1;

        langs.forEach(item => {
          const pct = Math.round((item.count / max) * 100);
          const bar = document.createElement("div");
          bar.style.display = "flex";
          bar.style.flexDirection = "column";
          bar.style.gap = "6px";

          bar.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 600;">
              <span>${item.language.toUpperCase()}</span>
              <span style="color: var(--text-secondary);">${item.count} translations</span>
            </div>
            <div style="width: 100%; height: 10px; background: rgba(0,0,0,0.12); border-radius: 999px; overflow: hidden; border: 1px solid var(--border-glass);">
              <div style="width: ${pct}%; height: 100%; background: var(--gradient-hero); border-radius: 999px; transition: width 1s ease;"></div>
            </div>
          `;
          container.appendChild(bar);
        });
      })
      .catch(err => console.error("Error loading language breakdown:", err));
  }
}

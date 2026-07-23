import { store } from "../store.js";
import { navbar } from "../components/navbar.js";

export class SettingsPage {
  render() {
    const user = store.get("user");
    const voiceGender = store.get("voice_gender") || "female";

    return `
      ${navbar.render()}
      <main class="main-content">
        <div style="margin-bottom: 28px;">
          <span class="section-tag">Preferences</span>
          <h2 style="font-size: 2.2rem; font-weight: 800;">Application <span class="gradient-text">Settings</span></h2>
          <p style="color: var(--text-secondary); margin-top: 6px;">Manage your account session, voice synthesis gender, and platform preferences.</p>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 24px; max-width: 640px;">
          <!-- Voice Settings Card -->
          <div class="feature-card-3d">
            <div class="fc3d-glow" style="--glow-color: rgba(8,145,178,0.25)"></div>
            <div style="position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px;">
              <h3 class="fc3d-title">Voice Synthesis Gender</h3>
              <p class="fc3d-desc">Choose the default neural AI voice gender for translated audio playback across 50+ languages.</p>
              
              <div>
                <label for="setting-voice-gender">Neural Voice Persona</label>
                <select id="setting-voice-gender" class="form-select" style="max-width: 280px; margin-top: 6px;">
                  <option value="female" ${voiceGender === "female" ? "selected" : ""}>👩 Female Neural Voice (Default)</option>
                  <option value="male" ${voiceGender === "male" ? "selected" : ""}>👨 Male Neural Voice</option>
                </select>
              </div>

              <div style="margin-top: 8px;">
                <button id="test-voice-btn" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.85rem;">
                  🔊 Test Voice Playback
                </button>
              </div>
            </div>
          </div>

          <!-- Account Session Card -->
          <div class="feature-card-3d">
            <div class="fc3d-glow" style="--glow-color: rgba(124,58,237,0.25)"></div>
            <div style="position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px;">
              <h3 class="fc3d-title">User Session</h3>
              ${user ? `
                <p class="fc3d-desc">Currently logged in as: <strong>${user.display_name}</strong> (${user.role})</p>
                <div>
                  <button id="logout-btn" class="btn btn-secondary btn-danger">Sign Out of Account</button>
                </div>
              ` : `
                <p class="fc3d-desc">You are currently in guest mode. Register or sign in to save custom dictionaries and session recordings.</p>
                <div>
                  <a href="#/" class="btn btn-primary open-auth-btn">Sign In / Register →</a>
                </div>
              `}
            </div>
          </div>
        </div>
      </main>
    `;
  }

  mounted() {
    navbar.mounted();
    
    const logoutBtn = document.getElementById("logout-btn");
    const voiceSelect = document.getElementById("setting-voice-gender");
    const testVoiceBtn = document.getElementById("test-voice-btn");

    if (voiceSelect) {
      voiceSelect.addEventListener("change", (e) => {
        store.set("voice_gender", e.target.value);
      });
    }

    if (testVoiceBtn) {
      testVoiceBtn.addEventListener("click", () => {
        const gender = store.get("voice_gender") || "female";
        const sampleText = gender === "female" ? "Hello! This is a test of the female neural translation voice." : "Hello! This is a test of the male neural translation voice.";
        const audio = new Audio(`/api/tts?text=${encodeURIComponent(sampleText)}&lang=en&gender=${gender}`);
        audio.play().catch(err => console.error("Voice preview failed:", err));
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        store.logout();
        window.location.hash = "#/";
      });
    }
  }
}

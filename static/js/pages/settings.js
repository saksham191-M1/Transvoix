import { store } from "../store.js";
import { navbar } from "../components/navbar.js";

export class SettingsPage {
  render() {
    const user = store.get("user");

    return `
      ${navbar.render()}
      <main class="main-content">
        <div style="margin-bottom: 28px;">
          <span class="section-tag">Account</span>
          <h2 style="font-size: 2.2rem; font-weight: 800;">Application <span class="gradient-text">Settings</span></h2>
          <p style="color: var(--text-secondary); margin-top: 6px;">Manage your account session and user access preferences.</p>
        </div>
        
        <div class="feature-card-3d" style="max-width: 640px;">
          <div class="fc3d-glow" style="--glow-color: rgba(124,58,237,0.25)"></div>

          <div style="position: relative; z-index: 1; display: flex; flex-direction: column; gap: 20px;">
            <h3 class="fc3d-title">User Session</h3>
            ${user ? `
              <p class="fc3d-desc" style="margin-bottom: 16px;">Currently logged in as: <strong>${user.display_name}</strong> (${user.role})</p>
              <div>
                <button id="logout-btn" class="btn btn-secondary btn-danger">Sign Out of Account</button>
              </div>
            ` : `
              <p class="fc3d-desc" style="margin-bottom: 16px;">You are currently in guest mode. Register or sign in to save custom dictionaries and session recordings.</p>
              <div>
                <a href="#/" class="btn btn-primary open-auth-btn">Sign In / Register →</a>
              </div>
            `}
          </div>
        </div>
      </main>
    `;
  }

  mounted() {
    navbar.mounted();
    
    const logoutBtn = document.getElementById("logout-btn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        store.logout();
        window.location.hash = "#/";
      });
    }
  }
}

import { store } from "../store.js";
import { navbar } from "../components/navbar.js";

export class DashboardPage {
  render() {
    const user = store.get("user");
    if (!user) {
      setTimeout(() => window.location.hash = "#/", 0);
      return "";
    }

    return `
      ${navbar.render()}
      <main class="main-content">
        <div style="margin-bottom: 28px;">
          <span class="section-tag">Dashboard</span>
          <h2 style="font-size: 2.2rem; font-weight: 800;">Welcome back, <span class="gradient-text">${user.display_name}</span></h2>
          <p style="color: var(--text-secondary); margin-top: 6px;">Manage your real-time translation sessions or start a new live room.</p>
        </div>
        
        <div class="dashboard-grid">
          <!-- Create Room -->
          <div class="feature-card-3d">
            <div class="fc3d-glow" style="--glow-color: rgba(124,58,237,0.3)"></div>
            <div style="font-size: 2rem; margin-bottom: 12px;" aria-hidden="true">🚀</div>
            <h3 class="fc3d-title">Create a Session</h3>
            <p class="fc3d-desc">Start a new real-time AI translation session and invite participants with a room code.</p>
            
            <form id="create-session-form" style="display: flex; flex-direction: column; gap: 16px; margin-top: 20px; position: relative; z-index: 1;">
              <div>
                <label for="session-title">Session Title</label>
                <input id="session-title" type="text" class="form-input" placeholder="e.g., Global Team Sync" required />
              </div>
              
              <button type="submit" class="btn btn-primary" style="width: 100%;">Start Live Session →</button>
            </form>
          </div>

          <!-- Join Room -->
          <div class="feature-card-3d">
            <div class="fc3d-glow" style="--glow-color: rgba(8,145,178,0.3)"></div>
            <div style="font-size: 2rem; margin-bottom: 12px;" aria-hidden="true">🔑</div>
            <h3 class="fc3d-title">Join a Session</h3>
            <p class="fc3d-desc">Enter a 6-digit room code to join an active live conversation with real-time translation.</p>
            
            <form id="join-session-form" style="display: flex; flex-direction: column; gap: 16px; margin-top: 20px; position: relative; z-index: 1;">
              <div>
                <label for="join-room-code">Room Code</label>
                <input id="join-room-code" type="text" class="form-input" placeholder="e.g. AB12CD" required maxlength="6" style="text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em;" />
              </div>
              
              <button type="submit" class="btn btn-secondary" style="width: 100%;">Join Room →</button>
            </form>
          </div>
        </div>
      </main>
    `;
  }

  mounted() {
    navbar.mounted();

    const createForm = document.getElementById("create-session-form");
    const joinForm = document.getElementById("join-session-form");

    if (createForm) {
      createForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("session-title").value;
        
        try {
          const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title })
          });
          
          if (!res.ok) throw new Error("Failed to create session");
          const session = await res.json();
          
          store.set("session", session);
          window.location.hash = `#/room/${session.session_id}`;
        } catch (err) {
          alert(err.message);
        }
      });
    }

    if (joinForm) {
      joinForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = document.getElementById("join-room-code").value.toUpperCase();
        
        try {
          const res = await fetch(`/api/sessions/${code}`);
          if (!res.ok) throw new Error("Invalid or inactive room code");
          const session = await res.json();
          
          store.set("session", session);
          window.location.hash = `#/room/${session.session_id}`;
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }
}

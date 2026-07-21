import { store } from "../store.js";

const sunIcon = `
  <svg viewBox="0 0 24 24" role="img" focusable="false">
    <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m14.95-6.95 1.41-1.41M3.64 20.36l1.41-1.41m0-13.9L3.64 3.64m16.72 16.72-1.41-1.41" />
    <circle cx="12" cy="12" r="4" />
  </svg>
`;

const moonIcon = `
  <svg viewBox="0 0 24 24" role="img" focusable="false">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" />
  </svg>
`;

const themeIcon = (theme) => (theme === "dark" ? sunIcon : moonIcon);

export class Navbar {
  constructor() {
    this._scrollListener = null;
  }

  render() {
    const theme = store.get("theme");
    const user = store.get("user");
    const hash = window.location.hash || "#/";

    const isActive = (path) => {
      if (path === "#/") {
        return (hash === "#/" || hash === "" || hash === "#") ? "active" : "";
      }
      return hash.startsWith(path) ? "active" : "";
    };

    return `
      <header class="site-navbar">
        <div class="brand-mark" onclick="window.location.hash = '#/'">
          <img src="/static/favicon.svg" alt="TransVoix Logo" />
          <h1>TransVoix</h1>
        </div>

        <nav class="site-nav" aria-label="Primary navigation">
          <a href="#/" class="nav-link ${isActive('#/')}">Home</a>
          ${user ? `<a href="#/app" class="nav-link ${isActive('#/app')}">Dashboard</a>` : ""}
          ${user ? `<a href="#/dictionary" class="nav-link ${isActive('#/dictionary')}">Dictionaries</a>` : ""}
          ${user ? `<a href="#/recordings" class="nav-link ${isActive('#/recordings')}">Summaries</a>` : ""}
          ${user ? `<a href="#/analytics" class="nav-link ${isActive('#/analytics')}">Analytics</a>` : ""}
          <a href="#/settings" class="nav-link ${isActive('#/settings')}">Settings</a>

          <button id="theme-toggle-btn" class="theme-toggle-btn" type="button" aria-label="Toggle color theme">
            ${themeIcon(theme)}
          </button>
        </nav>
      </header>
    `;
  }

  mounted() {
    // 1. Theme toggle
    const toggle = document.getElementById("theme-toggle-btn");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = store.get("theme");
        const next = current === "dark" ? "light" : "dark";
        store.set("theme", next);
        toggle.innerHTML = themeIcon(next);
      });
    }

    // 2. Smart Auto-Hiding Navbar (YouTube style)
    const header = document.querySelector(".site-navbar");
    if (header) {
      // Ensure visible when page mounts
      header.classList.remove("nav-hidden");

      let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

      const onScroll = () => {
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        const diff = currentScrollY - lastScrollY;

        if (currentScrollY > 40 && diff > 2) {
          // Scrolling down past 40px -> hide navbar
          header.classList.add("nav-hidden");
        } else if (diff < -2 || currentScrollY <= 20) {
          // Scrolling up or near top -> show navbar
          header.classList.remove("nav-hidden");
        }

        lastScrollY = currentScrollY;
      };

      if (this._scrollListener) {
        window.removeEventListener("scroll", this._scrollListener);
      }

      this._scrollListener = onScroll;
      window.addEventListener("scroll", this._scrollListener, { passive: true });
    }
  }
}

export const navbar = new Navbar();

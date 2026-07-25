import { Router } from "./router.js";
import { store } from "./store.js";
import { LenisEngine } from "./engine/lenis-smooth-scroll.js";

// Lazy loading views
const routes = {
  "/": async () => {
    const mod = await import("./pages/landing.js");
    return new mod.LandingPage();
  },
  "/app": async () => {
    const mod = await import("./pages/dashboard.js");
    return new mod.DashboardPage();
  },
  "/room": async () => {
    const mod = await import("./pages/translation-room.js");
    return new mod.TranslationRoomPage();
  },
  "/settings": async () => {
    const mod = await import("./pages/settings.js");
    return new mod.SettingsPage();
  },
  "/analytics": async () => {
    const mod = await import("./pages/analytics.js");
    return new mod.AnalyticsPage();
  },
  "/dictionary": async () => {
    const mod = await import("./pages/dictionary.js");
    return new mod.DictionaryPage();
  },
  "/recordings": async () => {
    const mod = await import("./pages/recordings.js");
    return new mod.RecordingsPage();
  }
};

// Global Auto-Hiding Navbar Scroll Controller (YouTube style with Lenis support)
function initNavbarScrollController() {
  let lastScrollY = 0;

  const handleScroll = (currentScrollY, velocity = 0, direction = 0) => {
    const navbarEl = document.querySelector(".site-navbar");
    if (!navbarEl) return;

    if (direction === 1 && currentScrollY > 50 && (velocity > 0.5 || currentScrollY - lastScrollY > 5)) {
      // Scrolling down past 50px -> hide navbar
      navbarEl.classList.add("nav-hidden");
    } else if (direction === -1 || currentScrollY <= 20) {
      // Scrolling up or near top -> show navbar
      navbarEl.classList.remove("nav-hidden");
    }

    lastScrollY = currentScrollY;
  };

  // Subscribe to Lenis smooth scroll events
  LenisEngine.onScroll(({ scroll, velocity, direction }) => {
    handleScroll(scroll, Math.abs(velocity), direction);
  });

  // Native fallback listener
  window.addEventListener("scroll", () => {
    if (!LenisEngine.isInitialized) {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const diff = currentScrollY - lastScrollY;
      const dir = diff > 0 ? 1 : (diff < 0 ? -1 : 0);
      handleScroll(currentScrollY, Math.abs(diff), dir);
    }
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lenis Smooth Scroll Engine
  LenisEngine.init();

  // Initialize Router
  const router = new Router(routes, "app-viewport");
  router.init();

  // Initialize Global Navbar Scroll Handler
  initNavbarScrollController();

  // Load supported languages list on start
  fetch("/api/languages")
    .then(r => r.json())
    .then(langs => {
      store.set("languages", langs);
    })
    .catch(err => console.error("Failed to load languages:", err));
});


import { Router } from "./router.js";
import { store } from "./store.js";

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

// Global Auto-Hiding Navbar Scroll Controller (YouTube style)
function initNavbarScrollController() {
  let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

  window.addEventListener("scroll", () => {
    const navbarEl = document.querySelector(".site-navbar");
    if (!navbarEl) return;

    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const diff = currentScrollY - lastScrollY;

    if (currentScrollY > 40 && diff > 2) {
      // Scrolling down past 40px -> hide navbar
      navbarEl.classList.add("nav-hidden");
    } else if (diff < -2 || currentScrollY <= 20) {
      // Scrolling up or near top -> show navbar
      navbarEl.classList.remove("nav-hidden");
    }

    lastScrollY = currentScrollY;
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
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

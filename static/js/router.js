import { LenisEngine } from "./engine/lenis-smooth-scroll.js";

const EXIT_DURATION = 280;  // ms — matches page-exit-fade CSS
const ENTER_DURATION = 500; // ms — matches longest stagger child animation

export class Router {
  constructor(routes, containerId) {
    this.routes = routes;
    this.container = document.getElementById(containerId);
    this.currentPage = null;
    this._isTransitioning = false;
    this._isFirstLoad = true;
    window.addEventListener("hashchange", () => this.route());
  }

  init() {
    this.route();
  }

  navigate(path) {
    window.location.hash = path;
  }

  async route() {
    // Prevent overlapping transitions
    if (this._isTransitioning) return;

    let hash = window.location.hash || "#/";
    if (!hash.startsWith("#/")) hash = "#/";

    const parts = hash.split("/").filter(Boolean);
    let route = "/" + (parts[1] || "");
    let param = parts[2] || null;

    const pageHandler = this.routes[route] || this.routes["/"];
    if (!pageHandler) return;

    this._isTransitioning = true;

    try {
      // ── Phase 1: EXIT (skip on first page load) ──────────────
      if (!this._isFirstLoad && this.container.children.length > 0) {
        this.container.classList.add("page-exiting");

        await new Promise(resolve => setTimeout(resolve, EXIT_DURATION));

        this.container.classList.remove("page-exiting");
      }
      this._isFirstLoad = false;

      // ── Phase 2: UNMOUNT old page ────────────────────────────
      if (this.currentPage && typeof this.currentPage.unmount === "function") {
        try { this.currentPage.unmount(); } catch (e) { console.warn("Page unmount:", e); }
      }

      // ── Phase 3: MOUNT new page ──────────────────────────────
      const pageInstance = await pageHandler();
      this.currentPage = pageInstance;
      this.container.innerHTML = "";

      const dom = pageInstance.render(param);
      if (dom instanceof HTMLElement) {
        this.container.appendChild(dom);
      } else {
        this.container.innerHTML = dom;
      }

      // Scroll to top instantly before the enter animation starts
      LenisEngine.scrollToTop(true);

      // ── Phase 4: ENTER animation ─────────────────────────────
      this.container.classList.add("page-entering");

      // Bind event triggers while animation plays (non-blocking)
      if (pageInstance.mounted) {
        pageInstance.mounted(param);
      }

      // Recalculate Lenis scroll bounds
      setTimeout(() => LenisEngine.resize(), 100);

      // Clean up entering state after animations finish
      setTimeout(() => {
        this.container.classList.remove("page-entering");
      }, ENTER_DURATION);

    } catch (err) {
      console.error("Routing error:", err);
      this.container.classList.remove("page-exiting", "page-entering");
      this.container.innerHTML = `<div class="glass-card"><h2>Error Loading Page</h2><p>${err.message}</p></div>`;
    } finally {
      // Unlock transitions after enter completes
      setTimeout(() => {
        this._isTransitioning = false;
      }, ENTER_DURATION);
    }
  }
}


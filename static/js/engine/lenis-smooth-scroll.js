/* ============================================================
   TRANSVOIX LENIS SMOOTH SCROLL ENGINE
   Ultra-Smooth Inertia & GSAP ScrollTrigger Integration
   Powered by Lenis (Darkroom Engineering)
============================================================ */

class LenisSmoothScrollEngine {
  constructor() {
    this.lenis = null;
    this.isInitialized = false;
    this.scrollListeners = [];
  }

  init() {
    if (this.isInitialized) return;

    // Check if Lenis library is loaded via CDN or window global
    if (typeof window.Lenis === "undefined") {
      console.warn("[LenisEngine] Lenis library not found. Falling back to native scrolling.");
      return;
    }

    try {
      // Initialize Lenis with high-performance parameters
      this.lenis = new window.Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.5,
        smoothTouch: false, // Maintain native mobile touch physics
        autoResize: true,
      });

      this.isInitialized = true;
      document.documentElement.classList.add("lenis-active");

      // Synchronize with GSAP ScrollTrigger if available
      if (typeof window.gsap !== "undefined") {
        if (typeof window.ScrollTrigger !== "undefined") {
          this.lenis.on("scroll", () => window.ScrollTrigger.update());
        }

        window.gsap.ticker.add((time) => {
          if (this.lenis) {
            this.lenis.raf(time * 1000);
          }
        });

        window.gsap.ticker.lagSmoothing(0);
      } else {
        // Fallback requestAnimationFrame loop
        const updateRaf = (time) => {
          if (this.lenis) {
            this.lenis.raf(time);
            requestAnimationFrame(updateRaf);
          }
        };
        requestAnimationFrame(updateRaf);
      }

      // Relay Lenis scroll events to custom listeners
      this.lenis.on("scroll", (e) => {
        this.scrollListeners.forEach((fn) => {
          try {
            fn(e);
          } catch (err) {
            console.error("[LenisEngine] Scroll listener error:", err);
          }
        });
      });

      // Bind global smooth scroll for anchor links (e.g. href="#features")
      this._bindAnchorClickHandlers();

      console.log("[LenisEngine] Successfully initialized smooth scrolling.");
    } catch (err) {
      console.error("[LenisEngine] Failed to initialize Lenis:", err);
    }
  }

  // Binds click listener to automatically smooth-scroll to anchor IDs
  _bindAnchorClickHandlers() {
    document.addEventListener("click", (e) => {
      const anchor = e.target.closest("a[href^='#']");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href === "#" || href.startsWith("#/")) return; // Skip SPA router hash links

      const targetEl = document.querySelector(href);
      if (targetEl) {
        e.preventDefault();
        this.scrollTo(targetEl, { offset: -60, duration: 1.4 });
      }
    });
  }

  // Subscribe to Lenis scroll events (returns unsubscribe function)
  onScroll(callback) {
    if (typeof callback === "function") {
      this.scrollListeners.push(callback);
      return () => {
        this.scrollListeners = this.scrollListeners.filter((fn) => fn !== callback);
      };
    }
    return () => {};
  }

  // Programmatic smooth scroll to element or pixel offset
  scrollTo(target, options = {}) {
    if (this.lenis && this.isInitialized) {
      this.lenis.scrollTo(target, options);
    } else {
      const offsetTop = typeof target === "number"
        ? target
        : (target instanceof HTMLElement ? target.offsetTop : 0);
      window.scrollTo({ top: offsetTop, behavior: "smooth" });
    }
  }

  // Scroll to top (useful for SPA navigation)
  scrollToTop(immediate = false) {
    if (this.lenis && this.isInitialized) {
      this.lenis.scrollTo(0, { immediate });
    } else {
      window.scrollTo({ top: 0, behavior: immediate ? "auto" : "smooth" });
    }
  }

  // Pause smooth scrolling (e.g. when modal opens)
  stop() {
    if (this.lenis) this.lenis.stop();
  }

  // Resume smooth scrolling (e.g. when modal closes)
  start() {
    if (this.lenis) this.lenis.start();
  }

  // Recalculate dimensions on dynamic DOM updates
  resize() {
    if (this.lenis) this.lenis.resize();
  }

  // Clean up instance if needed
  destroy() {
    if (this.lenis) {
      this.lenis.destroy();
      this.lenis = null;
      this.isInitialized = false;
      document.documentElement.classList.remove("lenis-active");
    }
  }
}

export const LenisEngine = new LenisSmoothScrollEngine();

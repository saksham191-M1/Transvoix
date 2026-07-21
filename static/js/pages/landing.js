import { store } from "../store.js";
import { navbar } from "../components/navbar.js";

/* ============================================================
   TRANSVOIX LANDING PAGE — Ultra 3D Edition
   Design Intelligence: UI UX Pro Max Skill
   Fonts: Space Grotesk + DM Sans
   Colors: AI/Chatbot Platform palette (violet + cyan)
   Animations: GSAP ScrollTrigger + CSS 3D transforms
============================================================ */

// ─── Star Field (3D Warp-Speed Particle System) ────────────
class StarField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.stars = [];
    this.numStars = 260;
    this.speed = 1.4;
    this.focalLength = 320;
    this.running = false;
    this.mouse = { x: 0, y: 0 };
    this._onResize = () => this.resize();
    this._onMouse = (e) => {
      this.mouse.x = (e.clientX / window.innerWidth - 0.5) * 0.4;
      this.mouse.y = (e.clientY / window.innerHeight - 0.5) * 0.4;
    };
    window.addEventListener("resize", this._onResize);
    window.addEventListener("mousemove", this._onMouse);
    this.resize();
    this.init();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
  }

  createStar(initialZ = null) {
    const isLight = store.get("theme") === "light";
    const colors = isLight
      ? ["#7C3AED", "#0284C7", "#DB2777", "#6D28D9", "#0369A1"]
      : ["#A78BFA", "#38BDF8", "#EC4899", "#ffffff", "#7C3AED"];
    return {
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 2000,
      z: initialZ ?? Math.random() * 1000,
      pz: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 1.5 + 0.3,
    };
  }

  init() {
    this.stars = Array.from({ length: this.numStars }, () => this.createStar());
  }

  draw() {
    const { ctx, canvas, cx, cy, focalLength } = this;
    const isLight = store.get("theme") === "light";
    ctx.fillStyle = isLight ? "rgba(248, 250, 252, 0.28)" : "rgba(5, 0, 16, 0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mx = cx + this.mouse.x * 60;
    const my = cy + this.mouse.y * 60;

    for (const star of this.stars) {
      star.pz = star.z;
      star.z -= this.speed;

      if (star.z <= 0) {
        Object.assign(star, this.createStar(1000));
        star.pz = star.z;
        continue;
      }

      const scale  = focalLength / star.z;
      const pscale = focalLength / star.pz;
      const sx  = star.x * scale  + mx;
      const sy  = star.y * scale  + my;
      const psx = star.x * pscale + mx;
      const psy = star.y * pscale + my;
      const sz  = Math.min(star.size * scale, 3.5);
      const opacity = Math.min(1, (1000 - star.z) / 400);

      if (sx < -10 || sx > canvas.width + 10 || sy < -10 || sy > canvas.height + 10) continue;

      ctx.globalAlpha = opacity;
      ctx.strokeStyle = star.color;
      ctx.lineWidth   = sz;
      ctx.beginPath();
      ctx.moveTo(psx, psy);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (this.running) requestAnimationFrame(() => this.draw());
  }

  start() { this.running = true; this.draw(); }
  stop()  { this.running = false; }
  destroy() {
    this.stop();
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("mousemove", this._onMouse);
  }
}

// ─── Tilt Effect ─────────────────────────────────────────────
function initTilt(el) {
  if (!el) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  - 0.5) * 20;
    const y = ((e.clientY - r.top)  / r.height - 0.5) * -20;
    el.style.transform = `perspective(800px) rotateY(${x}deg) rotateX(${y}deg) translateZ(10px)`;
  });
  el.addEventListener("pointerleave", () => {
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)";
  });
}

// ─── Counter Animation ──────────────────────────────────────
function animateCounter(el) {
  if (!el || el.dataset.counted === "true") return;
  el.dataset.counted = "true";
  const target = Number(el.dataset.count || 0);
  const duration = 1200;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─── Wave Bars Animation ─────────────────────────────────────
function animateWaveBars(container) {
  if (!container) return;
  const bars = container.querySelectorAll(".wave-bar");
  bars.forEach((bar, i) => {
    bar.style.animationDelay = `${i * 0.12}s`;
  });
}

// ─── Page Render ─────────────────────────────────────────────
export class LandingPage {
  render() {
    const user = store.get("user");

    const primaryCta = user
      ? `<a href="#/app" class="btn-3d btn-3d--primary" id="hero-cta-dash">Go to Dashboard <span class="btn-arrow">→</span></a>`
      : `<button type="button" class="btn-3d btn-3d--primary" id="hero-cta-guest">Start Free Now <span class="btn-arrow">→</span></button>
         <button type="button" class="btn-3d btn-3d--ghost open-auth-btn" id="hero-cta-login">Login / Register</button>`;

    return `
      ${navbar.render()}

      <!-- Particle canvas background -->
      <canvas id="hero-canvas" class="hero-canvas" aria-hidden="true"></canvas>

      <!-- Gradient mesh overlay -->
      <div class="mesh-overlay" aria-hidden="true"></div>

      <main class="landing-v2" role="main">

        <!-- ░░ HERO SECTION ░░ -->
        <section class="lv2-hero" aria-labelledby="hero-title">
          <div class="lv2-hero__copy">
            <div class="hero-badge reveal-on-scroll">
              <span class="live-dot" aria-hidden="true"></span>
              Powered by Grok AI + Neural Voices
            </div>

            <h1 id="hero-title" class="hero-title reveal-on-scroll">
              Break Every<br>
              <span class="gradient-text">Language Barrier</span><br>
              In Real Time
            </h1>

            <p class="hero-subtitle reveal-on-scroll">
              TransVoix turns live speech into perfect translations instantly.
              Speak your language. Be heard in every language. No lag. No robots.
            </p>

            <div class="hero-metrics reveal-on-scroll" aria-label="Platform highlights">
              <div class="metric-pill">
                <strong class="metric-num"><span data-count="50">0</span>+</strong>
                <span class="metric-label">Languages</span>
              </div>
              <div class="metric-pill">
                <strong class="metric-num">&lt;<span data-count="1">0</span>s</strong>
                <span class="metric-label">Latency</span>
              </div>
              <div class="metric-pill">
                <strong class="metric-num gradient-text-2">Free</strong>
                <span class="metric-label">To Start</span>
              </div>
            </div>

            <div class="hero-actions reveal-on-scroll">
              ${primaryCta}
            </div>
          </div>

          <!-- 3D Visual Card -->
          <div class="lv2-hero__visual reveal-scale" aria-label="Live translation preview" data-tilt>

            <!-- Orbit language badges -->
            <div class="orbit-system" aria-hidden="true">
              <span class="orbit-badge ob-1">🇮🇳 Hindi</span>
              <span class="orbit-badge ob-2">🇯🇵 Japanese</span>
              <span class="orbit-badge ob-3">🇧🇷 Portuguese</span>
              <span class="orbit-badge ob-4">🇰🇷 Korean</span>
              <span class="orbit-badge ob-5">🇫🇷 French</span>
            </div>

            <!-- Glass translation console -->
            <div class="translation-console">
              <div class="console-topbar">
                <span class="win-dot wd-red"></span>
                <span class="win-dot wd-yellow"></span>
                <span class="win-dot wd-green"></span>
                <span class="live-badge-pill">
                  <span class="live-dot" aria-hidden="true"></span>
                  Live Room
                </span>
              </div>

              <div class="console-body">
                <div class="speaker-bubble sb-left">
                  <div class="sb-meta">
                    <span class="lang-flag">🇺🇸</span>
                    <span class="sb-name">Alex · English</span>
                  </div>
                  <p class="sb-text">"Can we close the deal by Friday?"</p>
                  <div class="wave-container" aria-hidden="true">
                    <span class="wave-bar" style="--bar-h:18px"></span>
                    <span class="wave-bar" style="--bar-h:28px"></span>
                    <span class="wave-bar" style="--bar-h:22px"></span>
                    <span class="wave-bar" style="--bar-h:32px"></span>
                    <span class="wave-bar" style="--bar-h:16px"></span>
                    <span class="wave-bar" style="--bar-h:24px"></span>
                    <span class="wave-bar" style="--bar-h:20px"></span>
                  </div>
                </div>

                <div class="ai-badge-row" aria-label="AI translation engine">
                  <div class="ai-arrow-line"></div>
                  <div class="ai-chip">
                    <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="10" cy="10" r="8" stroke="currentColor"/><path d="M7 10h6M10 7v6" stroke="currentColor"/></svg>
                    Grok AI
                  </div>
                  <div class="ai-arrow-line"></div>
                </div>

                <div class="speaker-bubble sb-right">
                  <div class="sb-meta">
                    <span class="lang-flag">🇯🇵</span>
                    <span class="sb-name">Kenji · Japanese</span>
                  </div>
                  <p class="sb-text">「金曜日までに契約を締結できますか？」</p>
                </div>
              </div>

              <!-- Neon accent line -->
              <div class="console-glow-bar" aria-hidden="true"></div>
            </div>
          </div>
        </section>

        <!-- ░░ HOW IT WORKS ░░ -->
        <section class="lv2-pipeline reveal-on-scroll" aria-labelledby="pipeline-title">
          <div class="section-tag">How It Works</div>
          <h2 id="pipeline-title" class="section-title">From voice to understanding<br><span class="gradient-text">in milliseconds</span></h2>

          <div class="pipeline-track">
            <div class="pipeline-step ps-1">
              <div class="ps-icon" aria-hidden="true">🎙️</div>
              <div class="ps-connector"></div>
              <strong class="ps-title">Capture</strong>
              <p class="ps-desc">Microphone picks up live speech with Voice Activity Detection</p>
            </div>
            <div class="pipeline-step ps-2">
              <div class="ps-icon" aria-hidden="true">⚡</div>
              <div class="ps-connector"></div>
              <strong class="ps-title">Transcribe</strong>
              <p class="ps-desc">Whisper AI converts speech to text locally, no API needed</p>
            </div>
            <div class="pipeline-step ps-3">
              <div class="ps-icon" aria-hidden="true">🧠</div>
              <div class="ps-connector"></div>
              <strong class="ps-title">Translate</strong>
              <p class="ps-desc">Grok AI understands context, slang, and nuance perfectly</p>
            </div>
            <div class="pipeline-step ps-4">
              <div class="ps-icon" aria-hidden="true">🔊</div>
              <strong class="ps-title">Speak</strong>
              <p class="ps-desc">Microsoft Neural Voices deliver natural audio in target language</p>
            </div>
          </div>
        </section>

        <!-- ░░ 3D FEATURE CARDS ░░ -->
        <section class="lv2-features" aria-labelledby="features-title">
          <div class="section-tag">Features</div>
          <h2 id="features-title" class="section-title">Everything you need.<br><span class="gradient-text">Nothing you don't.</span></h2>

          <div class="feature-grid-3d">
            <article class="feature-card-3d" data-tilt>
              <div class="fc3d-glow" style="--glow-color: rgba(124,58,237,0.4)"></div>
              <div class="fc3d-icon" aria-hidden="true">🧠</div>
              <h3 class="fc3d-title">Grok AI Translation</h3>
              <p class="fc3d-desc">Context-aware AI understands slang, idioms, and casual language that other translators miss entirely.</p>
              <div class="fc3d-tag">Primary Engine</div>
            </article>

            <article class="feature-card-3d" data-tilt style="--delay: 0.1s">
              <div class="fc3d-glow" style="--glow-color: rgba(8,145,178,0.4)"></div>
              <div class="fc3d-icon" aria-hidden="true">🎤</div>
              <h3 class="fc3d-title">Whisper Local STT</h3>
              <p class="fc3d-desc">Offline speech-to-text using OpenAI Whisper running locally on your machine. No API costs, no internet required.</p>
              <div class="fc3d-tag fc3d-tag--cyan">100% Free</div>
            </article>

            <article class="feature-card-3d" data-tilt style="--delay: 0.2s">
              <div class="fc3d-glow" style="--glow-color: rgba(236,72,153,0.4)"></div>
              <div class="fc3d-icon" aria-hidden="true">🔊</div>
              <h3 class="fc3d-title">Neural TTS Voices</h3>
              <p class="fc3d-desc">Microsoft Edge Neural voices for 50+ languages — human-like, expressive, and crystal clear audio output.</p>
              <div class="fc3d-tag fc3d-tag--pink">Premium Voice</div>
            </article>

            <article class="feature-card-3d" data-tilt style="--delay: 0.3s">
              <div class="fc3d-glow" style="--glow-color: rgba(124,58,237,0.3)"></div>
              <div class="fc3d-icon" aria-hidden="true">⚡</div>
              <h3 class="fc3d-title">Real-Time Captions</h3>
              <p class="fc3d-desc">Live bilingual captions appear as people speak with &lt;1s latency over WebSockets.</p>
              <div class="fc3d-tag">Live</div>
            </article>

            <article class="feature-card-3d" data-tilt style="--delay: 0.4s">
              <div class="fc3d-glow" style="--glow-color: rgba(8,145,178,0.3)"></div>
              <div class="fc3d-icon" aria-hidden="true">📖</div>
              <h3 class="fc3d-title">Custom Dictionaries</h3>
              <p class="fc3d-desc">Train the AI on your domain vocabulary — legal terms, medical jargon, brand names, gaming slang.</p>
              <div class="fc3d-tag fc3d-tag--cyan">Smart</div>
            </article>

            <article class="feature-card-3d" data-tilt style="--delay: 0.5s">
              <div class="fc3d-glow" style="--glow-color: rgba(16,185,129,0.3)"></div>
              <div class="fc3d-icon" aria-hidden="true">🔒</div>
              <h3 class="fc3d-title">Private & Secure</h3>
              <p class="fc3d-desc">Whisper STT runs 100% locally. No audio is ever sent to external servers. Your conversations stay yours.</p>
              <div class="fc3d-tag fc3d-tag--green">Private</div>
            </article>
          </div>
        </section>

        <!-- ░░ 3D LANGUAGE GLOBE ░░ -->
        <section class="lv2-globe-section" aria-labelledby="globe-title">
          <div class="globe-content">
            <div class="section-tag">Global Reach</div>
            <h2 id="globe-title" class="section-title">50+ languages.<br><span class="gradient-text">One room.</span></h2>
            <p class="section-subtitle">From Hindi to Japanese, Arabic to Portuguese — every language in one live conversation.</p>
            <div class="language-chips" aria-label="Supported languages">
              <span class="lang-chip">🇺🇸 English</span>
              <span class="lang-chip">🇮🇳 Hindi</span>
              <span class="lang-chip">🇯🇵 Japanese</span>
              <span class="lang-chip">🇪🇸 Spanish</span>
              <span class="lang-chip">🇫🇷 French</span>
              <span class="lang-chip">🇩🇪 German</span>
              <span class="lang-chip">🇧🇷 Portuguese</span>
              <span class="lang-chip">🇰🇷 Korean</span>
              <span class="lang-chip">🇨🇳 Chinese</span>
              <span class="lang-chip">🇦🇪 Arabic</span>
              <span class="lang-chip">🇷🇺 Russian</span>
              <span class="lang-chip">🇹🇷 Turkish</span>
              <span class="lang-chip chip-more">+ 38 more</span>
            </div>
          </div>

          <div class="css-globe-wrap" aria-hidden="true">
            <div class="css-globe" role="img" aria-label="3D rotating globe showing global language support">
              <div class="globe-core"></div>
              <div class="globe-ring gr-h"></div>
              <div class="globe-ring gr-v1"></div>
              <div class="globe-ring gr-v2"></div>
              <div class="globe-ring gr-d1"></div>
              <div class="globe-ring gr-d2"></div>
              <span class="globe-node gn-1">EN</span>
              <span class="globe-node gn-2">JA</span>
              <span class="globe-node gn-3">AR</span>
              <span class="globe-node gn-4">ES</span>
              <span class="globe-node gn-5">HI</span>
              <span class="globe-node gn-6">ZH</span>
            </div>
          </div>
        </section>

        <!-- ░░ SOLUTIONS & USE CASES ░░ -->
        <section class="lv2-proof" aria-labelledby="proof-title">
          <div class="section-tag">Solutions</div>
          <h2 id="proof-title" class="section-title">Designed for every<br><span class="gradient-text">conversation.</span></h2>

          <div class="testimonial-grid">
            <article class="testimonial-card-3d">
              <div style="font-size: 2rem; margin-bottom: 12px;" aria-hidden="true">💼</div>
              <h3 style="font-family: var(--font-family-heading); font-weight: 700; margin-bottom: 8px; font-size: 1.15rem; color: var(--text-primary);">Global Business</h3>
              <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.6; margin: 0;">Conduct seamless remote syncs, sales calls, and cross-border meetings without language barriers.</p>
            </article>
            <article class="testimonial-card-3d" style="--delay: 0.15s">
              <div style="font-size: 2rem; margin-bottom: 12px;" aria-hidden="true">🎧</div>
              <h3 style="font-family: var(--font-family-heading); font-weight: 700; margin-bottom: 8px; font-size: 1.15rem; color: var(--text-primary);">Customer Support</h3>
              <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.6; margin: 0;">Support international users in their native language in real-time, boosting CSAT scores instantly.</p>
            </article>
            <article class="testimonial-card-3d" style="--delay: 0.3s">
              <div style="font-size: 2rem; margin-bottom: 12px;" aria-hidden="true">🏥</div>
              <h3 style="font-family: var(--font-family-heading); font-weight: 700; margin-bottom: 8px; font-size: 1.15rem; color: var(--text-primary);">Healthcare & Legal</h3>
              <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.6; margin: 0;">Communicate securely. With local Whisper STT, sensitive conversations remain private and compliant.</p>
            </article>
          </div>
        </section>

        <!-- ░░ FINAL CTA ░░ -->
        <section class="lv2-cta" aria-labelledby="cta-title">
          <div class="cta-mesh" aria-hidden="true"></div>
          <div class="cta-content">
            <div class="section-tag">Get Started</div>
            <h2 id="cta-title" class="cta-title">Open a room.<br><span class="gradient-text">Start talking.</span></h2>
            <p class="section-subtitle">No setup. No API key required to start. Just open a room and speak.</p>
            <div class="hero-actions">
              ${user
                ? `<a href="#/app" class="btn-3d btn-3d--primary">Launch Dashboard →</a>`
                : `<button type="button" class="btn-3d btn-3d--primary cta-guest-btn">Start as Guest →</button>
                   <button type="button" class="btn-3d btn-3d--ghost open-auth-btn">Create Account</button>`
              }
            </div>
          </div>
        </section>

      </main>

      <!-- Auth Modal -->
      <div id="auth-modal" class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" hidden>
        <div class="auth-card-v2">
          <div class="auth-header">
            <h3 id="modal-title">Sign In</h3>
            <button id="close-modal-btn" type="button" class="icon-btn" aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <form id="auth-form" class="auth-form-v2">
            <div class="form-field-v2" id="name-field" hidden>
              <label for="auth-name">Display Name</label>
              <input id="auth-name" type="text" class="input-v2" placeholder="Your name">
            </div>
            <div class="form-field-v2">
              <label for="auth-email">Email</label>
              <input id="auth-email" type="email" class="input-v2" placeholder="email@example.com" required>
            </div>
            <div class="form-field-v2">
              <label for="auth-password">Password</label>
              <input id="auth-password" type="password" class="input-v2" placeholder="Password" required>
            </div>
            <button type="submit" class="btn-3d btn-3d--primary" style="width:100%">Submit</button>
          </form>
          <button id="toggle-mode-btn" type="button" class="text-link-btn">Need an account? Sign Up</button>
        </div>
      </div>
    `;
  }

  mounted() {
    navbar.mounted();

    // ── Star Field ──────────────────────────────────────────
    const canvas = document.getElementById("hero-canvas");
    if (canvas) {
      this._starField = new StarField(canvas);
      this._starField.start();
    }

    // ── 3D Tilt Cards ──────────────────────────────────────
    document.querySelectorAll("[data-tilt]").forEach(initTilt);

    // ── Scroll Reveal (Intersection Observer) ──────────────
    const revealItems = document.querySelectorAll(".reveal-on-scroll, .reveal-scale");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry, i) => {
            if (!entry.isIntersecting) return;
            const delay = parseFloat(entry.target.style.getPropertyValue("--delay") || 0);
            setTimeout(() => {
              entry.target.classList.add("is-visible");
              // Animate counters when metric strip becomes visible
              entry.target.querySelectorAll("[data-count]").forEach(animateCounter);
            }, delay * 1000);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
      );
      revealItems.forEach((el) => observer.observe(el));
    } else {
      revealItems.forEach((el) => el.classList.add("is-visible"));
      document.querySelectorAll("[data-count]").forEach(animateCounter);
    }

    // ── Wave bars ──────────────────────────────────────────
    animateWaveBars(document.querySelector(".wave-container"));

    // ── GSAP ScrollTrigger (if loaded) ─────────────────────
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);

      // Parallax hero canvas
      gsap.to("#hero-canvas", {
        yPercent: 30,
        ease: "none",
        scrollTrigger: { trigger: ".lv2-hero", scrub: 0.6 },
      });

      // Pipeline steps stagger on scroll
      gsap.from(".pipeline-step", {
        opacity: 0,
        y: 50,
        duration: 0.6,
        stagger: 0.15,
        ease: "power2.out",
        scrollTrigger: { trigger: ".pipeline-track", start: "top 75%" },
      });

      // Feature cards stagger
      gsap.from(".feature-card-3d", {
        opacity: 0,
        y: 40,
        scale: 0.95,
        duration: 0.5,
        stagger: 0.1,
        ease: "power1.out",
        scrollTrigger: { trigger: ".feature-grid-3d", start: "top 80%" },
      });

      // Globe spin speed on scroll
      gsap.to(".css-globe", {
        rotationY: "+=360",
        duration: 20,
        ease: "none",
        repeat: -1,
      });

      // Testimonials stagger
      gsap.from(".testimonial-card-3d", {
        opacity: 0,
        x: -30,
        duration: 0.5,
        stagger: 0.15,
        ease: "power1.out",
        scrollTrigger: { trigger: ".testimonial-grid", start: "top 80%" },
      });
    }

    // ── Auth Modal ─────────────────────────────────────────
    const authModal     = document.getElementById("auth-modal");
    const closeBtn      = document.getElementById("close-modal-btn");
    const authForm      = document.getElementById("auth-form");
    const toggleModeBtn = document.getElementById("toggle-mode-btn");
    const nameField     = document.getElementById("name-field");
    let isRegister = false;

    const openModal = () => {
      if (!authModal) return;
      authModal.hidden = false;
      requestAnimationFrame(() => authModal.classList.add("is-open"));
      document.getElementById("auth-email")?.focus();
    };
    const closeModal = () => {
      if (!authModal) return;
      authModal.classList.remove("is-open");
      setTimeout(() => { authModal.hidden = true; }, 300);
    };

    document.querySelectorAll(".open-auth-btn").forEach((btn) => btn.addEventListener("click", openModal));
    closeBtn?.addEventListener("click", closeModal);
    authModal?.addEventListener("click", (e) => { if (e.target === authModal) closeModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && authModal && !authModal.hidden) closeModal();
    });

    toggleModeBtn?.addEventListener("click", () => {
      isRegister = !isRegister;
      document.getElementById("modal-title").textContent = isRegister ? "Sign Up" : "Sign In";
      toggleModeBtn.textContent = isRegister ? "Already have an account? Sign In" : "Need an account? Sign Up";
      nameField.hidden = !isRegister;
    });

    authForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email    = document.getElementById("auth-email").value;
      const password = document.getElementById("auth-password").value;
      const name     = document.getElementById("auth-name")?.value || "";
      try {
        if (isRegister) {
          const r = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, display_name: name || "User" }),
          });
          if (!r.ok) throw new Error("Registration failed");
        }
        const lr = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!lr.ok) throw new Error("Login failed");
        const tokens = await lr.json();
        store.set("token", tokens.access_token);
        store.set("user", { email, display_name: name || "Member", role: "member" });
        closeModal();
        window.location.hash = "#/app";
      } catch (err) {
        alert(err.message);
      }
    });

    // ── Guest buttons ──────────────────────────────────────
    document.querySelectorAll("#hero-cta-guest, .cta-guest-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = "guest_" + Math.random().toString(36).substr(2, 9);
        store.set("user", { id, display_name: "Guest " + id.substr(6, 4), role: "guest" });
        window.location.hash = "#/app";
      });
    });
  }

  unmounted() {
    this._starField?.destroy();
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.killAll();
  }
}

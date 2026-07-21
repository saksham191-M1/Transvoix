export class Router {
  constructor(routes, containerId) {
    this.routes = routes;
    this.container = document.getElementById(containerId);
    window.addEventListener("hashchange", () => this.route());
  }

  init() {
    this.route();
  }

  navigate(path) {
    window.location.hash = path;
  }

  async route() {
    let hash = window.location.hash || "#/";
    
    // Quick sanitization
    if (!hash.startsWith("#/")) {
      hash = "#/";
    }

    // Extract dynamic params e.g. #/room/XYZ
    const parts = hash.split("/").filter(Boolean); // e.g. ["#", "room", "XYZ"]
    let route = "/" + (parts[1] || "");
    let param = parts[2] || null;

    const pageHandler = this.routes[route] || this.routes["/"];
    
    if (pageHandler) {
      try {
        const pageInstance = await pageHandler();
        this.container.innerHTML = "";
        
        // Render page template
        const dom = pageInstance.render(param);
        if (dom instanceof HTMLElement) {
          this.container.appendChild(dom);
        } else {
          this.container.innerHTML = dom;
        }
        
        // Scroll to top on route change
        window.scrollTo(0, 0);
        
        // Bind event triggers
        if (pageInstance.mounted) {
          pageInstance.mounted(param);
        }
      } catch (err) {
        console.error("Routing error:", err);
        this.container.innerHTML = `<div class="glass-card"><h2>Error Loading Page</h2><p>${err.message}</p></div>`;
      }
    }
  }
}

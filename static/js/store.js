// Global Reactive Pub/Sub Store
class Store {
  constructor() {
    this.state = {
      user: JSON.parse(localStorage.getItem("tv_user")) || null,
      token: localStorage.getItem("tv_token") || null,
      session: null, // active meeting room details
      theme: localStorage.getItem("tv_theme") || "dark",
      languages: []
    };
    this.listeners = {};
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    
    // Persist certain keys
    if (key === "user") {
      localStorage.setItem("tv_user", JSON.stringify(value));
    } else if (key === "token") {
      localStorage.setItem("tv_token", value || "");
    } else if (key === "theme") {
      localStorage.setItem("tv_theme", value);
      document.documentElement.setAttribute("data-theme", value);
    }

    this._trigger(key, value);
  }

  subscribe(key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);
    
    // Run immediately to initialize
    callback(this.state[key]);
    
    return () => {
      this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    };
  }

  _trigger(key, value) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(callback => callback(value));
    }
  }

  logout() {
    this.set("user", null);
    this.set("token", null);
    this.set("session", null);
  }
}

export const store = new Store();
// Initial setup of theme on script load
document.documentElement.setAttribute("data-theme", store.get("theme"));

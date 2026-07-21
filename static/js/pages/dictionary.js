import { store } from "../store.js";
import { navbar } from "../components/navbar.js";

export class DictionaryPage {
  constructor() {
    this.dictionaries = [];
    this.selectedDict = null;
    this.entries = [];
  }

  render() {
    const user = store.get("user");
    const languages = store.get("languages") || [];
    
    if (!user) {
      setTimeout(() => window.location.hash = "#/", 0);
      return "";
    }

    return `
      ${navbar.render()}
      <main class="main-content" style="max-width: 1100px;">
        <div style="margin-bottom: 28px;">
          <span class="section-tag">Custom Vocab</span>
          <h2 style="font-size: 2.2rem; font-weight: 800;">Domain <span class="gradient-text">Dictionaries</span></h2>
          <p style="color: var(--text-secondary); margin-top: 6px;">Define custom word overrides for legal terms, brand names, or specialized jargon.</p>
        </div>

        <div class="split-layout-340">
          <!-- Left: Dict List & Create -->
          <div class="glass-card" style="display: flex; flex-direction: column; gap: 20px; height: fit-content;">
            <h3 style="font-family: var(--font-family-heading); font-weight: 700;">Create Dictionary</h3>
            <form id="create-dict-form" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <label for="dict-name">Dictionary Name</label>
                <input id="dict-name" type="text" class="form-input" placeholder="e.g. Legal Overrides" required />
              </div>
              <div>
                <label for="dict-src">Source Language</label>
                <select id="dict-src" class="form-select">
                  ${languages.map(l => `<option value="${l.code}">${l.flag} ${l.name}</option>`).join("")}
                </select>
              </div>
              <div>
                <label for="dict-tgt">Target Language</label>
                <select id="dict-tgt" class="form-select">
                  ${languages.map(l => `<option value="${l.code}">${l.flag} ${l.name}</option>`).join("")}
                </select>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">Create Dictionary →</button>
            </form>

            <h3 style="border-top: 1px solid var(--border-glass); padding-top: 16px; margin-top: 8px; font-family: var(--font-family-heading); font-weight: 700;">My Dictionaries</h3>
            <div id="dict-list" style="display: flex; flex-direction: column; gap: 10px;">
              <p style="color: var(--text-muted); font-size: 0.88rem;">Loading dictionaries...</p>
            </div>
          </div>

          <!-- Right: Entries -->
          <div class="glass-card" style="display: flex; flex-direction: column; gap: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-glass); padding-bottom: 14px;">
              <h3 id="selected-dict-title" style="font-family: var(--font-family-heading); font-weight: 700;">Select a Dictionary</h3>
              <div id="dict-meta" class="fc3d-tag fc3d-tag--cyan" style="font-size: 0.78rem;"></div>
            </div>

            <!-- Add Entry Form (Hidden until selected) -->
            <form id="add-entry-form" class="dict-entry-form" style="display: none;">
              <div>
                <label for="entry-src">Source Term</label>
                <input id="entry-src" type="text" class="form-input" placeholder="e.g. Plaintiff" required />
              </div>
              <div>
                <label for="entry-tgt">Target Term Override</label>
                <input id="entry-tgt" type="text" class="form-input" placeholder="e.g. Demandante" required />
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">Add Term</button>
            </form>

            <!-- Entries List -->
            <div id="entries-container" style="display: flex; flex-direction: column; gap: 10px;">
              <p style="color: var(--text-muted);">Please select a dictionary from the left panel to manage term mappings.</p>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  mounted() {
    navbar.mounted();
    const user = store.get("user");
    if (!user) return;

    this.loadDictionaries(user.id);

    const createForm = document.getElementById("create-dict-form");
    const entryForm = document.getElementById("add-entry-form");

    if (createForm) {
      createForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("dict-name").value;
        const source_language = document.getElementById("dict-src").value;
        const target_language = document.getElementById("dict-tgt").value;

        try {
          const res = await fetch("/api/dictionaries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: user.id,
              name,
              source_language,
              target_language
            })
          });
          if (!res.ok) throw new Error("Failed to create dictionary");
          
          document.getElementById("dict-name").value = "";
          this.loadDictionaries(user.id);
        } catch (err) {
          alert(err.message);
        }
      });
    }

    if (entryForm) {
      entryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!this.selectedDict) return;

        const source_term = document.getElementById("entry-src").value;
        const target_term = document.getElementById("entry-tgt").value;

        try {
          const res = await fetch(`/api/dictionaries/${this.selectedDict.id}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_term, target_term })
          });
          if (!res.ok) throw new Error("Failed to add entry");

          document.getElementById("entry-src").value = "";
          document.getElementById("entry-tgt").value = "";
          this.loadEntries(this.selectedDict.id);
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }

  async loadDictionaries(userId) {
    try {
      const res = await fetch(`/api/dictionaries?user_id=${userId}`);
      this.dictionaries = await res.json();
      
      const container = document.getElementById("dict-list");
      if (!container) return;
      
      container.innerHTML = "";
      if (this.dictionaries.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.88rem;">No custom dictionaries created yet.</p>`;
        return;
      }

      this.dictionaries.forEach(d => {
        const item = document.createElement("div");
        item.className = "glass-card";
        item.style.padding = "14px";
        item.style.cursor = "pointer";
        item.style.transition = "all 0.2s ease";
        item.style.border = this.selectedDict && this.selectedDict.id === d.id ? "1px solid var(--accent-primary)" : "1px solid var(--border-glass)";
        if (this.selectedDict && this.selectedDict.id === d.id) {
          item.style.boxShadow = "var(--shadow-glow)";
        }
        item.innerHTML = `
          <strong style="font-size: 0.95rem;">${d.name}</strong>
          <div style="font-size: 0.78rem; color: var(--accent-secondary); margin-top: 6px; font-weight: 600;">
            ${d.source_language.toUpperCase()} ➔ ${d.target_language.toUpperCase()}
          </div>
        `;
        item.addEventListener("click", () => {
          this.selectedDict = d;
          this.loadDictionaries(userId);
          this.loadEntries(d.id);
        });
        container.appendChild(item);
      });
    } catch (err) {
      console.error(err);
    }
  }

  async loadEntries(dictId) {
    try {
      const res = await fetch(`/api/dictionaries/${dictId}/entries`);
      this.entries = await res.json();
      
      document.getElementById("selected-dict-title").innerText = this.selectedDict.name;
      document.getElementById("dict-meta").innerText = `${this.selectedDict.source_language.toUpperCase()} ➔ ${this.selectedDict.target_language.toUpperCase()}`;
      document.getElementById("add-entry-form").style.display = "grid";

      const container = document.getElementById("entries-container");
      container.innerHTML = "";

      if (this.entries.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.92rem; margin-top: 12px;">No custom overrides added yet. Insert word maps above.</p>`;
        return;
      }

      this.entries.forEach(e => {
        const row = document.createElement("div");
        row.className = "participant-item";
        row.style.marginBottom = "6px";
        row.innerHTML = `
          <div>
            <span style="color: var(--text-secondary);">${e.source_term}</span>
            <span style="margin: 0 10px; color: var(--accent-secondary);">➔</span>
            <strong>${e.target_term}</strong>
          </div>
        `;
        container.appendChild(row);
      });
    } catch (err) {
      console.error(err);
    }
  }
}

const DEFAULT_SOURCE = {
  label: "juanjimpad/claude-rules",
  rawBase: "https://raw.githubusercontent.com/juanjimpad/claude-rules/main",
  type: "rules",
};

let rules = [];
let activeCategory = "all";
let activeTag = "";
let searchQuery = "";

// ── Sources ──────────────────────────────────────────────────────────────────

function githubToRaw(url) {
  // Accept repo root or any deep link — extract owner/repo and optional branch
  const m = url.trim().match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\/(?:tree|blob)\/([^/]+))?(?:\/.*)?$/
  );
  if (!m) return null;
  const slug = m[1];
  const branch = m[2] || "main";
  return { label: slug, rawBase: `https://raw.githubusercontent.com/${slug}/${branch}` };
}

// Map a .claude-plugin/marketplace.json plugin entry to our card format
function pluginToRule(plugin, marketplaceName, source) {
  return {
    id: plugin.name,
    name: plugin.name,
    title: plugin.displayName || plugin.name,
    description: plugin.description || "",
    category: plugin.category || "plugin",
    tags: plugin.keywords || plugin.tags || [],
    author: plugin.author?.name || marketplaceName,
    version: plugin.version || "",
    _source: source,
    _installCmd: `/plugin install ${plugin.name}@${marketplaceName}`,
  };
}

async function fetchSource(source) {
  // Try our native format first
  const rulesRes = await fetch(`${source.rawBase}/rules/index.json`);
  if (rulesRes.ok) {
    const data = await rulesRes.json();
    return { type: "rules", items: data.map(r => ({ ...r, _source: source })) };
  }

  // Fallback: try .claude-plugin/marketplace.json
  const pluginRes = await fetch(`${source.rawBase}/.claude-plugin/marketplace.json`);
  if (pluginRes.ok) {
    const data = await pluginRes.json();
    const items = (data.plugins || []).map(p => pluginToRule(p, data.name || source.label, source));
    return { type: "plugin", items };
  }

  throw new Error("No rules/index.json or .claude-plugin/marketplace.json found");
}

async function loadRules() {
  try {
    const { items } = await fetchSource(DEFAULT_SOURCE);
    rules = items;
  } catch {
    rules = [];
  }
  render();
}

async function addSource(url) {
  const source = githubToRaw(url);
  if (!source) {
    showToast("Invalid GitHub URL", true);
    return;
  }

  const btn = document.getElementById("btn-add-source");
  const input = document.getElementById("source-input");
  btn.disabled = true;
  btn.textContent = "Loading…";

  try {
    const { type, items } = await fetchSource(source);
    rules = rules.filter(r => r._source.rawBase !== source.rawBase).concat(items);
    input.value = "";
    activeCategory = "all";
    activeTag = "";
    const kind = type === "plugin" ? "plugin(s)" : "rule(s)";
    showToast(`${items.length} ${kind} loaded from ${source.label}`);
    render();
  } catch {
    showToast(`No rules/index.json or .claude-plugin/marketplace.json found in ${source.label}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Add";
  }
}

// ── Install command ───────────────────────────────────────────────────────────

function installCmd(rule) {
  if (rule._installCmd) return rule._installCmd;
  return `curl -sL ${rule._source.rawBase}/install.sh | bash -s ${rule.id}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Render ────────────────────────────────────────────────────────────────────

function categories() {
  return [...new Set(rules.map(r => r.category))];
}

function render() {
  renderFilters();
  renderGrid();
}

function renderFilters() {
  const el = document.getElementById("filters");
  const cats = categories();
  el.innerHTML = [
    `<button class="filter-btn${activeCategory === "all" ? " active" : ""}" data-cat="all">All</button>`,
    ...cats.map(c => `<button class="filter-btn${activeCategory === c ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
  ].join("");

  el.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      activeTag = "";
      render();
    });
  });
}

function renderGrid() {
  const el = document.getElementById("grid");
  const q = searchQuery.toLowerCase();

  const filtered = rules.filter(r => {
    const matchCat = activeCategory === "all" || r.category === activeCategory;
    const matchTag = !activeTag || r.tags.includes(activeTag);
    const matchQ = !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.some(t => t.includes(q));
    return matchCat && matchTag && matchQ;
  });

  if (!filtered.length) {
    el.innerHTML = `<div class="empty">No rules found</div>`;
    return;
  }

  const isMultiSource = new Set(rules.map(r => r._source.rawBase)).size > 1;

  el.innerHTML = filtered.map(r => `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${esc(r.title)}</span>
        <span class="card-category">${esc(r.category)}</span>
      </div>
      <p class="card-desc">${esc(r.description)}</p>
      <div class="card-tags">${r.tags.map(t => `<span class="tag${activeTag === t ? " tag-active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("")}</div>
      <div class="card-footer">
        <span class="card-author">
          ${isMultiSource ? `<span class="source-badge">${esc(r._source.label)}</span>` : `by ${esc(r.author)}`}
        </span>
        <button class="btn-install" data-cmd="${esc(installCmd(r))}">Install</button>
      </div>
    </div>
  `).join("");

  el.querySelectorAll(".tag").forEach(tag => {
    tag.addEventListener("click", () => {
      activeTag = activeTag === tag.dataset.tag ? "" : tag.dataset.tag;
      renderGrid();
    });
  });

  el.querySelectorAll(".btn-install").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.cmd).then(() => {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        showToast("Command copied");
        setTimeout(() => {
          btn.textContent = "Install";
          btn.classList.remove("copied");
        }, 2000);
      });
    });
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg = "Command copied", isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.toggle("toast-error", isError);
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2500);
}

// ── Events ────────────────────────────────────────────────────────────────────

document.getElementById("search").addEventListener("input", e => {
  searchQuery = e.target.value;
  renderGrid();
});

const popup = document.getElementById("source-popup");

document.getElementById("btn-open-popup").addEventListener("click", e => {
  e.stopPropagation();
  popup.classList.toggle("hidden");
  if (!popup.classList.contains("hidden")) {
    document.getElementById("source-input").focus();
  }
});

document.getElementById("btn-add-source").addEventListener("click", () => {
  const url = document.getElementById("source-input").value;
  if (url.trim()) { popup.classList.add("hidden"); addSource(url.trim()); }
});

document.getElementById("source-input").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const url = e.target.value;
    if (url.trim()) { popup.classList.add("hidden"); addSource(url.trim()); }
  }
  if (e.key === "Escape") popup.classList.add("hidden");
});

document.addEventListener("click", e => {
  if (!popup.classList.contains("hidden") && !popup.closest(".source-wrap").contains(e.target)) {
    popup.classList.add("hidden");
  }
});

loadRules();

// ── Footer commit ─────────────────────────────────────────────────────────────

fetch("https://api.github.com/repos/juanjimpad/claude-rules-web/commits/main")
  .then(r => r.json())
  .then(data => {
    const sha = data?.sha?.slice(0, 7);
    const el = document.getElementById("footer-commit");
    if (sha) {
      el.textContent = sha;
      el.href = `https://github.com/juanjimpad/claude-rules-web/commit/${data.sha}`;
    }
  })
  .catch(() => {});

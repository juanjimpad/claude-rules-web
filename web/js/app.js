let defaultSources = [];

let rules = [];
let isMultiSource = false;
let activeCategory = "all";
let activeTag = "";
let searchQuery = "";

// ── DOM refs ──────────────────────────────────────────────────────────────────

const $filters = document.getElementById("filters");
const $grid    = document.getElementById("grid");
const $toast   = document.getElementById("toast");
const $search  = document.getElementById("search");
const $popup   = document.getElementById("source-popup");
const $sourceWrap = $popup.parentElement;

// ── Sources ──────────────────────────────────────────────────────────────────

function githubToRaw(url) {
  const m = url.trim().match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\/(?:tree|blob)\/([^/]+))?(?:\/.*)?$/
  );
  if (!m) return null;
  const slug = m[1];
  const branch = m[2] || "main";
  return { label: slug, rawBase: `https://raw.githubusercontent.com/${slug}/${branch}` };
}

function pluginToRule(plugin, marketplaceName, source) {
  return {
    id: plugin.name,
    title: plugin.displayName || plugin.name,
    description: plugin.description || "",
    category: plugin.category || "plugin",
    tags: plugin.keywords || plugin.tags || [],
    author: plugin.author?.name || marketplaceName,
    _source: source,
    _installCmd: `/plugin install ${plugin.name}@${marketplaceName}`,
  };
}

async function fetchSource(source) {
  const rulesRes = await fetch(`${source.rawBase}/rules/index.json`);
  if (rulesRes.ok) {
    const data = await rulesRes.json();
    return { type: "rules", items: data.map(r => ({ ...r, _source: source })) };
  }

  const pluginRes = await fetch(`${source.rawBase}/.claude-plugin/marketplace.json`);
  if (pluginRes.ok) {
    const data = await pluginRes.json();
    const items = (data.plugins || []).map(p => pluginToRule(p, data.name || source.label, source));
    return { type: "plugin", items };
  }

  throw new Error("No rules/index.json or .claude-plugin/marketplace.json found");
}

const STORAGE_KEY = "claude-rules-sources";

function savedSources() {
  try {
    const sources = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return sources.filter(s =>
      typeof s.label === "string" &&
      typeof s.rawBase === "string" &&
      s.rawBase.startsWith("https://raw.githubusercontent.com/")
    );
  } catch { return []; }
}

function saveSource(source) {
  const current = savedSources().filter(s => s.rawBase !== source.rawBase);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, { label: source.label, rawBase: source.rawBase }]));
}

function removeSource(rawBase) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSources().filter(s => s.rawBase !== rawBase)));
}

function setRules(items) {
  rules = items;
  isMultiSource = new Set(rules.map(r => r._source.rawBase)).size > 1;
}

async function loadRules() {
  try {
    const res = await fetch("sources.json");
    if (res.ok) {
      const data = await res.json();
      defaultSources = data.sources || [];
    }
  } catch {}

  const all = [...defaultSources, ...savedSources()];
  const results = await Promise.allSettled(all.map(s => fetchSource(s)));
  setRules(results.flatMap(r => r.status === "fulfilled" ? r.value.items : []));
  render();
}

async function addSource(url) {
  const source = githubToRaw(url);
  if (!source) {
    showToast("Invalid GitHub URL", true);
    return;
  }

  const btn = document.getElementById("btn-add-source");
  btn.disabled = true;
  btn.textContent = "Loading…";

  try {
    const { type, items } = await fetchSource(source);
    setRules(rules.filter(r => r._source.rawBase !== source.rawBase).concat(items));
    saveSource(source);
    document.getElementById("source-input").value = "";
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
  const cats = categories();
  $filters.innerHTML = [
    `<button class="filter-btn${activeCategory === "all" ? " active" : ""}" data-cat="all">All</button>`,
    ...cats.map(c => `<button class="filter-btn${activeCategory === c ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
  ].join("");
}

function renderGrid() {
  const q = searchQuery.toLowerCase();

  const filtered = rules.filter(r => {
    const matchCat = activeCategory === "all" || r.category === activeCategory;
    const matchTag = !activeTag || r.tags.includes(activeTag);
    const matchQ = !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.some(t => t.includes(q));
    return matchCat && matchTag && matchQ;
  });

  if (!filtered.length) {
    $grid.innerHTML = `<div class="empty">No rules found</div>`;
    return;
  }

  $grid.innerHTML = filtered.map(r => `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${esc(r.title)}</span>
        <span class="card-category">${esc(r.category)}</span>
      </div>
      <p class="card-desc">${esc(r.description)}</p>
      <div class="card-tags">${r.tags.map(t => `<span class="tag${activeTag === t ? " tag-active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("")}</div>
      <div class="card-footer">
        <span class="card-author">
          ${isMultiSource
            ? `<a class="source-badge" href="https://github.com/${esc(r._source.label)}" target="_blank" rel="noopener">${esc(r._source.label)}</a>`
            : `by ${esc(r.author)}`}
          ${!defaultSources.some(s => s.rawBase === r._source.rawBase)
            ? `<button class="btn-remove-source" data-rawbase="${esc(r._source.rawBase)}" title="Remove source">×</button>`
            : ""}
        </span>
        <button class="btn-install" data-cmd="${esc(installCmd(r))}">Install</button>
      </div>
    </div>
  `).join("");
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg = "Command copied", isError = false) {
  $toast.textContent = msg;
  $toast.classList.toggle("toast-error", isError);
  $toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.add("hidden"), 2500);
}

// ── Events ────────────────────────────────────────────────────────────────────

$search.addEventListener("input", e => {
  searchQuery = e.target.value;
  renderGrid();
});

$filters.addEventListener("click", e => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  activeCategory = btn.dataset.cat;
  activeTag = "";
  render();
});

$grid.addEventListener("click", e => {
  const tag       = e.target.closest(".tag");
  const removeBtn = e.target.closest(".btn-remove-source");
  const installBtn = e.target.closest(".btn-install");

  if (tag) {
    activeTag = activeTag === tag.dataset.tag ? "" : tag.dataset.tag;
    renderGrid();
  } else if (removeBtn) {
    const rawBase = removeBtn.dataset.rawbase;
    removeSource(rawBase);
    setRules(rules.filter(r => r._source.rawBase !== rawBase));
    render();
    showToast("Source removed");
  } else if (installBtn) {
    navigator.clipboard.writeText(installBtn.dataset.cmd).then(() => {
      installBtn.textContent = "Copied!";
      installBtn.classList.add("copied");
      showToast("Command copied");
      setTimeout(() => {
        installBtn.textContent = "Install";
        installBtn.classList.remove("copied");
      }, 2000);
    });
  }
});

const $popupBtn = document.getElementById("btn-open-popup");

function hidePopup() { $popup.classList.add("hidden"); }

function submitSource() {
  const url = document.getElementById("source-input").value.trim();
  if (url) { hidePopup(); addSource(url); }
}

$popupBtn.addEventListener("click", e => {
  e.stopPropagation();
  $popup.classList.toggle("hidden");
  if (!$popup.classList.contains("hidden")) {
    document.getElementById("source-input").focus();
  }
});

document.getElementById("btn-add-source").addEventListener("click", submitSource);

document.getElementById("source-input").addEventListener("keydown", e => {
  if (e.key === "Enter") submitSource();
  if (e.key === "Escape") hidePopup();
});

document.addEventListener("click", e => {
  const themeBtn = e.target.closest(".theme-btn");
  if (themeBtn) { applyTheme(themeBtn.dataset.themeVal); return; }
  if (!$popup.classList.contains("hidden") && !$sourceWrap.contains(e.target)) hidePopup();
});

loadRules();

// ── Theme ─────────────────────────────────────────────────────────────────────

const THEME_KEY = "claude-rules-theme";

function applyTheme(val) {
  if (val === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", val);
  }
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.themeVal === val);
  });
  localStorage.setItem(THEME_KEY, val);
}

applyTheme(localStorage.getItem(THEME_KEY) || "auto");

// ── Commit hash ───────────────────────────────────────────────────────────────

const BUILD_SHA = 'BUILD_VERSION';

(() => {
  const el = document.getElementById("sticky-commit");
  if (!el) return;
  if (BUILD_SHA.startsWith('BUILD_')) {
    el.textContent = "local";
    el.removeAttribute("href");
    return;
  }
  el.textContent = BUILD_SHA;
})();

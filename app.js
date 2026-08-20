let state = { habits: [], journal: [], updatedAt: 0 };

const ICONS = ["✓", "🏃", "📖", "🛌", "💧", "🌿", "🏋️", "🧠", "🔥", "✏️", "☕", "🌙", "❤️", "☀️", "🎵", "🧘"];
const COLORS = ["#FF6A3D", "#5FD98A", "#4A90D9", "#F1C40F", "#9B59B6", "#1ABC9C", "#EC407A", "#E67E22"];

let pendingHabitId = null;
let pendingIcon = ICONS[0];
let pendingColor = COLORS[0];
let pendingCategories = [];
let pendingMood = 3;
let pendingExerciseKey = null;
let pendingAccentColor = COLORS[0];

// ---------- pentagon categories ----------
const CATEGORIES = [
  { key: "discipline", label: "Discipline", short: "Disc" },
  { key: "health", label: "Health", short: "Health" },
  { key: "focus", label: "Focus", short: "Focus" },
  { key: "energy", label: "Energy", short: "Energy" },
  { key: "mindfulness", label: "Mindfulness", short: "Mindful" },
];

function categoryLabel(key) {
  const custom = state.settings?.categoryLabels?.[key];
  if (custom) return custom;
  return CATEGORIES.find(c => c.key === key)?.label || key;
}
function categoryShortLabel(key) {
  const custom = state.settings?.categoryLabels?.[key];
  if (custom) return custom.length > 7 ? custom.slice(0, 6) + "…" : custom;
  return CATEGORIES.find(c => c.key === key)?.short || key;
}

// ---------- workout exercises & rank tiers ----------
const TIERS = [
  { key: "bronze", label: "Bronze", color: "#CD7F32" },
  { key: "silver", label: "Silver", color: "#B9C2CB" },
  { key: "gold", label: "Gold", color: "#F1C40F" },
  { key: "platinum", label: "Platinum", color: "#7FE7E0" },
  { key: "diamond", label: "Diamond", color: "#7FB2FF" },
];

const EXERCISES = [
  { key: "pushups", name: "Push-ups", unit: "reps", icon: "💪", thresholds: [20, 50, 100, 150, 200] },
  { key: "crunches", name: "Crunches", unit: "reps", icon: "🔺", thresholds: [30, 75, 150, 250, 350] },
  { key: "squats", name: "Squats", unit: "reps", icon: "🦵", thresholds: [30, 75, 150, 250, 350] },
  { key: "lunges", name: "Lunges", unit: "reps", icon: "🚶", thresholds: [20, 50, 100, 160, 220] },
  { key: "jumpingjacks", name: "Jumping Jacks", unit: "reps", icon: "⭐", thresholds: [30, 75, 150, 250, 350] },
  { key: "wallsit", name: "Wall Sit", unit: "sec", icon: "🧱", thresholds: [30, 90, 180, 300, 420] },
  { key: "situps", name: "Sit-ups", unit: "reps", icon: "🔻", thresholds: [30, 75, 150, 250, 350] },
  { key: "pullups", name: "Pull-ups", unit: "reps", icon: "🧗", thresholds: [3, 8, 15, 25, 35] },
  { key: "plank", name: "Plank Hold", unit: "sec", icon: "🧘", thresholds: [30, 90, 180, 300, 420] },
  { key: "burpees", name: "Burpees", unit: "reps", icon: "🔥", thresholds: [15, 30, 60, 100, 150] },
  { key: "run", name: "Single Run", unit: "km", icon: "🏃", thresholds: [2, 5, 10, 15, 21] },
];

function tierIndexForValue(exercise, value) {
  if (value === undefined || value === null || value === "") return -1;
  let idx = -1;
  exercise.thresholds.forEach((t, i) => { if (value >= t) idx = i; });
  return idx; // -1 = below Bronze, 0..4 = tier reached
}

// Medal icon for Bronze/Silver/Gold, faceted gem for Platinum/Diamond -
// a consistent visual language that still escalates with rank.
function tierIconSvg(tierIndex, size = 24) {
  if (tierIndex < 0) return "";
  const tier = TIERS[tierIndex];
  const c = tier.color;
  if (tierIndex <= 2) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24">
      <circle cx="12" cy="13" r="8" fill="${c}"/>
      <circle cx="12" cy="13" r="8" fill="none" stroke="#00000030" stroke-width="1"/>
      <path d="M9 3 L7 9 L12 13 L17 9 L15 3 Z" fill="${c}" opacity="0.85"/>
      <path d="M12 8.5 L14 12 L12 17 L10 12 Z" fill="#FFFFFF" opacity="0.9"/>
    </svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24">
    <path d="M12 2 L20 9 L12 22 L4 9 Z" fill="${c}"/>
    <path d="M12 2 L20 9 L12 12 Z" fill="#FFFFFF" opacity="0.35"/>
    <path d="M4 9 L12 12 L12 22 Z" fill="#000000" opacity="0.12"/>
    <path d="M12 2 L4 9 L12 12 Z" fill="#FFFFFF" opacity="0.15"/>
  </svg>`;
}

// ---------- date helpers ----------
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoToDate(iso) { return new Date(iso + "T00:00:00"); }
function addDaysISO(iso, days) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ---------- streak / stats helpers ----------
function currentStreak(habit) {
  const done = new Set(habit.completions || []);
  let day = todayISO();
  if (!done.has(day)) day = addDaysISO(day, -1);
  let streak = 0;
  while (done.has(day)) {
    streak++;
    day = addDaysISO(day, -1);
  }
  return streak;
}
function longestStreak(habit) {
  const days = (habit.completions || []).slice().sort();
  if (!days.length) return 0;
  let longest = 1, cur = 1;
  for (let i = 1; i < days.length; i++) {
    if (addDaysISO(days[i - 1], 1) === days[i]) cur++;
    else cur = 1;
    longest = Math.max(longest, cur);
  }
  return longest;
}
function completionRate(habit) {
  const created = isoToDate(habit.createdAt.slice(0, 10));
  const days = Math.max(1, Math.floor((Date.now() - created.getTime()) / 86400000) + 1);
  return Math.min(1, (habit.completions || []).length / days);
}

function habitCategories(h) {
  if (Array.isArray(h.categories)) return h.categories;
  if (h.category) return [h.category];
  return [];
}

function categoryScore(categoryKey) {
  const habits = activeHabits().filter(h => habitCategories(h).includes(categoryKey));
  if (!habits.length) return 0;
  const scores = habits.map(h => {
    const rate = completionRate(h);               // 0-1
    const streakFactor = Math.min(1, currentStreak(h) / 30); // 0-1, caps at 30-day streak
    return (rate * 0.6 + streakFactor * 0.4) * 100;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ---------- persistence ----------
function commit() {
  state.updatedAt = Date.now();
  scheduleSync(state);
  renderAll();
}

// ---------- rendering ----------
function renderAll() {
  renderToday();
  renderHabitsList();
  renderJournal();
  renderStats();
  renderPentagon();
  renderWorkout();
}

// ---------- pentagon chart ----------
function renderPentagon() {
  const svg = document.getElementById("pentagon-svg");
  svg.setAttribute("viewBox", "0 0 300 280");
  const cx = 150, cy = 148, maxR = 68;
  const n = CATEGORIES.length;
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const scores = CATEGORIES.map(c => categoryScore(c.key));
  const hasAny = scores.some(s => s > 0);
  document.getElementById("pentagon-hint").hidden = hasAny;

  function pointAt(i, r) {
    const a = angleFor(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  let svgContent = "";

  // background rings at 25/50/75/100%
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    const pts = CATEGORIES.map((_, i) => pointAt(i, maxR * frac).join(",")).join(" ");
    svgContent += `<polygon points="${pts}" fill="none" stroke="var(--divider)" stroke-width="1"/>`;
  });

  // spokes
  CATEGORIES.forEach((_, i) => {
    const [x, y] = pointAt(i, maxR);
    svgContent += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--divider)" stroke-width="1"/>`;
  });

  // data polygon
  const dataPts = CATEGORIES.map((c, i) => pointAt(i, maxR * (scores[i] / 100)).join(",")).join(" ");
  svgContent += `<polygon points="${dataPts}" fill="var(--ember)" fill-opacity="0.28" stroke="var(--ember)" stroke-width="2"/>`;

  // dots
  CATEGORIES.forEach((c, i) => {
    const [x, y] = pointAt(i, maxR * (scores[i] / 100));
    svgContent += `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--ember)"/>`;
  });

  // labels - abbreviated + custom names, clamped anchor, generous margin
  CATEGORIES.forEach((c, i) => {
    const [x, y] = pointAt(i, maxR + 34);
    const anchor = Math.abs(x - cx) < 6 ? "middle" : (x > cx ? "start" : "end");
    const label = categoryShortLabel(c.key);
    svgContent += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="12" fill="var(--text-secondary)" font-family="var(--font-body)">${escapeHtml(label)}</text>`;
    svgContent += `<text x="${x}" y="${y + 15}" text-anchor="${anchor}" font-size="13" font-weight="700" fill="var(--text)" font-family="var(--font-rounded)">${scores[i]}</text>`;
  });

  svg.innerHTML = svgContent;
}

// ---------- workout tab ----------
function overallRankIndex() {
  const logged = EXERCISES
    .map(e => tierIndexForValue(e, state.workoutPBs?.[e.key]?.best))
    .filter(i => i >= 0);
  if (!logged.length) return -1;
  return Math.round(logged.reduce((a, b) => a + b, 0) / logged.length);
}

function renderWorkout() {
  state.workoutPBs = state.workoutPBs || {};
  const overallIdx = overallRankIndex();
  const badge = document.getElementById("rank-badge-lg");
  const title = document.getElementById("rank-title");
  const sub = document.getElementById("rank-sub");

  if (overallIdx >= 0) {
    const tier = TIERS[overallIdx];
    badge.innerHTML = tierIconSvg(overallIdx, 32);
    badge.style.borderColor = tier.color;
    badge.style.background = tier.color + "22";
    title.textContent = `${tier.label} Rank`;
    sub.textContent = `Based on ${EXERCISES.filter(e => state.workoutPBs[e.key]).length} logged exercise(s)`;
  } else {
    badge.textContent = "—";
    badge.style.borderColor = "var(--divider)";
    badge.style.background = "var(--surface-2)";
    title.textContent = "Unranked";
    sub.textContent = "Log a result below to get ranked";
  }

  const list = document.getElementById("workout-list");
  list.innerHTML = EXERCISES.map(e => {
    const raw = state.workoutPBs[e.key];
    const pb = raw ? { best: raw.best ?? raw.value ?? 0, total: raw.total ?? raw.value ?? 0 } : null;
    const idx = pb ? tierIndexForValue(e, pb.best) : -1;
    const tier = idx >= 0 ? TIERS[idx] : null;
    const sub = pb
      ? `Best: ${pb.best} ${e.unit} · Total: ${pb.total} ${e.unit}`
      : `Not logged yet`;
    return `
      <div class="row" data-open-pb="${e.key}">
        <div class="row-icon" style="background:var(--surface-2)">${e.icon}</div>
        <div class="row-main">
          <div class="row-title">${e.name}</div>
          <div class="row-sub">${sub}</div>
        </div>
        ${tier ? `<span class="tier-pill" style="background:${tier.color}22;color:${tier.color};display:flex;align-items:center;gap:4px">${tierIconSvg(idx, 16)}${tier.label}</span>` : ""}
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-open-pb]").forEach(row => {
    row.addEventListener("click", () => openPbSheet(row.dataset.openPb));
  });
}

function openPbSheet(exerciseKey) {
  pendingExerciseKey = exerciseKey;
  const e = EXERCISES.find(x => x.key === exerciseKey);
  const pb = state.workoutPBs?.[exerciseKey];
  document.getElementById("pb-sheet-title").textContent = e.name;
  document.getElementById("pb-field-label").textContent = `How many did you just do? (${e.unit})`;
  const input = document.getElementById("pb-value-input");
  input.value = "";
  updatePbPreview();
  input.oninput = updatePbPreview;
  document.getElementById("pb-sheet-backdrop").hidden = false;
}
function updatePbPreview() {
  const e = EXERCISES.find(x => x.key === pendingExerciseKey);
  const val = Number(document.getElementById("pb-value-input").value);
  const existing = state.workoutPBs?.[pendingExerciseKey];
  const preview = document.getElementById("pb-tier-preview");
  if (!val) {
    preview.textContent = existing ? `Current best: ${existing.best} ${e.unit} · Total: ${existing.total} ${e.unit}` : "";
    return;
  }
  const projectedBest = Math.max(val, existing?.best || 0);
  const idx = tierIndexForValue(e, projectedBest);
  const isNewBest = val > (existing?.best || 0);
  preview.textContent = idx >= 0
    ? `${TIERS[idx].label} tier${isNewBest ? " — new personal best! 🎉" : ""}`
    : `Below Bronze (${e.thresholds[0]} ${e.unit} needed)`;
}
function closePbSheet() { document.getElementById("pb-sheet-backdrop").hidden = true; }
function savePbFromSheet() {
  const val = Number(document.getElementById("pb-value-input").value);
  if (!val || val <= 0) { closePbSheet(); return; }
  state.workoutPBs = state.workoutPBs || {};
  const existing = state.workoutPBs[pendingExerciseKey] || { best: 0, total: 0 };
  state.workoutPBs[pendingExerciseKey] = {
    best: Math.max(existing.best, val),
    total: existing.total + val,
    updatedAt: new Date().toISOString(),
  };
  closePbSheet();
  commit();
  showToast(val > existing.best ? "New personal best! 🎉" : "Logged");
}

function activeHabits() { return state.habits.filter(h => !h.archived).sort((a,b) => a.sortOrder - b.sortOrder); }

function renderToday() {
  const list = document.getElementById("today-list");
  const empty = document.getElementById("today-empty");
  const habits = activeHabits();
  document.getElementById("today-date").textContent =
    new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  list.innerHTML = "";
  empty.hidden = habits.length > 0;

  let doneCount = 0;
  habits.forEach(h => {
    const done = (h.completions || []).includes(todayISO());
    if (done) doneCount++;
    const streak = currentStreak(h);

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-icon" style="background:${h.color}22;color:${h.color}">${h.icon}</div>
      <div class="row-main">
        <div class="row-title">${escapeHtml(h.name)}</div>
        ${streak > 0 ? `<div class="row-sub">🔥 ${streak} day streak</div>` : ""}
      </div>
      <button class="check-btn ${done ? "done" : ""}" data-habit="${h.id}"></button>
    `;
    row.querySelector(".check-btn").addEventListener("click", () => toggleToday(h.id));
    list.appendChild(row);
  });

  const total = habits.length;
  const ring = document.getElementById("today-ring");
  const circumference = 169.6;
  const frac = total ? doneCount / total : 0;
  ring.style.strokeDashoffset = circumference - circumference * frac;
  ring.style.stroke = frac >= 1 && total > 0 ? "var(--sage)" : "var(--ember)";
  document.getElementById("today-ring-label").textContent = `${doneCount}/${total}`;
}

function toggleToday(habitId) {
  const h = state.habits.find(x => x.id === habitId);
  if (!h) return;
  h.completions = h.completions || [];
  const day = todayISO();
  const idx = h.completions.indexOf(day);
  if (idx >= 0) h.completions.splice(idx, 1);
  else h.completions.push(day);
  commit();
}

function renderHabitsList() {
  const activeList = document.getElementById("habits-active-list");
  const archivedList = document.getElementById("habits-archived-list");
  const archivedLabel = document.getElementById("archived-label");

  const active = activeHabits();
  const archived = state.habits.filter(h => h.archived);

  activeList.innerHTML = active.map(h => `
    <div class="row">
      <div class="row-icon" style="background:${h.color}22;color:${h.color}">${h.icon}</div>
      <div class="row-main"><div class="row-title">${escapeHtml(h.name)}</div></div>
      <span class="row-percent">${Math.round(completionRate(h) * 100)}%</span>
      <button class="row-action" data-edit="${h.id}">Edit</button>
      <button class="row-action muted" data-archive="${h.id}">Archive</button>
      <button class="row-action danger" data-delete-active="${h.id}">Delete</button>
    </div>
  `).join("") || `<div class="row"><div class="row-sub">No active habits</div></div>`;

  archivedLabel.hidden = archived.length === 0;
  archivedList.innerHTML = archived.map(h => `
    <div class="row">
      <div class="row-main"><div class="row-title" style="opacity:.6">${escapeHtml(h.name)}</div></div>
      <button class="row-action" data-restore="${h.id}">Restore</button>
      <button class="row-action muted" data-delete="${h.id}">Delete</button>
    </div>
  `).join("");

  activeList.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openHabitSheet(b.dataset.edit)));
  activeList.querySelectorAll("[data-archive]").forEach(b => b.addEventListener("click", () => {
    const h = state.habits.find(x => x.id === b.dataset.archive);
    h.archived = true; commit();
  }));
  activeList.querySelectorAll("[data-delete-active]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Delete this habit and all its history? This can't be undone.")) return;
    state.habits = state.habits.filter(x => x.id !== b.dataset.deleteActive);
    commit();
  }));
  archivedList.querySelectorAll("[data-restore]").forEach(b => b.addEventListener("click", () => {
    const h = state.habits.find(x => x.id === b.dataset.restore);
    h.archived = false; commit();
  }));
  archivedList.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Delete this habit and all its history?")) return;
    state.habits = state.habits.filter(x => x.id !== b.dataset.delete);
    commit();
  }));
}

function renderJournal() {
  const list = document.getElementById("journal-list");
  const empty = document.getElementById("journal-empty");
  const entries = state.journal.slice().sort((a, b) => b.date.localeCompare(a.date));
  empty.hidden = entries.length > 0;
  const moodEmoji = ["😞","😕","😐","🙂","😄"];

  list.innerHTML = entries.map(e => `
    <div class="journal-card">
      <div class="journal-card-head">
        <span class="journal-date">${isoToDate(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <span style="display:flex;align-items:center;gap:10px">
          <span>${moodEmoji[e.mood - 1]}</span>
          <button class="row-action danger" data-delete-journal="${e.id}" style="padding:0">Delete</button>
        </span>
      </div>
      <div class="journal-text">${escapeHtml(e.text) || "<em>No notes</em>"}</div>
    </div>
  `).join("");

  list.querySelectorAll("[data-delete-journal]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Delete this journal entry?")) return;
    state.journal = state.journal.filter(x => x.id !== b.dataset.deleteJournal);
    commit();
  }));
}

function renderStats() {
  const habits = activeHabits();
  const totalPoints = habits.reduce((sum, h) => sum + (h.completions || []).length, 0);
  const best = habits.reduce((m, h) => Math.max(m, longestStreak(h)), 0);

  document.getElementById("stat-points").textContent = totalPoints;
  document.getElementById("stat-best-streak").textContent = best;
  document.getElementById("stat-active").textContent = habits.length;

  const list = document.getElementById("stats-list");
  list.innerHTML = habits.map(h => {
    const pct = Math.round(completionRate(h) * 100);
    return `
      <div class="row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="row-icon" style="background:${h.color}22;color:${h.color}">${h.icon}</div>
          <div class="row-main"><div class="row-title">${escapeHtml(h.name)}</div></div>
          <span class="row-percent">${pct}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${h.color}"></div></div>
        <div class="row-sub">Current streak: ${currentStreak(h)} · Best: ${longestStreak(h)}</div>
      </div>
    `;
  }).join("") || `<div class="row"><div class="row-sub">No habits yet</div></div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- habit sheet ----------
function buildPickers() {
  const iconGrid = document.getElementById("icon-grid");
  iconGrid.innerHTML = ICONS.map(i => `<button data-icon="${i}">${i}</button>`).join("");
  iconGrid.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    pendingIcon = b.dataset.icon;
    highlightPickers();
  }));

  const colorGrid = document.getElementById("color-grid");
  colorGrid.innerHTML = COLORS.map(c => `<button data-color="${c}" style="background:${c}"></button>`).join("");
  colorGrid.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    pendingColor = b.dataset.color;
    highlightPickers();
  }));

  buildCategoryGrid();
}
function buildCategoryGrid() {
  const categoryGrid = document.getElementById("category-grid");
  categoryGrid.innerHTML = CATEGORIES.map(c => `<button data-category="${c.key}">${escapeHtml(categoryLabel(c.key))}</button>`).join("");
  categoryGrid.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    const key = b.dataset.category;
    const idx = pendingCategories.indexOf(key);
    if (idx >= 0) pendingCategories.splice(idx, 1);
    else pendingCategories.push(key);
    highlightPickers();
  }));
}
function highlightPickers() {
  document.querySelectorAll("#icon-grid button").forEach(b => b.classList.toggle("selected", b.dataset.icon === pendingIcon));
  document.querySelectorAll("#color-grid button").forEach(b => b.classList.toggle("selected", b.dataset.color === pendingColor));
  document.querySelectorAll("#category-grid button").forEach(b => b.classList.toggle("selected", pendingCategories.includes(b.dataset.category)));
}

function openHabitSheet(habitId) {
  pendingHabitId = habitId || null;
  const h = habitId ? state.habits.find(x => x.id === habitId) : null;
  document.getElementById("habit-sheet-title").textContent = h ? "Edit Habit" : "New Habit";
  document.getElementById("habit-name-input").value = h ? h.name : "";
  pendingIcon = h ? h.icon : ICONS[0];
  pendingColor = h ? h.color : COLORS[0];
  pendingCategories = h ? habitCategories(h) : [];
  buildCategoryGrid();
  highlightPickers();
  document.getElementById("habit-sheet-backdrop").hidden = false;
}
function closeHabitSheet() { document.getElementById("habit-sheet-backdrop").hidden = true; }

function saveHabitFromSheet() {
  const name = document.getElementById("habit-name-input").value.trim();
  if (!name) return;
  if (pendingHabitId) {
    const h = state.habits.find(x => x.id === pendingHabitId);
    h.name = name; h.icon = pendingIcon; h.color = pendingColor; h.categories = pendingCategories.slice();
    delete h.category;
  } else {
    state.habits.push({
      id: uid(), name, icon: pendingIcon, color: pendingColor, categories: pendingCategories.slice(),
      createdAt: new Date().toISOString(), archived: false,
      sortOrder: state.habits.length, completions: []
    });
  }
  closeHabitSheet();
  commit();
  showToast("Saved");
}

// ---------- journal sheet ----------
function openJournalSheet() {
  const existing = state.journal.find(e => e.date === todayISO());
  pendingMood = existing ? existing.mood : 3;
  document.getElementById("journal-text-input").value = existing ? existing.text : "";
  highlightMood();
  document.getElementById("journal-sheet-backdrop").hidden = false;
}
function closeJournalSheet() { document.getElementById("journal-sheet-backdrop").hidden = true; }
function highlightMood() {
  document.querySelectorAll("#mood-picker button").forEach(b => b.classList.toggle("selected", Number(b.dataset.mood) === pendingMood));
}
function saveJournalFromSheet() {
  const text = document.getElementById("journal-text-input").value.trim();
  const day = todayISO();
  let entry = state.journal.find(e => e.date === day);
  if (entry) { entry.text = text; entry.mood = pendingMood; }
  else state.journal.push({ id: uid(), date: day, text, mood: pendingMood });
  closeJournalSheet();
  commit();
  showToast("Saved");
}

// ---------- settings sheet ----------
function applyAccentColor(color) {
  document.documentElement.style.setProperty("--ember", color);
}

function openSettingsSheet() {
  state.settings = state.settings || { accentColor: COLORS[0], categoryLabels: {} };
  pendingAccentColor = state.settings.accentColor || COLORS[0];

  const colorGrid = document.getElementById("settings-color-grid");
  colorGrid.innerHTML = COLORS.map(c => `<button data-accent="${c}" style="background:${c}"></button>`).join("");
  colorGrid.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    pendingAccentColor = b.dataset.accent;
    highlightSettingsColor();
    applyAccentColor(pendingAccentColor); // live preview
  }));
  highlightSettingsColor();

  const catList = document.getElementById("settings-category-list");
  catList.innerHTML = CATEGORIES.map(c => `
    <div class="settings-category-row">
      <span>${c.label}</span>
      <input type="text" data-cat-key="${c.key}" value="${escapeHtml(state.settings.categoryLabels?.[c.key] || "")}" placeholder="${c.label}">
    </div>
  `).join("");

  document.getElementById("settings-sheet-backdrop").hidden = false;
}
function highlightSettingsColor() {
  document.querySelectorAll("#settings-color-grid button").forEach(b => b.classList.toggle("selected", b.dataset.accent === pendingAccentColor));
}
function closeSettingsSheet() {
  document.getElementById("settings-sheet-backdrop").hidden = true;
  applyAccentColor(state.settings?.accentColor || COLORS[0]); // revert preview if not saved
}
function saveSettingsFromSheet() {
  state.settings = state.settings || {};
  state.settings.accentColor = pendingAccentColor;
  state.settings.categoryLabels = state.settings.categoryLabels || {};
  document.querySelectorAll("#settings-category-list input").forEach(input => {
    const val = input.value.trim();
    if (val) state.settings.categoryLabels[input.dataset.catKey] = val;
    else delete state.settings.categoryLabels[input.dataset.catKey];
  });
  applyAccentColor(state.settings.accentColor);
  document.getElementById("settings-sheet-backdrop").hidden = true;
  commit();
  showToast("Settings saved");
}
function resetAllData() {
  if (!confirm("This deletes every habit, journal entry, and workout record on this device and in sync. This can't be undone. Continue?")) return;
  if (!confirm("Really sure? This is permanent.")) return;
  state = defaultState();
  applyAccentColor(COLORS[0]);
  commit();
  document.getElementById("settings-sheet-backdrop").hidden = true;
  showToast("All data cleared");
}

// ---------- toast ----------
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
}

// ---------- tabs ----------
function switchTab(name) {
  document.querySelectorAll("[data-screen]").forEach(s => s.hidden = s.id !== `screen-${name}`);
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
}

// ---------- wiring ----------
function wireEvents() {
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  document.getElementById("add-habit-btn").addEventListener("click", () => openHabitSheet(null));
  document.getElementById("habit-cancel").addEventListener("click", closeHabitSheet);
  document.getElementById("habit-save").addEventListener("click", saveHabitFromSheet);

  document.getElementById("add-journal-btn").addEventListener("click", openJournalSheet);
  document.getElementById("journal-cancel").addEventListener("click", closeJournalSheet);
  document.getElementById("journal-save").addEventListener("click", saveJournalFromSheet);
  document.querySelectorAll("#mood-picker button").forEach(b => b.addEventListener("click", () => {
    pendingMood = Number(b.dataset.mood);
    highlightMood();
  }));

  document.getElementById("pb-cancel").addEventListener("click", closePbSheet);
  document.getElementById("pb-save").addEventListener("click", savePbFromSheet);

  document.getElementById("open-settings-btn").addEventListener("click", openSettingsSheet);
  document.getElementById("settings-cancel").addEventListener("click", closeSettingsSheet);
  document.getElementById("settings-save").addEventListener("click", saveSettingsFromSheet);
  document.getElementById("reset-data-btn").addEventListener("click", resetAllData);
}

// ---------- boot ----------
(async function boot() {
  buildPickers();
  wireEvents();
  state = await initState();
  if (!state.habits) state = defaultState();
  state.settings = state.settings || { accentColor: COLORS[0], categoryLabels: {} };
  applyAccentColor(state.settings.accentColor || COLORS[0]);
  renderAll();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
})();

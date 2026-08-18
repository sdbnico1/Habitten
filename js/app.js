let state = { habits: [], journal: [], updatedAt: 0 };

const ICONS = ["✓", "🏃", "📖", "🛌", "💧", "🌿", "🏋️", "🧠", "🔥", "✏️", "☕", "🌙", "❤️", "☀️", "🎵", "🧘"];
const COLORS = ["#FF6A3D", "#5FD98A", "#4A90D9", "#F1C40F", "#9B59B6", "#1ABC9C", "#EC407A", "#E67E22"];

let pendingHabitId = null;
let pendingIcon = ICONS[0];
let pendingColor = COLORS[0];
let pendingMood = 3;

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
        <span>${moodEmoji[e.mood - 1]}</span>
      </div>
      <div class="journal-text">${escapeHtml(e.text) || "<em>No notes</em>"}</div>
    </div>
  `).join("");
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
}
function highlightPickers() {
  document.querySelectorAll("#icon-grid button").forEach(b => b.classList.toggle("selected", b.dataset.icon === pendingIcon));
  document.querySelectorAll("#color-grid button").forEach(b => b.classList.toggle("selected", b.dataset.color === pendingColor));
}

function openHabitSheet(habitId) {
  pendingHabitId = habitId || null;
  const h = habitId ? state.habits.find(x => x.id === habitId) : null;
  document.getElementById("habit-sheet-title").textContent = h ? "Edit Habit" : "New Habit";
  document.getElementById("habit-name-input").value = h ? h.name : "";
  pendingIcon = h ? h.icon : ICONS[0];
  pendingColor = h ? h.color : COLORS[0];
  highlightPickers();
  document.getElementById("habit-sheet-backdrop").hidden = false;
}
function closeHabitSheet() { document.getElementById("habit-sheet-backdrop").hidden = true; }

function saveHabitFromSheet() {
  const name = document.getElementById("habit-name-input").value.trim();
  if (!name) return;
  if (pendingHabitId) {
    const h = state.habits.find(x => x.id === pendingHabitId);
    h.name = name; h.icon = pendingIcon; h.color = pendingColor;
  } else {
    state.habits.push({
      id: uid(), name, icon: pendingIcon, color: pendingColor,
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
}

// ---------- boot ----------
(async function boot() {
  buildPickers();
  wireEvents();
  state = await initState();
  if (!state.habits) state = defaultState();
  renderAll();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
})();

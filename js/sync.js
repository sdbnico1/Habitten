// Local-first: every read/write hits localStorage instantly so the app
// never waits on the network. Supabase stores one JSON blob PER PROFILE
// (keyed by username), so friends sharing this same deployed app each
// get their own row - no progress ever mixes between people.

const PROFILE_KEY = "habitten_active_profile";

let supabaseClient = null;
if (CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.startsWith("PASTE_")) {
  supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

function sanitizeUsername(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40);
}
function getActiveProfile() {
  return localStorage.getItem(PROFILE_KEY) || "";
}
function setActiveProfile(username) {
  localStorage.setItem(PROFILE_KEY, username);
}
function clearActiveProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

function localKeyFor(username) {
  return `habitten_state_v1__${username}`;
}

function defaultState() {
  return { habits: [], journal: [], workoutPBs: {}, settings: { accentColor: "#FF6A3D", categoryLabels: {} }, updatedAt: 0 };
}

function loadLocal(username) {
  try {
    const raw = localStorage.getItem(localKeyFor(username));
    return raw ? JSON.parse(raw) : defaultState();
  } catch (e) {
    return defaultState();
  }
}

function saveLocal(username, state) {
  localStorage.setItem(localKeyFor(username), JSON.stringify(state));
}

let pushTimer = null;
function scheduleSync(username, state) {
  saveLocal(username, state);
  if (!supabaseClient) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushRemote(username, state), 1200);
}

async function pushRemote(username, state) {
  if (!supabaseClient) return;
  try {
    await supabaseClient
      .from("app_state")
      .upsert({ id: username, data: state, updated_at: new Date().toISOString() });
  } catch (e) {
    console.warn("Sync push failed (will retry on next change):", e);
  }
}

async function pullRemote(username) {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from("app_state")
      .select("data, updated_at")
      .eq("id", username)
      .maybeSingle();
    if (error || !data) return null;
    return { ...data.data, updatedAt: new Date(data.updated_at).getTime() };
  } catch (e) {
    console.warn("Sync pull failed, using local data:", e);
    return null;
  }
}

// Reconciles local vs remote on startup and returns the state to use.
async function initState(username) {
  const local = loadLocal(username);
  const remote = await pullRemote(username);
  if (remote && remote.updatedAt > (local.updatedAt || 0)) {
    saveLocal(username, remote);
    return remote;
  }
  return local;
}

// ---------- leaderboard (separate table, safe/minimal fields only) ----------
async function pushPublicStats(username, stats) {
  if (!supabaseClient) return;
  try {
    await supabaseClient
      .from("public_stats")
      .upsert({ username, ...stats, updated_at: new Date().toISOString() });
  } catch (e) {
    console.warn("Leaderboard sync failed:", e);
  }
}

async function fetchLeaderboard() {
  if (!supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from("public_stats")
      .select("username, total_points, best_streak, best_rank_index, workout_ranks")
      .order("total_points", { ascending: false });
    if (error || !data) return [];
    return data;
  } catch (e) {
    console.warn("Leaderboard fetch failed:", e);
    return [];
  }
}

// Local-first: every read/write hits localStorage instantly so the app
// never waits on the network. Supabase is just a single JSON blob synced
// in the background, last-write-wins by timestamp.

const LOCAL_KEY = "habitten_state_v1";
const ROW_ID = "default";

let supabaseClient = null;
if (CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.startsWith("PASTE_")) {
  supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

function defaultState() {
  return { habits: [], journal: [], workoutPBs: {}, settings: { accentColor: "#FF6A3D", categoryLabels: {} }, updatedAt: 0 };
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  } catch (e) {
    return defaultState();
  }
}

function saveLocal(state) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

let pushTimer = null;
function scheduleSync(state) {
  saveLocal(state);
  if (!supabaseClient) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushRemote(state), 1200);
}

async function pushRemote(state) {
  if (!supabaseClient) return;
  try {
    await supabaseClient
      .from("app_state")
      .upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() });
  } catch (e) {
    console.warn("Sync push failed (will retry on next change):", e);
  }
}

async function pullRemote() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from("app_state")
      .select("data, updated_at")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error || !data) return null;
    return { ...data.data, updatedAt: new Date(data.updated_at).getTime() };
  } catch (e) {
    console.warn("Sync pull failed, using local data:", e);
    return null;
  }
}

// Reconciles local vs remote on startup and returns the state to use.
async function initState() {
  const local = loadLocal();
  const remote = await pullRemote();
  if (remote && remote.updatedAt > (local.updatedAt || 0)) {
    saveLocal(remote);
    return remote;
  }
  return local;
}

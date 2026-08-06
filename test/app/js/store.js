/**
 * Persistence.
 *
 * localStorage, not IndexedDB: the app has to run straight off the disk, and a
 * file:// page gets an opaque origin where IndexedDB is unreliable. The whole
 * record for a few hundred cards is tens of kilobytes, so one JSON blob is
 * enough, and it makes export/import a one-liner.
 *
 * Three properties this file has to hold, each of which was measured failing:
 *
 *  1. **A write never destroys someone else's write.** `flush()` reads the key
 *     back and merges before storing. It used to stamp the whole key from a
 *     snapshot taken at page load, so a second tab left on the Today screen
 *     wiped eight answers on its way out.
 *  2. **A wrong-shaped payload is never fatal.** `sanitize()` type-checks every
 *     field and falls back per field; the old `{...EMPTY, ...parsed}` let a
 *     wrong-typed field override its own default and `log: 7` turned into a
 *     blank screen at the first `st.log.filter`.
 *  3. **Nothing is thrown away silently.** A payload that could not be read is
 *     copied to a backup key before the boot write lands on it, an import backs
 *     up what it replaces, and a failing localStorage is reported to the UI
 *     instead of only to the console.
 *
 * Writes stay synchronous and un-debounced: a deferred write loses the last
 * answer exactly when someone closes the tab after finishing.
 */

const KEY = 'iceland-theory:v1';
/** What was in KEY before an import replaced it. */
const BACKUP_KEY = `${KEY}.bak`;
/** A payload that could not be read, kept verbatim so it can be looked at. */
const REJECTED_KEY = `${KEY}.rejected`;

/**
 * Payload shape version, inside the payload — not only in the key name. Renaming
 * the key orphans every existing record with no way to notice; a field can be
 * migrated. `migrate()` below is the seam.
 */
const VERSION = 1;

const EMPTY = {
  version: VERSION,
  /** cardId → SM-2 state */
  sched: {},
  /** One entry per answer, ever. The dashboard and the error weighting read this. */
  log: [],
  /** Completed mock exams. */
  exams: [],
  /** The deck or paper being worked through right now, so a reload can resume it. */
  session: null,
  /** When `session` was last written, so a tab without one cannot clear one. */
  sessionAt: 0,
  /** When progress was last erased. A later erase voids an older tab's history. */
  resetAt: 0,
  settings: { theme: 'dark' },
};

const blankState = () => structuredClone(EMPTY);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * Answers are unioned across tabs by identity. Two tabs answering inside the
 * same millisecond would otherwise collapse into one entry, so each entry gets a
 * tab-local monotonic stamp.
 */
const TAB = Math.random().toString(36).slice(2, 8);
let seq = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Shape

/**
 * Coerce a parsed payload into the shape the app can run on, field by field.
 *
 * Unknown fields are carried through untouched: a payload written by a later
 * version has to survive a round trip through this one.
 *
 * @returns {{state: object, repaired: boolean}} `repaired` is true when
 *   anything had to be replaced or dropped — the caller keeps the original.
 */
function sanitize(input) {
  const out = blankState();
  if (!isObj(input)) return { state: out, repaired: input !== null && input !== undefined };

  let repaired = false;
  const drop = () => { repaired = true; };

  for (const [k, v] of Object.entries(input)) if (!(k in EMPTY)) out[k] = v;

  if ('version' in input) {
    if (Number.isInteger(input.version)) out.version = input.version;
    else drop();
  }

  if (isObj(input.sched)) {
    for (const [id, rec] of Object.entries(input.sched)) {
      if (isObj(rec)) out.sched[id] = rec;
      else drop();
    }
  } else if ('sched' in input) drop();

  if (Array.isArray(input.log)) {
    for (const e of input.log) {
      if (isObj(e)) out.log.push(e);
      else drop();
    }
  } else if ('log' in input) drop();

  if (Array.isArray(input.exams)) {
    for (const e of input.exams) {
      // A result with no date and no score is not a result: the dashboard
      // rendered `undefined/undefined` for one and threw on the date of another.
      if (isObj(e) && Number.isFinite(e.at) && Number.isFinite(e.total) && Number.isFinite(e.right)) out.exams.push(e);
      else drop();
    }
  } else if ('exams' in input) drop();

  const sess = sanitizeSession(input.session);
  if (sess === false) drop();
  else out.session = sess;
  out.sessionAt = num(input.sessionAt);
  out.resetAt = num(input.resetAt);

  if (isObj(input.settings)) {
    out.settings = { ...EMPTY.settings, ...input.settings };
    if (out.settings.theme !== 'dark' && out.settings.theme !== 'light') {
      out.settings.theme = EMPTY.settings.theme;
      drop();
    }
  } else if ('settings' in input && input.settings != null) drop();

  return { state: out, repaired };
}

/** `null` for "no session", `false` for "there was one and it was junk". */
function sanitizeSession(s) {
  if (s == null) return null;
  if (!isObj(s)) return false;
  const ids = Array.isArray(s.ids) ? s.ids.filter((id) => typeof id === 'string') : null;
  if (!ids || ids.length !== (s.ids ?? []).length || !ids.length) return false;
  if (typeof s.mode !== 'string') return false;
  const answers = Array.isArray(s.answers) ? s.answers.filter(isObj) : null;
  if (!answers || answers.length !== (s.answers ?? []).length) return false;
  return {
    mode: s.mode,
    ids,
    i: Number.isInteger(s.i) && s.i >= 0 ? s.i : 0,
    answers,
    deadline: Number.isFinite(s.deadline) ? s.deadline : null,
    startedAt: num(s.startedAt, Date.now()),
  };
}

/**
 * Bring an older payload up to VERSION.
 *
 * Nothing to do yet — v1 is the first version to be stamped and an unstamped
 * payload already has v1's shape — but the seam is here so that a future change
 * is a migration rather than an amnesia event. A payload from a *later* version
 * is left as it is; `sanitize()` keeps its known fields typed and carries the
 * rest through.
 */
function migrate(input) {
  if (!isObj(input)) return input;
  if (!Number.isInteger(input.version)) input.version = VERSION;
  // if (input.version === 1) { …reshape…; input.version = 2; }
  return input;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge
//
// Two tabs are one origin and one key, so every write is a merge. The semantics
// are per field, taken from what the field means:
//
//  · log      append-only, so union by identity (`seq`, else at+id+ms) and sort
//             by time. Losing an answer is the failure this exists to prevent.
//  · exams    the same, keyed on at+total+right.
//  · sched    one record per card, so keep whichever was reviewed later (`last`,
//             then `reviews`). Averaging two SM-2 records means nothing.
//  · settings last write wins; the writer is the newer side by definition.
//  · session  last write wins by `sessionAt`, so a tab that never started one
//             cannot clear another tab's half-finished paper.
//  · resetAt  an erase voids everything written before it — otherwise the other
//             tab's in-memory history flows straight back in on its next write.
//  · unknown  kept; the newer side wins a collision.

const logKey = (e) => (typeof e.seq === 'string' ? e.seq : `${num(e.at)}|${e.id}|${num(e.ms)}`);
const examKey = (e) => `${num(e.at)}|${num(e.total)}|${num(e.right)}`;

function unionBy(a, b, key) {
  const out = [];
  const seen = new Set();
  for (const e of [...a, ...b]) {
    const k = key(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out.sort((p, q) => num(p.at) - num(q.at));
}

function laterSched(x, y) {
  if (num(x.last) !== num(y.last)) return num(x.last) > num(y.last) ? x : y;
  return num(y.reviews) > num(x.reviews) ? y : x;
}

/** `b` is the more recent writer. Both sides must already be sanitized. */
function merge(a, b) {
  if (num(a.resetAt) !== num(b.resetAt)) {
    // Whichever side was erased later is authoritative; the other side's
    // history predates the erase.
    return structuredClone(num(b.resetAt) > num(a.resetAt) ? b : a);
  }
  const out = { ...a, ...b };
  out.version = Math.max(num(a.version, VERSION), num(b.version, VERSION));
  out.sched = { ...a.sched };
  for (const [id, rec] of Object.entries(b.sched)) {
    out.sched[id] = out.sched[id] ? laterSched(out.sched[id], rec) : rec;
  }
  out.log = unionBy(a.log, b.log, logKey);
  out.exams = unionBy(a.exams, b.exams, examKey);
  out.settings = { ...a.settings, ...b.settings };
  if (num(a.sessionAt) > num(b.sessionAt)) {
    out.session = a.session;
    out.sessionAt = num(a.sessionAt);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read and write

/** The error, if localStorage itself cannot be used at all. */
let storageBroken = null;
/** The error from the most recent failed write, or null. */
let writeFailed = null;
/** The stored payload had to be repaired at boot. */
let dataRepaired = false;
/** …and the original was kept verbatim. */
let keptRejected = false;
/** The exact text last written, so an unchanged key can skip the merge. */
let lastWritten = null;

const listeners = new Set();
const notify = () => { for (const fn of listeners) fn(); };

function readRaw() {
  try {
    return localStorage.getItem(KEY);
  } catch (e) {
    storageBroken = e;
    return null;
  }
}

/**
 * Keep a payload that could not be read.
 *
 * The boot write used to land on it within milliseconds — `load()` returned
 * EMPTY, `setTheme` flushed, and the only evidence of what went wrong was gone
 * before anyone could look at it.
 */
function keepRejected(raw) {
  dataRepaired = true;
  try {
    localStorage.setItem(REJECTED_KEY, raw);
    keptRejected = true;
  } catch { /* nothing else to try */ }
}

/** Parse and repair stored text. Returns null when there is nothing usable. */
function readState(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    keepRejected(raw);
    return null;
  }
  const { state: next, repaired } = sanitize(migrate(parsed));
  if (repaired) keepRejected(raw);
  return next;
}

function load() {
  const raw = readRaw();
  if (raw == null) return blankState();
  return readState(raw) ?? blankState();
}

let state = load();

function write(text) {
  try {
    localStorage.setItem(KEY, text);
    lastWritten = text;
    if (writeFailed) {
      writeFailed = null;
      notify();
    }
    return true;
  } catch (e) {
    console.warn('could not persist progress', e);
    if (!writeFailed) {
      writeFailed = e;
      // A silent failure means a whole session studied into a void: the student
      // finds out at the next reload, when it is far too late to export.
      notify();
    }
    return false;
  }
}

/**
 * Read–modify–write.
 *
 * The blind overwrite this replaces is measurable as total loss: open the app,
 * open it again, answer eight cards, close the *untouched* first tab, and its
 * `pagehide` flush put the key back to zero answers.
 */
function flush() {
  const raw = readRaw();
  if (raw != null && raw !== lastWritten) {
    const other = readState(raw);
    if (other) state = merge(other, state);
  }
  write(JSON.stringify(state));
}

const save = flush;

// Belt and braces for a tab that goes away mid-write. Harmless now that the
// write merges — before, this was the step that clobbered the other tab.
addEventListener('pagehide', flush);

/**
 * Another tab wrote. Converge instead of diverging: the event used to fire into
 * a listener that did not exist.
 */
addEventListener('storage', (ev) => {
  if (ev.key !== null && ev.key !== KEY) return;
  // A cleared or removed key is not adopted — our own history is the better
  // copy, and the next write restores it.
  const raw = ev.newValue ?? null;
  if (raw == null) return;
  const incoming = readState(raw);
  if (!incoming) return;
  state = merge(state, incoming);
  lastWritten = null;
  notify();
});

// ─────────────────────────────────────────────────────────────────────────────
// API

function get() {
  return state;
}

/** `{ok}` is false when nothing is reaching storage; the UI has to say so. */
function status() {
  return {
    ok: !storageBroken && !writeFailed,
    error: String((writeFailed ?? storageBroken)?.name ?? (writeFailed ?? storageBroken) ?? ''),
    repaired: dataRepaired,
    rejectedKey: keptRejected ? REJECTED_KEY : null,
    backupKey: BACKUP_KEY,
  };
}

function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function recordAnswer(card, correct, ms, mode) {
  state.log.push({
    id: card.id,
    topic: card.topic,
    doc: card.doc,
    type: card.type,
    correct: !!correct,
    ms,
    mode,
    at: Date.now(),
    seq: `${TAB}-${(seq += 1)}`,
  });
  save();
}

function setSchedule(cardId, sched) {
  state.sched[cardId] = sched;
  save();
}

function recordExam(result) {
  state.exams.push(result);
  save();
}

function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

/** The in-flight deck or paper. `null` clears it. */
function setSession(snapshot) {
  state.session = sanitizeSession(snapshot) || null;
  state.sessionAt = Date.now();
  save();
}

const clearSession = () => setSession(null);
const getSession = () => state.session;

function reset() {
  state = blankState();
  // Stamped, so another tab's merge does not put the history straight back.
  state.resetAt = Date.now();
  lastWritten = null;
  write(JSON.stringify(state));
}

function exportJson() {
  // A half-finished paper is not progress, and importing it elsewhere would
  // offer to resume a session that was never on this machine.
  const { session: _s, sessionAt: _a, ...rest } = state;
  return JSON.stringify(rest, null, 1);
}

/**
 * Reject a file for a stated reason, or return null.
 *
 * Deliberately strict: a field that is present with the wrong type is a broken
 * file, not something to quietly coerce. `{"sched":{},"log":5}` was accepted
 * before, persisted, and left the app unable to boot at all.
 */
function validate(p) {
  if (!isObj(p)) return 'that is not a progress file';
  if (!isObj(p.sched)) return 'it has no schedule';
  for (const [id, rec] of Object.entries(p.sched)) {
    if (!isObj(rec)) return `the schedule entry for ${id} is not a record`;
  }
  if ('log' in p) {
    if (!Array.isArray(p.log)) return 'its answer log is not a list';
    if (p.log.some((e) => !isObj(e))) return 'its answer log holds something that is not an answer';
  }
  if ('exams' in p) {
    if (!Array.isArray(p.exams)) return 'its mock exam list is not a list';
    if (p.exams.some((e) => !isObj(e))) return 'its mock exam list holds something that is not a result';
  }
  if ('settings' in p && !isObj(p.settings)) return 'its settings are not settings';
  if ('version' in p && !Number.isInteger(p.version)) return 'its version is not a number';
  if ('session' in p && p.session != null && !isObj(p.session)) return 'its saved session is not a session';
  return null;
}

/**
 * What replacing the current state would cost, for the confirmation prompt.
 *
 * `liveIds`, when given, restricts `cards` to schedule entries for cards still
 * in the deck — `Object.keys(state.sched).length` alone counts retired ids
 * forever, the same over-count the "Seen" tile had.
 */
function summary(liveIds) {
  const ids = Object.keys(state.sched);
  const cards = liveIds ? ids.filter((id) => liveIds.has(id)).length : ids.length;
  return { answers: state.log.length, exams: state.exams.length, cards };
}

/**
 * Validate the whole file, back up what is there, then replace — in that order.
 *
 * It used to test `'sched' in parsed` and then assign and flush, so a
 * twelve-byte `{"sched":{}}` erased a real history before deciding whether it
 * could read the file at all. Import is the one feature someone reaches for
 * *because* something has already gone wrong.
 */
function importJson(text) {
  const parsed = JSON.parse(text); // throws before anything has been touched
  const problem = validate(parsed);
  if (problem) throw new Error(problem);
  const next = sanitize(migrate(structuredClone(parsed))).state;

  const raw = readRaw();
  if (raw != null) {
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch { /* the import still goes ahead; it was validated */ }
  }

  // An import replaces rather than merges, so it is stamped like an erase or
  // another open tab would merge its own history back over the imported file.
  next.resetAt = Math.max(num(next.resetAt), num(state.resetAt), Date.now());
  next.session = null;
  next.sessionAt = num(state.sessionAt);
  state = next;
  lastWritten = null;
  write(JSON.stringify(state));
  return summary();
}

window.Store = {
  get, status, onChange, summary,
  recordAnswer, setSchedule, recordExam, setSetting,
  setSession, clearSession, getSession,
  reset, exportJson, importJson, flush,
  /** For tests and for looking at a rejected payload from the console. */
  KEY, BACKUP_KEY, REJECTED_KEY, VERSION,
};

/**
 * Views and session flow.
 *
 * Five screens share one session runner: review (what SM-2 says is due),
 * practice (weighted towards weak topics), signs (pictures only), exam (timed,
 * no feedback until the end) and stats.
 */

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
};

let DATA = { meta: {}, cards: [] };
let session = null;
let tick = null;

const TOPIC_LABEL = new Map();
const DOC_LABEL = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Presentation helpers

/**
 * Options are reshuffled every time a card is shown, so repeated review teaches
 * the answer rather than its position.
 */
function present(card) {
  // Cloze cards are typed, not chosen, so they carry no options to shuffle.
  if (!Array.isArray(card.options)) return { options: [], optionImgs: null, answer: -1 };
  const idx = card.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    options: idx.map((i) => card.options[i]),
    optionImgs: card.optionImgs ? idx.map((i) => card.optionImgs[i]) : null,
    answer: idx.indexOf(card.answer),
  };
}

const norm = (s) => s.toLowerCase().replace(/[\s.,]+/g, ' ').trim();

function clozeCorrect(card, typed) {
  const t = norm(typed);
  if (!t) return false;
  return card.accept.some((a) => norm(a) === t) || norm(card.answer) === t;
}

const fmtTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Height of the chrome pinned to the top of the viewport during a session. */
function stickyTop() {
  const head = $('header.top');
  const run = $('.runhead');
  return (head?.offsetHeight ?? 0) + (run?.offsetHeight ?? 0);
}

const toTop = () => window.scrollTo({ top: 0, behavior: 'auto' });

// ─────────────────────────────────────────────────────────────────────────────
// "See it in the book"

/**
 * The reading edition sits *beside* the app, at `../site/`, so a copied `app/`
 * folder — which opening the file straight from disk positively invites — has
 * nothing to link to and every citation opens a dead tab.
 *
 * `null` until the probe lands; links are optimistic until then, since the probe
 * resolves at boot, long before the first card is answered. A stylesheet is used
 * because it reports load and error on file:// as well as over http, and
 * `media="not all"` means it is fetched but never applied to this page.
 */
let bookReachable = null;

function probeBook() {
  const probe = el('link', { rel: 'stylesheet', media: 'not all', href: '../site/assets/style.css' });
  probe.addEventListener('load', () => { bookReachable = true; probe.remove(); });
  probe.addEventListener('error', () => {
    bookReachable = false;
    probe.remove();
    if (current === 'home') render();
  });
  document.head.append(probe);
}

/** The citation: a link when the book is there, plain text with a reason when not. */
function sourceLink(card) {
  if (bookReachable === false) {
    return el('span', {
      class: 'src', 'data-src': 'unreachable',
      title: `The HTML edition would be at ../site/${card.href}, and it is not next to this copy of the app.`,
    }, `In the book: ${DOC_LABEL.get(card.doc) || card.doc} — the site/ folder is not next to this app`);
  }
  return el('a', { class: 'src', href: `../site/${card.href}`, target: '_blank', rel: 'noreferrer' },
    'See it in the book →');
}

/**
 * Answering a sign card on a 667px phone put the whole verdict — and the Next
 * button with it — below the fold: the tap appeared to do nothing. The panel is
 * brought under the sticky header unless its first line is already comfortably
 * on screen.
 */
function revealFeedback() {
  const fb = $('.feedback');
  if (!fb) return;
  const offset = stickyTop() + 8;
  const floor = window.innerHeight - ($('.runfoot')?.offsetHeight ?? 0);
  const r = fb.getBoundingClientRect();
  // The verdict line is ~2.5rem tall; if that much is already in the clear,
  // moving the page would be noise.
  if (r.top >= offset - 2 && r.top + 40 <= floor) return;
  window.scrollTo({
    top: Math.max(0, window.scrollY + r.top - offset),
    behavior: reducedMotion() ? 'auto' : 'smooth',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Session runner

/**
 * The paper, in a form that survives a reload.
 *
 * A mock exam used to live in memory only, so a reload — or a back-tap, or
 * "Abandon exam" — lost the paper while leaving its twelve answers in the log,
 * where they dragged accuracy to 0% and never reached SM-2. The snapshot below is
 * written on every answer, which is affordable because it is ~2 kB and the app
 * already writes twice per answer.
 */
function snapshot() {
  if (!session || session.done) return null;
  return {
    mode: session.mode,
    ids: session.cards.map((c) => c.id),
    i: session.i,
    answers: session.answers.map((a) => ({
      id: a.card.id,
      correct: !!a.correct,
      ms: a.ms,
      choice: a.choice ?? null,
      typed: a.typed ?? null,
    })),
    deadline: session.deadline,
    startedAt: session.startedAt,
  };
}

const saveSession = () => window.Store.setSession(snapshot());

/**
 * A stored session, rebuilt against the current deck, or null.
 *
 * Card ids are the join, so a rebuilt deck that moved them cannot be resumed —
 * resuming half a paper against different questions would be worse than losing
 * it.
 */
function resumable() {
  const s = window.Store.getSession();
  if (!s) return null;
  const byId = new Map(DATA.cards.map((c) => [c.id, c]));
  const cards = s.ids.map((id) => byId.get(id));
  if (cards.some((c) => !c)) return null;
  const answers = s.answers
    .filter((a) => byId.has(a.id))
    .map((a) => ({ card: byId.get(a.id), correct: !!a.correct, ms: a.ms, choice: a.choice, typed: a.typed }));
  if (answers.length !== s.answers.length) return null;
  // A locked practice card has been answered but not advanced past; picking up at
  // the next unanswered card is the only place that cannot double-count.
  const i = Math.min(s.mode === 'exam' ? s.i : answers.length, cards.length);
  const left = s.deadline == null ? null : s.deadline - Date.now();
  return { mode: s.mode, cards, answers, i, deadline: s.deadline, startedAt: s.startedAt, left };
}

function resumeSession() {
  const r = resumable();
  if (!r) {
    window.Store.clearSession();
    render();
    return;
  }
  session = {
    mode: r.mode,
    cards: r.cards,
    i: Math.min(r.i, r.cards.length - 1),
    answers: r.answers,
    shownAt: Date.now(),
    startedAt: r.startedAt,
    deadline: r.deadline,
    current: present(r.cards[Math.min(r.i, r.cards.length - 1)]),
    locked: false,
  };
  // The clock is wall-clock, so a reload costs the candidate time rather than
  // pausing it. A paper whose time ran out while the tab was gone is scored
  // exactly as it would have been had the tab stayed open.
  if (r.i >= r.cards.length || (r.deadline != null && r.left <= 0)) {
    session.i = Math.min(r.i, r.cards.length - 1);
    finishSession();
    return;
  }
  route(r.mode === 'exam' ? 'exam' : 'run');
}

function discardSession() {
  window.Store.clearSession();
  session = null;
  render();
}

function startSession(mode, cards, opts = {}) {
  if (!cards.length) {
    render();
    return;
  }
  session = {
    mode,
    cards,
    i: 0,
    answers: [],
    shownAt: Date.now(),
    startedAt: Date.now(),
    deadline: opts.minutes ? Date.now() + opts.minutes * 60_000 : null,
    current: present(cards[0]),
    locked: false,
  };
  saveSession();
  route(mode === 'exam' ? 'exam' : 'run');
}

function answerCurrent(choice, typed) {
  if (!session || session.locked) return;
  const card = session.cards[session.i];
  const ms = Date.now() - session.shownAt;
  const correct =
    card.type === 'cloze' ? clozeCorrect(card, typed ?? '') : choice === session.current.answer;

  session.answers.push({ card, correct, ms, choice, typed });

  if (session.mode === 'exam') {
    // A mock's answers stay in the paper until it is submitted. Logging them as
    // they were given meant an abandoned paper left twelve answers in the history
    // with no exam record to explain them and no SM-2 review to show for them.
    // The paper itself is persisted, so nothing is at risk in the meantime.
    saveSession();
    // No feedback during a mock; that is the point of it.
    advance();
    return;
  }
  window.Store.recordAnswer(card, correct, ms, session.mode);
  // Practice and review both feed SM-2 — every answered card is a real review.
  const prior = window.Store.get().sched[card.id];
  window.Store.setSchedule(card.id, window.SM2.review(prior, window.SM2.gradeFor(correct, ms), Date.now()));
  session.locked = true;
  saveSession();
  render();
  requestAnimationFrame(revealFeedback);
}

function advance() {
  if (!session) return;
  session.i += 1;
  if (session.i >= session.cards.length) return finishSession();
  session.current = present(session.cards[session.i]);
  session.shownAt = Date.now();
  session.locked = false;
  saveSession();
  render();
  // The next card inherited the previous card's scroll offset, so its stem
  // started off the top of the screen.
  toTop();
}

function finishSession() {
  const s = session;
  if (!s) return;
  const right = s.answers.filter((a) => a.correct).length;
  if (s.mode === 'exam') {
    // Submitting is what turns a paper into history: the log, the schedule and
    // the exam record all land together, so they can never disagree.
    for (const a of s.answers) window.Store.recordAnswer(a.card, a.correct, a.ms, 'exam');
    window.Store.recordExam({
      at: Date.now(),
      total: s.cards.length,
      right,
      passed: right >= window.Engine.EXAM.passMark,
      elapsed: Date.now() - s.startedAt,
      wrong: s.answers.filter((a) => !a.correct).map((a) => a.card.id),
    });
    // Grading a mock only after it is submitted keeps the measurement clean, but
    // the answers are still real practice, so they still schedule.
    for (const a of s.answers) {
      const prior = window.Store.get().sched[a.card.id];
      window.Store.setSchedule(a.card.id, window.SM2.review(prior, window.SM2.gradeFor(a.correct, a.ms), Date.now()));
    }
  }
  session = { ...s, done: true };
  window.Store.clearSession();
  route('done');
}

function quitSession() {
  // A mock exam is the one session where stopping throws work away: its answers
  // are held in the paper until it is submitted. Practice and review have already
  // recorded and scheduled every answer, so stopping costs nothing.
  if (session?.mode === 'exam'
    && !confirm('Abandon this exam? The paper and the answers you have given are discarded — nothing is recorded.')) return;
  window.Store.clearSession();
  session = null;
  route('home');
}

// ─────────────────────────────────────────────────────────────────────────────
// Views

const MODE_LABEL = { exam: 'Mock exam', review: 'Review', practice: 'Practice', signs: 'Signs' };

/** The way back into a session a reload, a back-tap or a closed tab interrupted. */
function resumeCard() {
  const r = resumable();
  if (!r) return null;
  const left = r.cards.length - r.i;
  const expired = r.deadline != null && r.left <= 0;
  const label = MODE_LABEL[r.mode] ?? r.mode;
  return el('div', { class: 'card', 'data-resume': r.mode },
    el('div', { class: 'qmeta' }, el('span', { class: 'pill' }, 'unfinished')),
    el('div', {}, expired
      ? `${label} — time ran out while this was closed. ${r.answers.length} of ${r.cards.length} answered.`
      : `${label} — ${left} of ${r.cards.length} question${left === 1 ? '' : 's'} left`
        + (r.deadline != null ? `, ${fmtTime(r.left)} on the clock.` : '.')),
    el('div', { class: 'row', style: 'margin-top:.6rem' },
      el('button', { class: 'primary', 'data-act': 'resume', onclick: resumeSession },
        expired ? 'See the result' : 'Resume'),
      el('button', { class: 'ghost', 'data-act': 'discard', onclick: discardSession }, 'Discard'),
    ),
  );
}

function viewHome() {
  const st = window.Store.get();
  const now = Date.now();
  const due = window.Engine.dueCards(DATA.cards, st.sched, now);
  const seen = window.Engine.seenCount(DATA.cards, st.sched);
  const today = st.log.filter((e) => e.at > now - 86_400_000);
  const lastExam = st.exams[st.exams.length - 1];

  // A card that has never been seen is not "due for review" — on a fresh install
  // that reading makes the whole book look like a backlog you are already behind
  // on. New and due are counted, and worded, separately.
  const fresh = due.filter((c) => !st.sched[c.id]).length;
  const relearn = due.length - fresh;

  return [
    el('h1', {}, 'Today'),
    resumeCard(),
    relearn
      ? el('div', { class: 'duechip warn' }, '⚠', el('span', { class: 'n' }, String(relearn)), ' due for review')
      // the glyph needs its own element: adjacent bare text nodes collapse into one
      // anonymous flex item, so the chip's `gap` would not apply between them
      : el('div', { class: 'duechip calm' }, el('span', { class: 'g' }, '✓'), fresh ? `${fresh} new, nothing overdue` : 'all caught up'),
    el('p', { class: 'lede' }, relearn
      ? `${relearn} card${relearn === 1 ? '' : 's'} due for review.`
      : fresh
        ? `Nothing due yet — ${fresh} cards still to learn.`
        : 'Nothing due — everything is scheduled ahead.'),
    el('div', { class: 'tiles' },
      el('div', { class: 'tile' }, el('div', { class: 'n' }, String(relearn)), el('div', { class: 'k' }, 'Due')),
      el('div', { class: 'tile' }, el('div', { class: 'n' }, String(seen)), el('div', { class: 'k' }, 'Seen')),
      el('div', { class: 'tile' }, el('div', { class: 'n' }, String(DATA.cards.length)), el('div', { class: 'k' }, 'Total')),
      el('div', { class: 'tile' },
        el('div', { class: 'n' }, today.length ? `${pct(today.filter((e) => e.correct).length, today.length)}%` : '—'),
        el('div', { class: 'k' }, 'Today')),
    ),
    el('div', { class: 'actions' },
      el('button', { class: 'primary', disabled: due.length === 0, 'data-act': 'review',
        onclick: () => startSession('review', window.Engine.shuffled(due).slice(0, 30)) },
        el('span', { class: 'ic' }, '◈'),
        el('span', {}, el('span', { class: 't' }, relearn ? 'Review due cards' : 'Start learning'),
          el('span', { class: 's' }, due.length
            ? `${Math.min(due.length, 30)} of ${due.length} ${relearn ? 'scheduled' : 'new cards'}`
            : 'come back later'))),
      el('button', { 'data-act': 'practice', onclick: () => startPractice() },
        el('span', { class: 'ic' }, '◎'),
        el('span', {}, el('span', { class: 't' }, 'Practice'),
          el('span', { class: 's' }, 'weighted towards your weak topics'))),
      el('button', { 'data-act': 'exam', onclick: () => route('exam-intro') },
        el('span', { class: 'ic' }, '◍'),
        el('span', {}, el('span', { class: 't' }, 'Mock exam'),
          el('span', { class: 's' }, `${window.Engine.EXAM.questions} questions · ${window.Engine.EXAM.minutes} min · pass ${window.Engine.EXAM.passMark}`))),
    ),
    lastExam && el('div', { class: 'card' },
      el('div', { class: 'qmeta' }, el('span', { class: 'pill' }, 'last mock')),
      el('div', {}, `${lastExam.right}/${lastExam.total} — `,
        el('b', { style: `color:var(--${lastExam.passed ? 'ok' : 'bad'})` }, lastExam.passed ? 'pass' : 'fail')),
    ),
  ];
}

function startPractice() {
  const st = window.Store.get();
  startSession('practice', window.Engine.weighted(DATA.cards, st.log, st.sched, 20));
}

function viewSigns() {
  const signCards = DATA.cards.filter((c) => c.type === 'sign-to-meaning' || c.type === 'meaning-to-sign');
  const byCat = new Map();
  for (const c of signCards) {
    const list = byCat.get(c.category) || [];
    list.push(c);
    byCat.set(c.category, list);
  }
  const st = window.Store.get();

  return [
    el('h1', {}, 'Road signs'),
    el('p', { class: 'lede' },
      `${signCards.length} picture cards. Wrong answers are drawn from the same section of the official sheet, so the choices look alike — which is what the exam tests.`),
    el('div', { class: 'actions' },
      el('button', { class: 'primary', 'data-act': 'signs-all',
        onclick: () => startSession('signs', window.Engine.weighted(signCards, st.log, st.sched, 20)) },
        el('span', { class: 'ic' }, '⬗'),
        el('span', {}, el('span', { class: 't' }, 'Mixed signs'), el('span', { class: 's' }, 'both directions, 20 cards'))),
      ...[...byCat.entries()].sort((a, b) => b[1].length - a[1].length).map(([cat, list]) =>
        el('button', { onclick: () => startSession('signs', window.Engine.oneDirectionPerSign(window.Engine.shuffled(list)).slice(0, 20)) },
          el('span', { class: 'ic' }, '◇'),
          el('span', {}, el('span', { class: 't' }, cat),
            el('span', { class: 's' }, `${Math.min(20, list.length)} of ${list.length} cards · ${list.length / 2} signs, both directions`)))),
    ),
  ];
}

function viewExamIntro() {
  const e = window.Engine.EXAM;
  return [
    el('h1', {}, 'Mock exam'),
    el('p', { class: 'lede' },
      `${e.questions} questions in ${e.minutes} minutes. No feedback until you finish. You pass with ${e.passMark} correct.`),
    el('div', { class: 'card' },
      el('p', { class: 'note' },
        'This is the format of the Icelandic theory test as administered by Frumherji. The textbook does not state it, so treat it as the exam’s shape rather than something taken from the book.')),
    el('div', { class: 'row' },
      el('button', { class: 'primary', 'data-act': 'exam-start',
        onclick: () => startSession('exam', window.Engine.examSet(DATA.cards), { minutes: e.minutes }) }, 'Start exam'),
      el('button', { class: 'ghost', onclick: () => route('home') }, 'Cancel'),
    ),
  ];
}

function questionBody(card, cur, locked) {
  const nodes = [];
  nodes.push(el('div', { class: 'qmeta' },
    el('span', { class: 'pill' }, TOPIC_LABEL.get(card.topic) || card.topic),
    el('span', { class: 'pill' }, DOC_LABEL.get(card.doc) || card.doc),
  ));

  if (card.type === 'sign-to-meaning') {
    nodes.push(signbox(card.img, 'Road sign'));
  }

  if (card.type === 'cloze') {
    const parts = card.text.split('____');
    nodes.push(el('p', { class: 'qtext' }, parts[0], el('span', { class: 'blank' }, '____'), parts.slice(1).join('____')));
  } else {
    nodes.push(el('p', { class: 'qtext' }, card.question));
  }

  if (card.type === 'cloze') {
    const input = el('input', {
      class: 'opt', type: 'text', id: 'cloze-input', autocomplete: 'off',
      placeholder: 'Type the missing value', disabled: locked,
      onkeydown: (ev) => { if (ev.key === 'Enter') answerCurrent(null, input.value); },
    });
    nodes.push(input);
    if (!locked) nodes.push(el('div', { class: 'row', style: 'margin-top:.6rem' },
      el('button', { class: 'primary', 'data-act': 'submit', onclick: () => answerCurrent(null, input.value) }, 'Check')));
    setTimeout(() => input.focus(), 0);
  } else {
    const last = session.answers[session.answers.length - 1];
    // Picture options go in a 2×2 grid of large tiles; four 80px thumbnails in a
    // list left the pictograms and route plates too small to read.
    const opts = el('div', { class: `opts${cur.optionImgs ? ' pics' : ''}${locked ? ' locked' : ''}` },
      cur.options.map((text, i) => {
        const isAnswer = i === cur.answer;
        const chosen = locked && last && last.choice === i;
        const cls = locked && isAnswer ? ' correct' : locked && chosen ? ' wrong' : '';
        return el('button', { class: `opt${cls}`, 'data-opt': i, disabled: locked, onclick: () => answerCurrent(i) },
          el('span', { class: 'key' }, String.fromCharCode(65 + i)),
          cur.optionImgs ? el('img', { src: cur.optionImgs[i], alt: `Option ${String.fromCharCode(65 + i)}` }) : null,
          cur.optionImgs ? null : el('span', {}, text),
        );
      }));
    nodes.push(opts);
  }
  return nodes;
}

function viewRun() {
  if (!session) return [el('div', { class: 'empty' }, 'No session running.')];
  const card = session.cards[session.i];
  const cur = session.current;
  const locked = session.locked;
  const last = session.answers[session.answers.length - 1];

  const nodes = [
    runHead(
      el('span', {}, `${session.mode === 'signs' ? 'Signs' : session.mode === 'review' ? 'Review' : 'Practice'} · ${session.i + 1} of ${session.cards.length}`),
      el('button', { class: 'ghost icon spacer', 'data-act': 'quit', onclick: quitSession }, 'Stop'),
    ),
    el('div', { class: 'card' }, questionBody(card, cur, locked)),
  ];

  if (locked && last) {
    nodes.push(el('div', { class: `feedback ${last.correct ? 'right' : 'wrong'}`, 'data-fb': last.correct ? 'right' : 'wrong' },
      el('div', { class: 'verdict' }, last.correct ? 'Correct' : 'Wrong'),
      !last.correct && card.type === 'cloze' ? el('div', { class: 'why' }, `Answer: ${card.answer}`) : null,
      card.explanation ? el('div', { class: 'why' }, card.explanation) : null,
      sourceLink(card),
    ));
    // Pinned to the bottom on a phone, inline once there is room for it.
    nodes.push(el('div', { class: 'runfoot' }, el('div', { class: 'inner' },
      el('button', { class: 'primary', 'data-act': 'next', onclick: advance },
        session.i + 1 >= session.cards.length ? 'Finish' : 'Next'))));
  }
  return nodes;
}

/**
 * Progress counter, clock and progress bar in one block, so the whole thing can
 * be pinned under the header rather than scrolling away mid-question.
 */
function runHead(...bar) {
  return el('div', { class: 'runhead' },
    el('div', { class: 'runbar' }, ...bar),
    el('div', { class: 'progress' },
      el('i', { style: `width:${(session.answers.length / session.cards.length) * 100}%` })),
  );
}

function viewExam() {
  if (!session) return [el('div', { class: 'empty' }, 'No exam running.')];
  const left = Math.max(0, session.deadline - Date.now());
  return [
    runHead(
      el('span', {}, `Question ${session.i + 1} of ${session.cards.length}`),
      el('span', { class: `timer${left < 120_000 ? ' low' : ''}` }, fmtTime(left)),
    ),
    el('div', { class: 'card' }, questionBody(session.cards[session.i], session.current, false)),
    el('div', { class: 'row', style: 'margin-top:.7rem' },
      el('button', { class: 'ghost', 'data-act': 'quit', onclick: quitSession }, 'Abandon exam')),
  ];
}

/** One "here is what you should have known" card, used for every missed item. */
function missedCard(card, unanswered) {
  // Any sign card carries its picture, in both directions. Showing it only for
  // sign-to-meaning left "Which sign means X?" reviews with no sign at all —
  // just the question, then the same phrase twice.
  const isSign = card.type === 'sign-to-meaning' || card.type === 'meaning-to-sign';
  const answerText = card.type === 'cloze' ? card.answer : card.options[card.answer];
  return el('div', { class: 'card', 'data-missed': card.id },
    el('p', { class: 'qtext' }, card.type === 'cloze' ? card.text : card.question),
    unanswered ? el('p', { class: 'note' }, 'Not answered — you ran out of time.') : null,
    el('div', { class: 'feedback right' },
      isSign ? signbox(card.img, answerText) : null,
      el('div', { class: 'verdict' }, answerText),
      // For meaning-to-sign the generated explanation just repeats the stem.
      card.explanation && !card.question.includes(answerText)
        ? el('div', { class: 'why' }, card.explanation) : null,
      sourceLink(card)),
  );
}

function viewDone() {
  const s = session;
  if (!s) return [el('div', { class: 'empty' }, 'Nothing to show.')];
  const isExam = s.mode === 'exam';
  const right = s.answers.filter((a) => a.correct).length;
  // A timed-out paper is still a paper: score it out of the questions set, the
  // same denominator recordExam stores, or the headline and the history row
  // disagree.
  const total = isExam ? s.cards.length : s.answers.length;
  const passed = right >= window.Engine.EXAM.passMark;
  const skipped = isExam ? s.cards.slice(s.answers.length) : [];
  const missed = [
    ...s.answers.filter((a) => !a.correct).map((a) => ({ card: a.card, unanswered: false })),
    ...skipped.map((card) => ({ card, unanswered: true })),
  ];

  return [
    el('h1', {}, isExam ? (passed ? 'Passed' : 'Not passed') : 'Session complete'),
    el('p', { class: 'lede', 'data-score': `${right}/${total}` },
      `${right} of ${total} correct (${pct(right, total)}%)` +
      (isExam ? ` — pass mark is ${window.Engine.EXAM.passMark}.` : '.')),
    skipped.length
      ? el('p', { class: 'note', 'data-timeout': skipped.length },
          `Time ran out with ${skipped.length} question${skipped.length === 1 ? '' : 's'} unanswered; they count as wrong.`)
      : null,
    missed.length ? el('h2', {}, `Review ${missed.length} you missed`) : null,
    ...missed.map((m) => missedCard(m.card, m.unanswered)),
    el('div', { class: 'row', style: 'margin-top:1rem' },
      el('button', { class: 'primary', 'data-act': 'home', onclick: () => { session = null; route('home'); } }, 'Done')),
  ];
}

/** Below this many answers a percentage is noise, not a measurement. */
const ENOUGH = 5;

function bar(label, right, n) {
  const p = pct(right, n);
  const thin = n < ENOUGH;
  const cls = thin ? ' thin' : p >= 80 ? '' : p >= 60 ? ' mid' : ' low';
  return el('div', { class: `bar${thin ? ' faint' : ''}` },
    el('div', { class: 'lab', title: label }, label),
    el('div', { class: 'track' }, el('div', { class: `fill${cls}`, style: `width:${p}%` })),
    // Without the count, one lucky answer reads as "100%" and sorts to the top.
    el('div', { class: 'val' }, `${p}% · ${n}`),
  );
}

/** Weakest first, but only among topics with enough answers to mean anything. */
const rank = (a, b) => {
  const [an, bn] = [a[1].n, b[1].n];
  if ((an >= ENOUGH) !== (bn >= ENOUGH)) return an >= ENOUGH ? -1 : 1;
  return pct(a[1].right, an) - pct(b[1].right, bn);
};

function viewStats() {
  const st = window.Store.get();
  const { byTopic, byDoc } = window.Engine.stats(st.log);
  const total = st.log.length;
  const right = st.log.filter((e) => e.correct).length;

  const topics = [...byTopic.entries()].sort(rank);
  const docs = [...byDoc.entries()].sort(rank);

  return [
    el('h1', {}, 'Progress'),
    total === 0
      ? el('div', { class: 'empty' }, 'Answer some cards and your weak spots will show up here.')
      : el('div', { class: 'tiles' },
          el('div', { class: 'tile' }, el('div', { class: 'n' }, `${pct(right, total)}%`), el('div', { class: 'k' }, 'Accuracy')),
          el('div', { class: 'tile' }, el('div', { class: 'n' }, String(total)), el('div', { class: 'k' }, 'Answers')),
          el('div', { class: 'tile' }, el('div', { class: 'n' }, String(st.exams.length)), el('div', { class: 'k' }, 'Mocks')),
        ),
    topics.length ? el('h2', {}, 'By topic — weakest first') : null,
    topics.length ? el('div', { class: 'card' }, el('div', { class: 'bars' },
      topics.map(([t, v]) => bar(TOPIC_LABEL.get(t) || t, v.right, v.n)))) : null,
    docs.length ? el('h2', {}, 'By chapter') : null,
    docs.length ? el('div', { class: 'card' }, el('div', { class: 'bars' },
      docs.map(([d, v]) => bar(DOC_LABEL.get(d) || d, v.right, v.n)))) : null,
    st.exams.length ? el('h2', {}, 'Mock exams') : null,
    st.exams.length ? el('div', { class: 'card' }, el('table', { class: 'hist' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Score'), el('th', {}, 'Time'), el('th', {}, 'Result'))),
      el('tbody', {}, [...st.exams].reverse().map((x) => el('tr', {},
        el('td', {}, new Date(x.at).toLocaleDateString()),
        el('td', {}, `${x.right}/${x.total}`),
        el('td', {}, fmtTime(x.elapsed)),
        el('td', { class: x.passed ? 'pass' : 'fail' }, x.passed ? 'Pass' : 'Fail'),
      ))),
    )) : null,
    el('h2', {}, 'Progress data'),
    el('div', { class: 'card' },
      el('p', { class: 'note' }, 'Progress is stored in this browser only. Export it to keep a copy or move it to another device.'),
      el('div', { class: 'row' },
        el('button', { onclick: exportProgress }, 'Export'),
        el('button', { onclick: importProgress }, 'Import'),
        el('button', { class: 'ghost', onclick: resetProgress }, 'Reset'),
      )),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress data actions

function exportProgress() {
  const blob = new Blob([window.Store.exportJson()], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'iceland-theory-progress.json' });
  document.body.append(a);
  a.click();
  a.remove();
}

function importProgress() {
  const input = el('input', { type: 'file', accept: 'application/json' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const had = window.Store.summary(new Set(DATA.cards.map((c) => c.id)));
    try {
      const text = await file.text();
      // Say what is about to be lost. The import used to overwrite first and
      // decide afterwards whether it could read the file at all.
      if (had.answers || had.exams) {
        const ok = confirm(`Replace the progress in this browser — ${had.answers} answer${had.answers === 1 ? '' : 's'}`
          + ` and ${had.exams} mock exam${had.exams === 1 ? '' : 's'} — with the contents of ${file.name}?`
          + `\n\nA copy of the current progress is kept under “${window.Store.BACKUP_KEY}”.`);
        if (!ok) return;
      }
      const now = window.Store.importJson(text);
      setTheme(window.Store.get().settings.theme || 'dark');
      render();
      alert(`Imported ${now.answers} answers and ${now.exams} mock exam(s).`);
    } catch (e) {
      alert(`Could not read that file: ${e.message}.\n\nNothing was changed —`
        + ` your ${had.answers} stored answer${had.answers === 1 ? '' : 's'} are untouched.`);
    }
  });
  input.click();
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage notices
//
// Both of these were measured as completely silent: a throwing localStorage
// (quota, or Safari's private mode) let a whole session be studied into a void
// with nothing but a console warning, and a payload the app could not read was
// replaced by an empty one within milliseconds of opening it.

const NOTICE_STYLE = 'border:1px solid var(--warn);border-left-width:4px;border-radius:.55rem;'
  + 'background:var(--surface-2);box-shadow:var(--shadow-1);padding:.7rem .85rem';

function notice(title, body) {
  return el('div', { class: 'notice', style: NOTICE_STYLE, role: 'alert' },
    el('b', { style: 'color:var(--warn)' }, title),
    el('div', { class: 'note', style: 'margin-top:.15rem' }, body),
  );
}

function paintNotices() {
  const box = $('#notices');
  if (!box) return;
  const st = window.Store.status();
  const items = [];
  if (!st.ok) {
    items.push(notice('Progress is not being saved',
      `This browser refused to store anything${st.error ? ` (${st.error})` : ''}, so everything answered in this`
      + ' session will be gone at the next reload. Export your progress before closing the tab, or reopen the'
      + ' app outside private browsing.'));
  }
  if (st.repaired) {
    items.push(notice('Some saved progress could not be read',
      'The stored record was damaged and has been repaired as far as possible, so some history may be missing.'
      + (st.rejectedKey ? ` The original was kept verbatim under “${st.rejectedKey}” — nothing was thrown away.` : '')));
  }
  box.replaceChildren(...items);
  box.style.display = items.length ? 'grid' : 'none';
  box.style.gap = '.5rem';
  box.style.margin = items.length ? '.75rem 0 0' : '0';
}

function resetProgress() {
  if (!confirm('Erase all progress, schedules and mock results?')) return;
  window.Store.reset();
  render();
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing and shell

/**
 * Full-size look at a sign/marking crop. Road-marking scans especially are
 * low-contrast grey-on-grey at question size, so a plain image, not a
 * decorative button, is the fix — this just makes the existing crop bigger.
 */
let lightboxEl = null;
function openLightbox(src, alt) {
  if (!lightboxEl) return;
  $('img', lightboxEl).src = src;
  $('img', lightboxEl).alt = alt;
  lightboxEl.hidden = false;
}
function closeLightbox() { if (lightboxEl) lightboxEl.hidden = true; }
/** A signbox is a zoom trigger wherever the crop can be hard to read at question size. */
function signbox(src, alt) {
  return el('div', { class: 'signbox' },
    el('button', { type: 'button', 'aria-label': `Enlarge: ${alt}`, onclick: () => openLightbox(src, alt) },
      el('img', { src, alt })),
    el('span', { class: 'zoomhint' }, '🔍 Tap to enlarge'));
}

let current = 'home';
const TABS = [
  { id: 'home', label: 'Today', ic: '◈' },
  { id: 'signs', label: 'Signs', ic: '⬗' },
  { id: 'exam-intro', label: 'Exam', ic: '◍' },
  { id: 'stats', label: 'Progress', ic: '▤' },
];

function route(view) {
  current = view;
  if (!['run', 'exam', 'done'].includes(view)) session = view === 'exam-intro' ? session : null;
  render();
  window.scrollTo(0, 0);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  window.Store.setSetting('theme', theme);
  const b = $('#theme-toggle');
  if (b) {
    b.textContent = theme === 'dark' ? '☾' : '☀';
    b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

function render() {
  const body = {
    home: viewHome,
    signs: viewSigns,
    'exam-intro': viewExamIntro,
    stats: viewStats,
    run: viewRun,
    exam: viewExam,
    done: viewDone,
  }[current] || viewHome;

  const wrap = $('#view');
  wrap.replaceChildren(...body().filter(Boolean));
  paintNotices();

  const inSession = current === 'run' || current === 'exam';
  $('nav.tabs').hidden = inSession;
  for (const b of document.querySelectorAll('nav.tabs button')) {
    b.toggleAttribute('aria-current', b.dataset.view === current);
    if (b.dataset.view === current) b.setAttribute('aria-current', 'page');
  }

  clearInterval(tick);
  if (current === 'exam' && session?.deadline) {
    // Only the clock is repainted. Re-rendering the whole view once a second
    // would rebuild the question, and a cloze card's <input> would lose whatever
    // the candidate had typed within a second of typing it.
    tick = setInterval(() => {
      if (!session?.deadline) return clearInterval(tick);
      const left = session.deadline - Date.now();
      if (left <= 0) {
        clearInterval(tick);
        finishSession();
        return;
      }
      const t = $('.timer');
      if (t) {
        t.textContent = fmtTime(left);
        t.classList.toggle('low', left < 120_000);
      }
    }, 1000);
  }
}

function boot(data) {
  DATA = data;
  for (const t of data.meta.topics || []) TOPIC_LABEL.set(t.id, t.label);
  for (const d of data.meta.docs || []) DOC_LABEL.set(d.id, d.title);

  const nav = $('nav.tabs');
  nav.replaceChildren(...TABS.map((t) =>
    el('button', { 'data-view': t.id, onclick: () => route(t.id) },
      el('span', { class: 'ic' }, t.ic), el('span', {}, t.label))));

  const toggle = $('#theme-toggle');
  toggle.addEventListener('click', () =>
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  setTheme(window.Store.get().settings.theme || 'dark');

  // Outside #view, like #notices, so it survives every re-render and a running
  // exam's countdown never rebuilds it out from under an open lightbox.
  lightboxEl = el('button', { type: 'button', class: 'lightbox', 'aria-label': 'Close enlarged image', hidden: true, onclick: closeLightbox },
    el('img', { src: '', alt: '' }));
  document.body.appendChild(lightboxEl);
  probeBook();

  // Another tab wrote, or a save started failing. Repainting mid-question would
  // rebuild the card and lose whatever is typed into a cloze input, so a running
  // session only refreshes its notices.
  window.Store.onChange(() => {
    if (current === 'run' || current === 'exam') paintNotices();
    else render();
  });

  // Answer with the keyboard: A–D pick an option, Enter moves on.
  document.addEventListener('keydown', (ev) => {
    if (lightboxEl && !lightboxEl.hidden) { if (ev.key === 'Escape') closeLightbox(); return; }
    if (!session || session.done || ev.metaKey || ev.ctrlKey) return;
    if (document.activeElement?.id === 'cloze-input') return;
    const k = ev.key.toUpperCase();
    if (k >= 'A' && k <= 'D') {
      const i = k.charCodeAt(0) - 65;
      if (i < (session.current?.options.length ?? 0)) answerCurrent(i);
    } else if (ev.key === 'Enter' && session.locked) {
      advance();
    }
  });

  route('home');
}

window.UI = {
  boot, route, render, startSession, answerCurrent, advance, present, clozeCorrect,
  resumeSession, discardSession,
  /** Live session, for tests and for debugging from the console. */
  session: () => session,
};

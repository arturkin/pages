/**
 * SM-2, the SuperMemo 2 scheduler.
 *
 * Each card carries an ease factor, a repetition count and an interval in days.
 * A review grades recall 0–5; anything below 3 is a lapse and restarts the
 * interval, while the ease factor drifts up or down so that cards you find hard
 * come back sooner for good.
 */

const DAY = 86_400_000;
const MIN_EASE = 1.3;
const START_EASE = 2.5;

/** A card the scheduler has never seen. */
function fresh() {
  return { ease: START_EASE, reps: 0, interval: 0, due: 0, lapses: 0, reviews: 0 };
}

/**
 * Apply one review.
 *
 * @param {object|undefined} state prior scheduling state, or undefined if new
 * @param {number} quality 0–5 recall grade
 * @param {number} now epoch ms
 */
function review(state, quality, now) {
  const s = state ? { ...state } : fresh();
  const q = Math.max(0, Math.min(5, quality));

  if (q < 3) {
    // A lapse. SM-2 resets the repetition count and shows the card again today;
    // the ease penalty below makes the recovery slower each time it happens.
    s.reps = 0;
    s.interval = 0;
    s.lapses += 1;
    s.due = now;
  } else {
    if (s.reps === 0) s.interval = 1;
    else if (s.reps === 1) s.interval = 6;
    else s.interval = Math.round(s.interval * s.ease);
    s.reps += 1;
    s.due = now + s.interval * DAY;
  }

  s.ease = Math.max(MIN_EASE, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  s.reviews += 1;
  s.last = now;
  return s;
}

/**
 * Grade an objective answer.
 *
 * The user never self-reports here — every card is multiple choice or an exact
 * string, so correctness is known. Response time separates "knew it" from
 * "worked it out", which is the distinction SM-2's 4-vs-5 is for.
 */
function gradeFor(correct, ms) {
  if (!correct) return 2;
  if (ms < 8000) return 5;
  if (ms < 20000) return 4;
  return 3;
}

const isDue = (state, now) => !state || state.due <= now;

window.SM2 = { fresh, review, gradeFor, isDue, DAY };

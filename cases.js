// The words of a case: the state of each day, the steps and the summary. This file reads no page
// and no network, so the unit tests of tests/cases.test.js run it in Node.
//
// Eva answers eva/cases.json with the open cases, the most urgent first. The widget keeps that
// order. The words and the tones follow the Cases page of Eva (life-pages.ts in Eva's repository).

const dayMs = 86_400_000;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const exampleDatePattern = /^today(?:([+-])(\d+))?$/;

/**
 * How a kind of day reads. Up to `soonDays` days away, the day is near and takes the warn colour.
 * A late step still waits for the person, so it takes warn. A passed deadline lost something, so it
 * takes bad.
 */
const dueWording = {
  word: "Due",
  soonDays: 7,
  past: (days) => `Overdue by ${countOf(days, "day")}`,
  pastTone: "warn",
};
const deadlineWording = {
  word: "Deadline",
  soonDays: 14,
  past: () => "Deadline passed",
  pastTone: "bad",
};

/** "1 day" or "5 days". */
export function countOf(count, word) {
  return `${String(count)} ${count === 1 ? word : `${word}s`}`;
}

/** The day number of a `YYYY-MM-DD` date: days since 1970-01-01. NaN for any other text. */
function dayNumber(date) {
  const match = datePattern.exec(date);
  if (match === null) return Number.NaN;
  const [year, month, day] = match.slice(1).map(Number);
  const time = Date.UTC(year, month - 1, day);
  const back = new Date(time);
  // A date such as 2026-02-30 is not a day.
  if (back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return Number.NaN;
  return time / dayMs;
}

/** The `YYYY-MM-DD` date of a day number. */
function dateOf(dayNumberValue) {
  return new Date(dayNumberValue * dayMs).toISOString().slice(0, 10);
}

/** Today in the visitor's time zone, as `YYYY-MM-DD`. */
export function todayText(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

/** "1 Dec 2026", in the fixed English of Eva's pages. Any other text stays as written. */
export function dayWords(date) {
  const day = dayNumber(date);
  if (Number.isNaN(day)) return date;
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  return `${String(dayOfMonth)} ${months[month - 1]} ${String(year)}`;
}

/**
 * The state of a day at `today`, with words that say it, so the colour is never the only signal:
 * `{ words, tone, overdue, days }`. `tone` is `warn`, `bad` or `idle`. Null when there is no day.
 */
function dayState(date, today, wording) {
  if (typeof date !== "string" || date.trim() === "") return null;
  const day = dayNumber(date);
  const now = dayNumber(today);
  if (Number.isNaN(day) || Number.isNaN(now)) {
    return { words: `${wording.word} ${date}`, tone: "idle", overdue: false, days: null };
  }
  const days = day - now;
  if (days < 0) return { words: wording.past(-days), tone: wording.pastTone, overdue: true, days };
  const words =
    days === 0
      ? `${wording.word} today`
      : days === 1
        ? `${wording.word} tomorrow`
        : days <= wording.soonDays
          ? `${wording.word} in ${String(days)} days`
          : `${wording.word} ${dayWords(date)}`;
  return { words, tone: days <= wording.soonDays ? "warn" : "idle", overdue: false, days };
}

/** The state of the due day of a next step. */
export function dueState(date, today) {
  return dayState(date, today, dueWording);
}

/** The state of the deadline of a case. */
export function deadlineState(date, today) {
  return dayState(date, today, deadlineWording);
}

/**
 * The one day that a short card shows: the nearest of the step's due day and the deadline. A
 * passed deadline always wins, so a loss never hides behind a late step. On the same day, the
 * deadline wins too. Null when the case has no day.
 */
export function pillOf(item, today) {
  const due = dueState(item.nextStep?.dueDate ?? null, today);
  const deadline = deadlineState(item.deadline?.date ?? null, today);
  if (deadline === null) return due;
  if (due === null || deadline.overdue) return deadline;
  if (deadline.days === null) return due.days === null ? deadline : due;
  if (due.days === null) return deadline;
  return due.days < deadline.days ? due : deadline;
}

/** "2 of 5 steps", or null when the case has no steps. */
export function stepsWords(item) {
  const { stepsDone, stepsTotal } = item;
  if (!Number.isInteger(stepsDone) || !Number.isInteger(stepsTotal) || stepsTotal < 1) return null;
  return `${String(stepsDone)} of ${countOf(stepsTotal, "step")}`;
}

/** The count of the header. Empty with no case: the body says it. */
export function summaryWords(count) {
  return count === 0 ? "" : `${String(count)} open`;
}

function textOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function integerOrNull(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function objectOrNull(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}

/**
 * Eva's answer as a list of cases, in Eva's order. Null when Eva has no cases folder. Undefined
 * when the answer is not a list. An item with no title goes: there is nothing to show for it.
 */
export function casesOf(answer) {
  if (answer === null) return null;
  if (!Array.isArray(answer)) return undefined;
  return answer.flatMap((value) => {
    const item = objectOrNull(value);
    const title = textOrNull(item?.title);
    if (item === null || title === null) return [];
    const step = objectOrNull(item.nextStep);
    const stepText = textOrNull(step?.text);
    const deadline = objectOrNull(item.deadline);
    const deadlineDate = textOrNull(deadline?.date);
    const cost = textOrNull(deadline?.cost);
    return [
      {
        id: textOrNull(item.id) ?? title,
        title,
        nextStep:
          stepText === null
            ? null
            : { text: stepText, waitingFor: textOrNull(step.waitingFor), dueDate: textOrNull(step.dueDate) },
        deadline: deadlineDate === null && cost === null ? null : { date: deadlineDate, cost },
        stepsDone: integerOrNull(item.stepsDone),
        stepsTotal: integerOrNull(item.stepsTotal),
      },
    ];
  });
}

/** A date of the example file: `today`, `today+5` or `today-1`, as a date from `today`. */
function exampleDate(value, today) {
  const match = typeof value === "string" ? exampleDatePattern.exec(value) : null;
  if (match === null) return value;
  const offset = match[2] === undefined ? 0 : Number(match[2]) * (match[1] === "-" ? -1 : 1);
  return dateOf(dayNumber(today) + offset);
}

/**
 * The example cases with their dates counted from today. The mock file holds offsets, so the demo
 * always shows a late step, one due tomorrow and a later one. Eva's own answer never uses them.
 */
export function resolveExampleDates(list, today) {
  return list.map((item) => ({
    ...item,
    nextStep:
      item.nextStep === null || item.nextStep === undefined
        ? item.nextStep
        : { ...item.nextStep, dueDate: exampleDate(item.nextStep.dueDate, today) },
    deadline:
      item.deadline === null || item.deadline === undefined
        ? item.deadline
        : { ...item.deadline, date: exampleDate(item.deadline.date, today) },
  }));
}

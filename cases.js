// The words of a case: the state of each day, the steps and the summary. This file reads no page
// and no network, so the unit tests of tests/cases.test.js run it in Node.
//
// Eva answers eva/cases.json with the open cases, the most urgent first. The widget keeps that
// order. The words and the tones follow the Cases page of Eva (life-pages.ts in Eva's repository).

const dayMs = 86_400_000;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const casesFolder = "Life/Cases";
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
 * The vault path of a case, for Eva's `open` ask. Eva sends `path` since contract 3. Before that,
 * Eva's widget docs say that `id` is the folder name of the case in `Life/Cases`, so the path is
 * built from it. An id that is not a plain folder name gives no path: Eva would refuse it anyway.
 */
function pathOf(path, id) {
  if (path !== null) return path;
  if (id === null || !/^[^/\\.][^/\\]*$/.test(id)) return null;
  return `${casesFolder}/${id}`;
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
    const id = textOrNull(item.id);
    return [
      {
        id: id ?? title,
        title,
        nextStep:
          stepText === null
            ? null
            : { text: stepText, waitingFor: textOrNull(step.waitingFor), dueDate: textOrNull(step.dueDate) },
        deadline: deadlineDate === null && cost === null ? null : { date: deadlineDate, cost },
        stepsDone: integerOrNull(item.stepsDone),
        stepsTotal: integerOrNull(item.stepsTotal),
        path: pathOf(textOrNull(item.path), id),
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

// --- The menu of a case: what the widget asks Eva to do -----------------------------------------

/** The longest text of a `chat` ask that Eva takes (contract 3). */
export const askTextLimit = 2000;

/** A text cut to the limit of a chat ask, with an ellipsis when it is cut. */
function clip(text) {
  return text.length <= askTextLimit ? text : `${text.slice(0, askTextLimit - 1)}…`;
}

/** `"Fix the leak" (Life/Cases/leak)`: the case as a chat text names it. */
function caseName(item) {
  return item.path === null ? `"${item.title}"` : `"${item.title}" (${item.path})`;
}

/** The next step with who it waits for and its day: `Call the gym (waits for gym, due 9 Mar 2026)`. */
function stepWithDetails(step) {
  const details = [];
  if (step.waitingFor !== null) details.push(`waits for ${step.waitingFor}`);
  if (step.dueDate !== null) details.push(`due ${dayWords(step.dueDate)}`);
  return details.length === 0 ? step.text : `${step.text} (${details.join(", ")})`;
}

/** The text of "Start a chat about this case": the title, the next step and the path. */
export function chatAboutText(item) {
  const step =
    item.nextStep === null ? "It has no next step yet." : `The next step is: ${stepWithDetails(item.nextStep)}.`;
  return clip(`Let us talk about my case ${caseName(item)}. ${step}`);
}

/** The text of "Ask Eva to do the next step". Null when the case has no next step. */
export function nextStepHelpText(item) {
  if (item.nextStep === null) return null;
  return clip(
    `Help me with the next step of my case ${caseName(item)}: ${stepWithDetails(item.nextStep)}. Do what you can, and tell me what you need from me.`,
  );
}

/**
 * The text of "Mark the step as done…". The widget only reads, so it asks Eva in a chat, and the
 * person sends the text. Null when the case has no next step.
 */
export function markDoneText(item) {
  if (item.nextStep === null) return null;
  return clip(
    `I did the next step of my case ${caseName(item)}: ${item.nextStep.text}. Mark it as done in the case, and write down the new next step if there is one.`,
  );
}

/**
 * The entries of the menu of a case, for the asks that Eva allows (`["chat", "open"]`, from her
 * answer to `hello`). Each is `{ id, label, short, ask, path }` or `{ id, label, short, ask, text }`;
 * `short` is the label of the one-line menu of the header slot. Empty when
 * Eva allows nothing: then the case is not a button.
 */
export function menuEntries(item, allowed) {
  const entries = [];
  if (allowed.includes("open") && item.path !== null) {
    entries.push({ id: "open", label: "Open the case", short: "Open", ask: "open", path: item.path });
  }
  if (allowed.includes("chat")) {
    entries.push({
      id: "chat",
      label: "Start a chat about this case",
      short: "Chat",
      ask: "chat",
      text: chatAboutText(item),
    });
    const help = nextStepHelpText(item);
    if (help !== null)
      entries.push({ id: "help", label: "Ask Eva to do the next step", short: "Next step", ask: "chat", text: help });
    const done = markDoneText(item);
    if (done !== null)
      entries.push({ id: "done", label: "Mark the step as done…", short: "Done…", ask: "chat", text: done });
  }
  return entries;
}

// --- The overview of the large sizes ------------------------------------------------------------

/** True when the next step of the case waits for the person: it names nobody else. */
export function waitsForMe(item) {
  return item.nextStep !== null && item.nextStep.waitingFor === null;
}

/**
 * The statistics of the large sizes, only from the data that Eva sends: `{ open, overdue,
 * dueSoon, waitsForMe, waitsForOthers, nearestDeadline }`. `dueSoon` counts the steps due within
 * the days of the warn pill, from today. `nearestDeadline` is `{ item, state }` or null; a passed
 * deadline wins, as on the pill, so a loss never hides.
 */
export function caseStats(cases, today) {
  const stats = { open: cases.length, overdue: 0, dueSoon: 0, waitsForMe: 0, waitsForOthers: 0, nearestDeadline: null };
  for (const item of cases) {
    if (item.nextStep !== null) {
      if (item.nextStep.waitingFor === null) stats.waitsForMe += 1;
      else stats.waitsForOthers += 1;
      const due = dueState(item.nextStep.dueDate, today);
      if (due?.overdue) stats.overdue += 1;
      else if (due !== null && due.days !== null && due.days <= dueWording.soonDays) stats.dueSoon += 1;
    }
    const deadline = deadlineState(item.deadline?.date ?? null, today);
    if (deadline === null || deadline.days === null) continue;
    if (stats.nearestDeadline === null || deadline.days < stats.nearestDeadline.state.days) {
      stats.nearestDeadline = { item, state: deadline };
    }
  }
  return stats;
}

/**
 * The cases in groups, for a choice of the large sizes. `urgency`: one group with no title, in
 * Eva's order. `waiting`: the steps that wait for me, then one group for each other person in the
 * order Eva's cases first name them, then the cases with no next step. Each group keeps Eva's order.
 */
export function groupCases(cases, mode) {
  if (mode !== "waiting") return [{ key: "all", title: null, cases }];
  const groups = new Map([["me", { key: "me", title: "Waits for me", cases: [] }]]);
  const none = { key: "none", title: "No next step", cases: [] };
  for (const item of cases) {
    if (item.nextStep === null) {
      none.cases.push(item);
      continue;
    }
    const who = item.nextStep.waitingFor;
    const key = who === null ? "me" : `person:${who.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { key, title: `Waits for ${who.trim()}`, cases: [] });
    groups.get(key).cases.push(item);
  }
  return [...groups.values(), none].filter((group) => group.cases.length > 0);
}

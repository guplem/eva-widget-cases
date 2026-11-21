// The words of a case, in Node: the day words and tones, the steps and the example dates.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  askTextLimit,
  caseStats,
  casesOf,
  chatAboutText,
  dayWords,
  deadlineState,
  dueState,
  groupCases,
  markDoneText,
  menuEntries,
  nextStepHelpText,
  pillOf,
  resolveExampleDates,
  stepsWords,
  summaryWords,
  todayText,
  waitsForMe,
} from "../cases.js";

const today = "2026-03-10";

/** A case with these fields, and no dates by default. */
function aCase(fields = {}) {
  return {
    id: "a-case",
    title: "A case",
    nextStep: null,
    deadline: null,
    stepsDone: null,
    stepsTotal: null,
    ...fields,
  };
}

test("a step day reads as Eva's Cases page reads it", () => {
  assert.deepEqual(dueState("2026-03-10", today), { words: "Due today", tone: "warn", overdue: false, days: 0 });
  assert.deepEqual(dueState("2026-03-11", today), { words: "Due tomorrow", tone: "warn", overdue: false, days: 1 });
  assert.deepEqual(dueState("2026-03-15", today), { words: "Due in 5 days", tone: "warn", overdue: false, days: 5 });
  assert.deepEqual(dueState("2026-03-17", today), { words: "Due in 7 days", tone: "warn", overdue: false, days: 7 });
  assert.deepEqual(dueState("2026-03-18", today), { words: "Due 18 Mar 2026", tone: "idle", overdue: false, days: 8 });
});

test("a late step takes the warn colour: it still waits for the person", () => {
  assert.deepEqual(dueState("2026-03-09", today), { words: "Overdue by 1 day", tone: "warn", overdue: true, days: -1 });
  assert.deepEqual(dueState("2026-03-01", today), {
    words: "Overdue by 9 days",
    tone: "warn",
    overdue: true,
    days: -9,
  });
});

test("only a passed deadline takes the bad colour", () => {
  assert.deepEqual(deadlineState("2026-03-09", today), {
    words: "Deadline passed",
    tone: "bad",
    overdue: true,
    days: -1,
  });
  assert.deepEqual(deadlineState("2026-03-10", today).words, "Deadline today");
  assert.deepEqual(deadlineState("2026-03-24", today), {
    words: "Deadline in 14 days",
    tone: "warn",
    overdue: false,
    days: 14,
  });
  assert.equal(deadlineState("2026-03-25", today).words, "Deadline 25 Mar 2026");
  assert.equal(deadlineState("2026-03-25", today).tone, "idle");
});

test("the day count crosses a month and a change of the clock", () => {
  assert.equal(dueState("2026-04-01", "2026-03-28").days, 4);
  assert.equal(dueState("2026-10-26", "2026-10-24").days, 2);
});

test("a day that is not a whole date keeps its text, with no state", () => {
  assert.deepEqual(dueState("June 2026", today), { words: "Due June 2026", tone: "idle", overdue: false, days: null });
  assert.equal(dueState(null, today), null);
  assert.equal(dueState("", today), null);
});

test("day words use fixed English, as Eva's pages do", () => {
  assert.equal(dayWords("2026-12-01"), "1 Dec 2026");
  assert.equal(dayWords("Soon"), "Soon");
});

test("the pill shows the nearest day of the next step and the deadline", () => {
  const due = { text: "Call", waitingFor: null, dueDate: "2026-03-15" };
  assert.equal(pillOf(aCase({ nextStep: due }), today).words, "Due in 5 days");
  assert.equal(
    pillOf(aCase({ nextStep: due, deadline: { date: "2026-03-12", cost: null } }), today).words,
    "Deadline in 2 days",
  );
  assert.equal(pillOf(aCase({ deadline: { date: "2026-03-30", cost: "A fee" } }), today).words, "Deadline 30 Mar 2026");
  assert.equal(pillOf(aCase(), today), null);
});

test("a passed deadline wins over a late step, so the loss shows", () => {
  const late = { text: "Call", waitingFor: null, dueDate: "2026-03-01" };
  const pill = pillOf(aCase({ nextStep: late, deadline: { date: "2026-03-09", cost: null } }), today);
  assert.equal(pill.words, "Deadline passed");
  assert.equal(pill.tone, "bad");
});

test("on the same day, the deadline wins", () => {
  const step = { text: "Call", waitingFor: null, dueDate: "2026-03-12" };
  assert.equal(
    pillOf(aCase({ nextStep: step, deadline: { date: "2026-03-12", cost: null } }), today).words,
    "Deadline in 2 days",
  );
});

test("the steps read as a count, or nothing when the case has no steps", () => {
  assert.equal(stepsWords(aCase({ stepsDone: 2, stepsTotal: 5 })), "2 of 5 steps");
  assert.equal(stepsWords(aCase({ stepsDone: 0, stepsTotal: 1 })), "0 of 1 step");
  assert.equal(stepsWords(aCase()), null);
  assert.equal(stepsWords(aCase({ stepsDone: 1, stepsTotal: 0 })), null);
});

test("the summary counts the open cases", () => {
  assert.equal(summaryWords(1), "1 open");
  assert.equal(summaryWords(3), "3 open");
  assert.equal(summaryWords(0), "");
});

test("Eva's answer: null stays null, a list keeps Eva's order, and a broken item goes", () => {
  assert.equal(casesOf(null), null);
  assert.equal(casesOf({ cases: [] }), undefined);
  const list = casesOf([
    aCase({ id: "b", title: "Zebra" }),
    { id: "c" },
    "text",
    aCase({ id: "a", title: "Apple", nextStep: { text: "Call" } }),
  ]);
  assert.deepEqual(
    list.map((item) => item.title),
    ["Zebra", "Apple"],
  );
  assert.deepEqual(list[1].nextStep, { text: "Call", waitingFor: null, dueDate: null });
});

test("a field that Eva leaves out reads as null", () => {
  const [item] = casesOf([{ id: "x", title: "Only a title" }]);
  assert.deepEqual(item, {
    id: "x",
    title: "Only a title",
    nextStep: null,
    deadline: null,
    stepsDone: null,
    stepsTotal: null,
    path: "Life/Cases/x",
  });
});

test("the path of a case: Eva's own, else the folder of its id, else none", () => {
  const [sent, built, noId, unsafe] = casesOf([
    { id: "gym-refund", title: "Gym refund", path: "Life/Cases/gym-refund" },
    { id: "phone-repair", title: "Phone repair" },
    { title: "No id" },
    { id: "../secrets", title: "A strange id" },
  ]);
  assert.equal(sent.path, "Life/Cases/gym-refund");
  // Eva's docs: id is the folder name of the case, in Life/Cases.
  assert.equal(built.path, "Life/Cases/phone-repair");
  assert.equal(noId.path, null);
  assert.equal(noId.id, "No id");
  assert.equal(unsafe.path, null);
});

test("the example dates count from today, so the demo always has a late step", () => {
  const [item] = resolveExampleDates(
    [
      aCase({
        nextStep: { text: "Call", waitingFor: null, dueDate: "today-1" },
        deadline: { date: "today+12", cost: null },
      }),
    ],
    today,
  );
  assert.equal(item.nextStep.dueDate, "2026-03-09");
  assert.equal(item.deadline.date, "2026-03-22");
  const [same] = resolveExampleDates([aCase({ deadline: { date: "today", cost: null } })], "2026-12-31");
  assert.equal(same.deadline.date, "2026-12-31");
  const [next] = resolveExampleDates([aCase({ deadline: { date: "today+1", cost: null } })], "2026-12-31");
  assert.equal(next.deadline.date, "2027-01-01");
});

test("today is the local date", () => {
  assert.equal(todayText(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});

// --- The menu of a case ---------------------------------------------------------------------------

const step = { text: "Confirm the date with the plumber", waitingFor: "plumber", dueDate: "2026-03-09" };
const withStep = aCase({ id: "leak", title: "Fix the leak", nextStep: step, path: "Life/Cases/leak" });

test("the chat text names the case, its next step and its path", () => {
  assert.equal(
    chatAboutText(withStep),
    'Let us talk about my case "Fix the leak" (Life/Cases/leak). The next step is: Confirm the date with the plumber (waits for plumber, due 9 Mar 2026).',
  );
  assert.equal(
    chatAboutText(aCase({ title: "Tax return", path: null })),
    'Let us talk about my case "Tax return". It has no next step yet.',
  );
});

test("the help and done texts ask Eva about the next step", () => {
  assert.equal(
    nextStepHelpText(withStep),
    'Help me with the next step of my case "Fix the leak" (Life/Cases/leak): Confirm the date with the plumber (waits for plumber, due 9 Mar 2026). Do what you can, and tell me what you need from me.',
  );
  assert.equal(
    markDoneText(withStep),
    'I did the next step of my case "Fix the leak" (Life/Cases/leak): Confirm the date with the plumber. Mark it as done in the case, and write down the new next step if there is one.',
  );
  assert.equal(nextStepHelpText(aCase()), null);
  assert.equal(markDoneText(aCase()), null);
});

test("a text never passes the limit of Eva's chat asks", () => {
  const long = aCase({
    title: "A".repeat(3000),
    nextStep: { text: "B".repeat(3000), waitingFor: null, dueDate: null },
  });
  for (const text of [chatAboutText(long), nextStepHelpText(long), markDoneText(long)]) {
    assert.ok(text.length <= askTextLimit, `${String(text.length)} characters`);
    assert.ok(text.endsWith("…"));
  }
});

test("the menu offers only the entries that Eva allows and the case supports", () => {
  const ids = (item, allowed) => menuEntries(item, allowed).map((entry) => entry.id);
  assert.deepEqual(ids(withStep, ["chat", "open"]), ["open", "chat", "help", "done"]);
  assert.deepEqual(ids(withStep, ["chat"]), ["chat", "help", "done"]);
  assert.deepEqual(ids(withStep, ["open"]), ["open"]);
  assert.deepEqual(ids(withStep, []), []);
  assert.deepEqual(ids(aCase({ path: null }), ["chat", "open"]), ["chat"]);
  const [open, chat] = menuEntries(withStep, ["chat", "open"]);
  assert.deepEqual(open, { id: "open", label: "Open the case", ask: "open", path: "Life/Cases/leak" });
  assert.equal(chat.label, "Start a chat about this case");
  assert.equal(chat.ask, "chat");
  assert.equal(chat.text, chatAboutText(withStep));
});

// --- The overview of the large sizes ----------------------------------------------------------------

const list = [
  aCase({ id: "a", title: "A", nextStep: { text: "Call", waitingFor: null, dueDate: "2026-03-08" } }),
  aCase({
    id: "b",
    title: "B",
    nextStep: { text: "Wait", waitingFor: "Plumber", dueDate: "2026-03-12" },
    deadline: { date: "2026-03-20", cost: "A fee" },
  }),
  aCase({ id: "c", title: "C", nextStep: { text: "Send", waitingFor: null, dueDate: "2026-03-17" } }),
  aCase({ id: "d", title: "D", nextStep: { text: "Answer", waitingFor: "plumber ", dueDate: "2026-03-18" } }),
  aCase({ id: "e", title: "E", deadline: { date: "2026-03-15", cost: null } }),
  aCase({ id: "f", title: "F", nextStep: { text: "Ask", waitingFor: "Bank", dueDate: "2026-12" } }),
];

test("a case waits for me when its next step waits for nobody else", () => {
  assert.deepEqual(
    list.filter(waitsForMe).map((item) => item.id),
    ["a", "c"],
  );
});

test("the statistics count from the data and today", () => {
  const stats = caseStats(list, today);
  assert.equal(stats.open, 6);
  assert.equal(stats.overdue, 1);
  // Due within 7 days, as the warn pill: the 12th and the 17th. A month such as 2026-12 counts in none.
  assert.equal(stats.dueSoon, 2);
  assert.equal(stats.waitsForMe, 2);
  assert.equal(stats.waitsForOthers, 3);
  assert.equal(stats.nearestDeadline.item.id, "e");
  assert.equal(stats.nearestDeadline.state.words, "Deadline in 5 days");
});

test("a passed deadline is the nearest deadline, so a loss never hides", () => {
  const stats = caseStats(
    [...list, aCase({ id: "g", title: "G", deadline: { date: "2026-03-01", cost: null } })],
    today,
  );
  assert.equal(stats.nearestDeadline.item.id, "g");
  assert.equal(stats.nearestDeadline.state.tone, "bad");
  assert.equal(caseStats([aCase()], today).nearestDeadline, null);
});

test("by urgency keeps Eva's order in one group", () => {
  const groups = groupCases(list, "urgency");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, null);
  assert.deepEqual(
    groups[0].cases.map((item) => item.id),
    ["a", "b", "c", "d", "e", "f"],
  );
});

test("by who it waits for: me first, then each person in Eva's order, then no next step", () => {
  const groups = groupCases(list, "waiting");
  assert.deepEqual(
    groups.map((group) => [group.title, group.cases.map((item) => item.id)]),
    [
      ["Waits for me", ["a", "c"]],
      ["Waits for Plumber", ["b", "d"]],
      ["Waits for Bank", ["f"]],
      ["No next step", ["e"]],
    ],
  );
});

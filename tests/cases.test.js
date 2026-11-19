// The words of a case, in Node: the day words and tones, the steps and the example dates.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  casesOf,
  dayWords,
  deadlineState,
  dueState,
  pillOf,
  resolveExampleDates,
  stepsWords,
  summaryWords,
  todayText,
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
  });
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

// The widget talks to its host only through fetch to relative paths. Inside Eva, Eva answers
// eva/cases.json with the person's open cases. On GitHub Pages, that path answers 404, so the
// widget shows the mock cases of example/cases.json. See the contract:
// https://github.com/guplem/eva/blob/main/docs/widgets.md
import {
  casesOf,
  countOf,
  deadlineState,
  dueState,
  pillOf,
  resolveExampleDates,
  stepsWords,
  summaryWords,
  todayText,
} from "./cases.js";

const sizes = ["small", "medium", "large", "tall", "xlarge", "full"];
const detailedSizes = ["large", "xlarge", "full"];
/** The day words change at midnight, so the widget reads the cases again this often. */
const refreshMs = 10 * 60 * 1000;
const noCasesText =
  "A case is a matter with a start and an end, such as a claim, a refund or a move. Ask Eva in a chat to open one.";
const noOpenCasesText = "Each case is closed. Ask Eva in a chat to open a new one when something comes up.";

const root = document.querySelector(".widget");
const summaryElement = root.querySelector('[data-role="summary"]');
const bodyElement = root.querySelector('[data-role="body"]');

/** The icons, as the paths of a 24 by 24 outline. Drawn with the text colour. */
const icons = {
  alert: ["M12 3l10 18H2z", "M12 10v5M12 18v.5"],
  forward: ["M5 12h14M13 6l6 6-6 6"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21c1-4 4-6 8-6s7 2 8 6"],
  folder: ["M3 6h6l2 2h10v11H3z"],
  check: ["M5 12l5 5L20 7"],
};

function icon(name) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  for (const data of icons[name]) {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", data);
    svg.append(path);
  }
  return svg;
}

/** An element with a class and its children: text or other elements. */
function element(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className !== "") node.className = className;
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

/**
 * Eva's answer: `{ state: "list", cases, example }`, `{ state: "none" }` when Eva has no cases
 * folder, or `{ state: "failed" }`.
 */
async function loadCases() {
  let response;
  try {
    response = await fetch("eva/cases.json", { cache: "no-store" });
  } catch {
    return { state: "failed" };
  }
  // Inside Eva, this path always answers. Outside Eva, the mock cases answer.
  if (response.status === 404) return loadExample();
  if (!response.ok) return { state: "failed" };
  let cases;
  try {
    cases = casesOf(await response.json());
  } catch {
    return { state: "failed" };
  }
  if (cases === null) return { state: "none" };
  if (cases === undefined) return { state: "failed" };
  return { state: "list", cases, example: false };
}

async function loadExample() {
  try {
    const response = await fetch("example/cases.json", { cache: "no-store" });
    const cases = response.ok ? casesOf(await response.json()) : undefined;
    if (!Array.isArray(cases)) return { state: "failed" };
    return { state: "list", cases: resolveExampleDates(cases, todayText()), example: true };
  } catch {
    return { state: "failed" };
  }
}

/** A day with its state in words. A missed day also gets the alert icon, so the state has a shape. */
function pill(day) {
  const node = element("span", `pill ${day.tone}${day.overdue ? "" : " dot"}`, day.overdue ? icon("alert") : null);
  node.append(day.words);
  return node;
}

function line(iconName, className, text) {
  return element("span", `line ${className}`, icon(iconName), element("span", "", text));
}

/** The next step in one line, with who it waits for: the line of the short card. */
function stepLine(item) {
  if (item.nextStep === null) return line("forward", "step none", "No next step");
  const { text, waitingFor } = item.nextStep;
  return line("forward", "step", waitingFor === null ? text : `${text} · waits for ${waitingFor}`);
}

/** A case of the list of a tall or medium card: title, the nearest day and the next step. */
function shortCase(item, today) {
  const day = pillOf(item, today);
  return element(
    "li",
    "case",
    element("span", "case-top", element("b", "case-title", item.title), day === null ? null : pill(day)),
    stepLine(item),
  );
}

function stepsProgress(item) {
  const words = stepsWords(item);
  if (words === null) return null;
  const bar = document.createElement("progress");
  bar.max = item.stepsTotal;
  bar.value = Math.min(item.stepsDone, item.stepsTotal);
  bar.setAttribute("aria-hidden", "true");
  return element("span", "steps", bar, element("span", "", words));
}

/** A case of a large card: every part of the case, as the card of Eva's Cases page shows it. */
function fullCase(item, today) {
  const parts = [element("span", "case-top", element("b", "case-title", item.title)), stepsProgress(item)];
  const days = [];
  if (item.nextStep === null) {
    parts.push(line("forward", "step none", "No next step"));
  } else {
    parts.push(line("forward", "step", item.nextStep.text));
    if (item.nextStep.waitingFor !== null) parts.push(line("user", "waits", `Waits for ${item.nextStep.waitingFor}`));
    const due = dueState(item.nextStep.dueDate, today);
    if (due !== null) days.push(pill(due));
  }
  if (item.deadline !== null) {
    const deadline = deadlineState(item.deadline.date, today);
    const cost = item.deadline.cost;
    // The cost stays beside its deadline, so it reads as part of the deadline.
    days.push(
      element(
        "span",
        "deadline-group",
        deadline === null ? null : pill(deadline),
        cost === null ? null : element("span", "cost", deadline === null ? `Deadline: ${cost}` : cost),
      ),
    );
  }
  if (days.length > 0) parts.push(element("span", "pills", ...days));
  return element("li", "case", ...parts);
}

/** The small card: the most urgent case, its next step and a count of the others. */
function focusCase(cases, today) {
  const [first, ...rest] = cases;
  const day = pillOf(first, today);
  return element(
    "div",
    "focus",
    element("b", "case-title", first.title),
    day === null ? null : element("span", "pills", pill(day)),
    stepLine(first),
    element("span", "more", rest.length === 0 ? "No other open case" : `${countOf(rest.length, "more case")}`),
  );
}

/** A state with no case: what it means, and how to ask Eva for a first case. */
function emptyState(title, text) {
  return element("div", "empty", icon("folder"), element("strong", "", title), element("p", "", text));
}

function render(result) {
  const size = root.dataset.size;
  const today = todayText();
  if (result.state === "failed") {
    summaryElement.textContent = "";
    const retry = element("button", "retry", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => void refresh());
    bodyElement.replaceChildren(
      element(
        "div",
        "empty failed",
        icon("alert"),
        element("strong", "", "Eva could not read the cases."),
        element("p", "", "Check that Eva runs, then try again."),
        retry,
      ),
    );
    return;
  }
  if (result.state === "none") {
    summaryElement.textContent = "";
    bodyElement.replaceChildren(emptyState("No cases yet", noCasesText));
    return;
  }
  const { cases, example } = result;
  summaryElement.textContent =
    example && cases.length > 0 ? `${summaryWords(cases.length)} · example` : summaryWords(cases.length);
  if (cases.length === 0) {
    bodyElement.replaceChildren(emptyState("No open cases", noOpenCasesText));
    return;
  }
  if (size === "small") {
    bodyElement.replaceChildren(focusCase(cases, today));
    return;
  }
  const detailed = detailedSizes.includes(size);
  bodyElement.replaceChildren(
    element(
      "ul",
      detailed ? "cases detailed" : "cases",
      ...cases.map((item) => (detailed ? fullCase(item, today) : shortCase(item, today))),
    ),
  );
}

async function refresh() {
  render(await loadCases());
  // Tests wait for this flag: every part of the widget has its content now.
  root.dataset.ready = "true";
}

function start() {
  const size = new URLSearchParams(window.location.search).get("size");
  // Opened alone in a browser, the widget shows its full-screen view.
  root.dataset.size = sizes.includes(size) ? size : "full";
  void refresh();
  // A case that Eva changes in a chat shows when the page shows again, with no reload.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });
  setInterval(() => void refresh(), refreshMs);
}

start();

// The widget talks to its host only through fetch to relative paths. Inside Eva, Eva answers
// eva/cases.json with the person's open cases. On GitHub Pages, that path answers 404, so the
// widget shows the mock cases of example/cases.json. See the contract:
// https://github.com/guplem/eva/blob/main/docs/widgets.md
import { ask, hello } from "./asks.js";
import {
  caseStats,
  casesOf,
  countOf,
  deadlineState,
  dueState,
  groupCases,
  menuEntries,
  pillOf,
  resolveExampleDates,
  stepsWords,
  summaryWords,
  todayText,
  waitsForMe,
} from "./cases.js";

const sizes = ["small", "medium", "large", "tall", "xlarge", "full", "header"];
const detailedSizes = ["large", "xlarge", "full"];
/** The day words change at midnight, so the widget reads the cases again this often. */
const refreshMs = 10 * 60 * 1000;
const noCasesText =
  "A case is a matter with a start and an end, such as a claim, a refund or a move. Ask Eva in a chat to open one.";
const noOpenCasesText = "Each case is closed. Ask Eva in a chat to open a new one when something comes up.";

/** What a refused ask means for the person. */
const refusalText = {
  "not-allowed": "Eva does not allow this yet. Allow it in the widget's settings in Eva.",
  "no-tap": "Eva needs a tap for this. Try again.",
  "too-long": "The text is too long for Eva's message box.",
  "not-found": "Eva could not find this case.",
};
const noAnswerText = "Eva did not answer. Try again.";
/** The square at the top right that the widget contract keeps free for Eva's buttons. */
const corner = 56;
const menuMargin = 8;
/** A wide frame lower than this, such as the header slot, shows the menu as one row. */
const stripBelow = 180;

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
  open: ["M14 4h6v6", "M20 4l-9 9", "M18 14v6H4V6h6"],
  chat: ["M4 5h16v11H9l-5 4z"],
  spark: ["M12 3v5M12 16v5M3 12h5M16 12h5", "M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"],
};

/**
 * The state of the page: Eva's last answer, the asks that the person allowed, and the choices of
 * the large sizes. The choices stay in memory: a reload starts again from Eva's order.
 */
const state = { result: null, allowed: [], group: "urgency", mineOnly: false };

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
  return withMenu(
    element(
      "li",
      "case",
      element("span", "case-top", element("b", "case-title", item.title), day === null ? null : pill(day)),
      stepLine(item),
    ),
    item,
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
    const who = item.nextStep.waitingFor;
    parts.push(
      line("user", who === null ? "waits mine" : "waits", who === null ? "Waits for you" : `Waits for ${who}`),
    );
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
  return withMenu(element("li", "case", ...parts), item);
}

/** The small card: the most urgent case, its next step and a count of the others. */
function focusCase(cases, today) {
  const [first, ...rest] = cases;
  const day = pillOf(first, today);
  return withMenu(
    element(
      "div",
      "focus",
      element("b", "case-title", first.title),
      day === null ? null : element("span", "pills", pill(day)),
      stepLine(first),
      element("span", "more", rest.length === 0 ? "No other open case" : `${countOf(rest.length, "more case")}`),
    ),
    first,
  );
}

/**
 * The header slot beside Eva's greeting: one line with the most urgent case and its nearest day.
 * A taller frame, as on a phone, also shows the next step.
 */
function headlineCase(cases, today) {
  const [first] = cases;
  const day = pillOf(first, today);
  return withMenu(
    element(
      "div",
      "headline",
      element("span", "case-top", element("b", "case-title", first.title), day === null ? null : pill(day)),
      stepLine(first),
    ),
    first,
  );
}

/** A state with no case: what it means, and how to ask Eva for a first case. */
function emptyState(title, text) {
  return element("div", "empty", icon("folder"), element("strong", "", title), element("p", "", text));
}

// --- The menu of a case ---------------------------------------------------------------------------

/**
 * Makes the whole case a button that opens its menu, when Eva allows an entry for it. With no
 * entry, as outside Eva, the case stays plain text.
 */
function withMenu(container, item) {
  const entries = menuEntries(item, state.allowed);
  if (entries.length === 0) return container;
  const button = element("button", "case-button", ...container.childNodes);
  button.type = "button";
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", (event) => {
    // A click from the keyboard has no pointer: the menu goes under the case.
    const point = event.detail > 0 ? { x: event.clientX, y: event.clientY } : null;
    if (button.getAttribute("aria-expanded") === "true") closeMenu();
    else openMenu(button, item, entries, point);
  });
  container.classList.add("has-menu");
  container.append(button);
  return container;
}

let openState = null;

function closeMenu({ refocus = false } = {}) {
  if (openState === null) return;
  const { menu, button } = openState;
  openState = null;
  menu.remove();
  button.setAttribute("aria-expanded", "false");
  if (refocus && button.isConnected) button.focus();
}

/**
 * The place of the menu: at the tap, or under the case from the keyboard. It stays inside the
 * frame, and off the free corner at the top right.
 */
function placeMenu(menu, button, point) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const box = menu.getBoundingClientRect();
  const row = button.getBoundingClientRect();
  const anchor = point ?? { x: row.left + 12, y: row.bottom };
  const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
  let left = clamp(anchor.x - 12, menuMargin, width - box.width - menuMargin);
  let top = anchor.y + 4;
  if (top + box.height > height - menuMargin) top = (point === null ? row.top : anchor.y) - box.height - 4;
  top = clamp(top, menuMargin, height - box.height - menuMargin);
  if (top < corner && left + box.width > width - corner) {
    if (width - corner - box.width >= menuMargin) {
      left = width - corner - box.width;
    } else {
      // A card too narrow for the menu beside the corner: the menu goes under it, and scrolls.
      top = corner;
      menu.style.setProperty("max-height", `${String(height - corner - menuMargin)}px`);
    }
  }
  // Set from the code, not in the markup: Eva's Content Security Policy allows it.
  menu.style.setProperty("left", `${String(left)}px`);
  menu.style.setProperty("top", `${String(top)}px`);
}

function openMenu(button, item, entries, point) {
  closeMenu();
  // A frame too short for a list, such as the header slot, gets the menu as one row of short labels.
  const strip = window.innerHeight < stripBelow && window.innerWidth > 2 * window.innerHeight;
  const menu = element("div", strip ? "menu strip" : "menu");
  menu.setAttribute("role", "menu");
  if (strip) menu.setAttribute("aria-orientation", "horizontal");
  menu.setAttribute("aria-label", item.title);
  const entryIcons = { open: "open", chat: "chat", help: "spark", done: "check" };
  const items = entries.map((entry) => {
    const choice = element(
      "button",
      "menu-item",
      icon(entryIcons[entry.id]),
      element("span", "", strip ? entry.short : entry.label),
    );
    choice.type = "button";
    if (strip) choice.setAttribute("aria-label", entry.label);
    choice.setAttribute("role", "menuitem");
    choice.dataset.entry = entry.id;
    choice.addEventListener("click", () => {
      // The ask leaves in this click, so Eva sees the tap. Eva may move the focus to her message
      // box, so the focus stays where Eva puts it.
      const answer = ask(entry);
      closeMenu();
      void answer.then((result) => {
        if (!result.ok) refused(entry.ask, result.reason);
      });
    });
    return choice;
  });
  menu.append(...items);
  menu.addEventListener("keydown", (event) => {
    const index = items.indexOf(document.activeElement);
    const moves = {
      [strip ? "ArrowRight" : "ArrowDown"]: index + 1,
      [strip ? "ArrowLeft" : "ArrowUp"]: index - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      items[(moves[event.key] + items.length) % items.length].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ refocus: true });
    } else if (event.key === "Tab") {
      closeMenu({ refocus: true });
    }
  });
  root.append(menu);
  if (!strip) placeMenu(menu, button, point);
  button.setAttribute("aria-expanded", "true");
  openState = { menu, button };
  items[0].focus();
}

document.addEventListener("pointerdown", (event) => {
  if (openState !== null && !openState.menu.contains(event.target) && !openState.button.contains(event.target)) {
    closeMenu();
  }
});
// The menu sits at a fixed place, so it closes when the list under it moves.
document.addEventListener(
  "scroll",
  (event) => {
    if (openState !== null && !openState.menu.contains(event.target)) closeMenu();
  },
  true,
);
window.addEventListener("resize", () => closeMenu());

let noticeTimer;

/** A short note at the bottom of the widget, read by screen readers too. */
function notice(text) {
  let node = root.querySelector(".notice");
  if (node === null) {
    node = element("p", "notice");
    node.setAttribute("role", "status");
    root.append(node);
  }
  node.textContent = text;
  node.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    node.hidden = true;
  }, 6000);
}

/** Eva refused an ask. A type that she does not allow leaves the menus. */
function refused(type, reason) {
  notice(reason === "no-answer" ? noAnswerText : (refusalText[reason] ?? noAnswerText));
  if (reason === "not-allowed") {
    state.allowed = state.allowed.filter((allowed) => allowed !== type);
    render();
  }
}

// --- The overview of the large sizes ----------------------------------------------------------------

function stat(value, label, className = "") {
  return element(
    "li",
    `stat${className === "" ? "" : ` ${className}`}`,
    element("b", "stat-value", value),
    element("span", "stat-label", label),
  );
}

/** The statistics that help to pick what to do today. Only from the data that Eva sends. */
function statsList(cases, today) {
  const stats = caseStats(cases, today);
  const count = (value) => String(value);
  const parts = [
    stat(count(stats.overdue), "Overdue", stats.overdue > 0 ? "warn" : "zero"),
    stat(count(stats.dueSoon), "Due in 7 days", stats.dueSoon > 0 ? "" : "zero"),
    stat(count(stats.waitsForMe), "Wait for me", stats.waitsForMe > 0 ? "" : "zero"),
    stat(count(stats.waitsForOthers), "Wait for others", stats.waitsForOthers > 0 ? "" : "zero"),
  ];
  if (stats.nearestDeadline !== null) {
    const { item, state: day } = stats.nearestDeadline;
    parts.push(element("li", "stat nearest", pill(day), element("span", "stat-label", item.title)));
  }
  const list = element("ul", "stats", ...parts);
  list.setAttribute("aria-label", "Today at a glance");
  return list;
}

/** A button that stays pressed. `marked` adds a check when pressed, for a filter that stands alone. */
function toggle(label, pressed, control, onPress, marked = false) {
  const button = element("button", "toggle", pressed && marked ? icon("check") : null, element("span", "", label));
  button.type = "button";
  button.dataset.control = control;
  button.setAttribute("aria-pressed", String(pressed));
  button.addEventListener("click", () => {
    onPress();
    render();
    root.querySelector(`[data-control="${control}"]`)?.focus();
  });
  return button;
}

/** The choices of the list: its grouping, and the filter "Waits for me". */
function toolbar() {
  const grouping = element(
    "div",
    "segmented",
    toggle("By urgency", state.group === "urgency", "group-urgency", () => {
      state.group = "urgency";
    }),
    toggle("By who it waits for", state.group === "waiting", "group-waiting", () => {
      state.group = "waiting";
    }),
  );
  grouping.setAttribute("role", "group");
  grouping.setAttribute("aria-label", "Order of the cases");
  return element(
    "div",
    "toolbar",
    grouping,
    toggle(
      "Waits for me",
      state.mineOnly,
      "mine-only",
      () => {
        state.mineOnly = !state.mineOnly;
      },
      true,
    ),
  );
}

/** Every open case with all its parts, the statistics and the choices of the list. */
function detailedView(cases, today) {
  const shown = state.mineOnly ? cases.filter(waitsForMe) : cases;
  const parts = [element("div", "overview", statsList(cases, today), toolbar())];
  if (shown.length === 0) {
    parts.push(element("p", "filtered-empty", "No next step waits for you now."));
  }
  for (const group of shown.length === 0 ? [] : groupCases(shown, state.group)) {
    const list = element("ul", "cases detailed", ...group.cases.map((item) => fullCase(item, today)));
    if (group.title === null) {
      parts.push(list);
    } else {
      const heading = element(
        "h2",
        "group-title",
        group.title,
        element("span", "group-count", String(group.cases.length)),
      );
      parts.push(element("section", "group", heading, list));
    }
  }
  return parts;
}

function render() {
  const result = state.result;
  closeMenu();
  const size = root.dataset.size;
  const today = todayText();
  const detailed = detailedSizes.includes(size);
  // A new read keeps the place of a list that the person scrolled.
  const scrolled = [bodyElement, bodyElement.querySelector(".cases")].map((node) => node?.scrollTop ?? 0);
  bodyElement.classList.remove("detailed");
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
  if (size === "header") {
    bodyElement.replaceChildren(headlineCase(cases, today));
    return;
  }
  if (detailed) {
    bodyElement.classList.add("detailed");
    bodyElement.replaceChildren(...detailedView(cases, today));
  } else {
    bodyElement.replaceChildren(element("ul", "cases", ...cases.map((item) => shortCase(item, today))));
  }
  bodyElement.scrollTop = scrolled[0];
  const list = bodyElement.querySelector(".cases");
  if (list !== null) list.scrollTop = scrolled[1];
}

async function refresh() {
  // Eva may allow an ask between two reads, so the widget asks her again each time.
  const [result, allowed] = await Promise.all([loadCases(), hello()]);
  state.result = result;
  state.allowed = allowed;
  render();
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

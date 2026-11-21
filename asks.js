// The asks of contract 3: the widget asks Eva, its parent window, to act. `hello` says which asks
// the person allowed. `chat` puts a text into Eva's message box, and `open` opens a vault path in
// Eva. Eva never sends the text: the person does. See the contract:
// https://github.com/guplem/eva/blob/main/docs/widgets.md
//
// Outside Eva (GitHub Pages, `npm start`), no parent answers, so the widget hides each entry that
// needs Eva.

/** Eva answers `hello` at once. With no answer after this time, the widget is not in Eva. */
const helloWaitMs = 400;
/** The longest wait for the answer to a `chat` or `open` ask. */
const answerWaitMs = 5000;
const askTypes = ["chat", "open"];

/** Opened alone in a tab, the widget is its own parent: nobody answers. */
const inFrame = window.parent !== window;
const waiting = new Map();
let lastId = 0;

window.addEventListener("message", (event) => {
  if (!inFrame || event.source !== window.parent) return;
  const data = event.data;
  if (typeof data !== "object" || data === null || data.eva !== "widget" || typeof data.ok !== "boolean") return;
  const answer = waiting.get(data.id);
  if (answer === undefined) return;
  waiting.delete(data.id);
  answer(data);
});

/**
 * Sends a message to Eva and waits for her answer, or null after `waitMs`. The message leaves at
 * once, in the same task as the tap, so Eva sees the tap.
 */
function send(message, waitMs) {
  if (!inFrame) return Promise.resolve(null);
  lastId += 1;
  const id = lastId;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(null);
    }, waitMs);
    waiting.set(id, (answer) => {
      clearTimeout(timer);
      resolve(answer);
    });
    window.parent.postMessage({ eva: "widget", id, ...message }, "*");
  });
}

/** The asks that the person allowed, such as `["chat", "open"]`. Empty outside Eva. */
export async function hello() {
  const answer = await send({ ask: "hello" }, helloWaitMs);
  if (answer?.ok !== true || !Array.isArray(answer.asks)) return [];
  return askTypes.filter((type) => answer.asks.includes(type));
}

/**
 * Asks Eva for an entry of the menu: `{ ask: "chat", text }` or `{ ask: "open", path }`. Call it
 * right in the click handler. Answers `{ ok: true }` or `{ ok: false, reason }`; the reason is
 * `no-answer` when Eva did not answer.
 */
export async function ask(entry) {
  const message = entry.ask === "open" ? { ask: "open", path: entry.path } : { ask: "chat", text: entry.text };
  const answer = await send(message, answerWaitMs);
  if (answer === null) return { ok: false, reason: "no-answer" };
  return answer.ok
    ? { ok: true }
    : { ok: false, reason: typeof answer.reason === "string" ? answer.reason : "unknown" };
}

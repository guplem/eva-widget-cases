// The layout at the sizes that Eva's home grid gives: a narrow tall card on a computer, a phone
// card, and full screen. The widget contract keeps the top right corner free for Eva's buttons.
import { expect, test } from "@playwright/test";
import { fakeEvaCases, fixToday } from "./helpers.js";

/** Short titles beside long badges, for a clock fixed at 2026-03-10. */
const evaCases = [
  {
    id: "gym-refund",
    title: "Gym refund",
    nextStep: { text: "Call the gym again", waitingFor: null, dueDate: "2026-02-26" },
    deadline: null,
    stepsDone: 1,
    stepsTotal: 2,
  },
  {
    id: "phone-repair",
    title: "Phone repair",
    nextStep: { text: "Take the phone to the repair shop", waitingFor: null, dueDate: "2026-03-11" },
    deadline: null,
    stepsDone: 1,
    stepsTotal: 3,
  },
  {
    id: "bumper-claim",
    title: "Bumper claim with the insurer of the other driver",
    nextStep: { text: "Get the answer of the insurer", waitingFor: "Example Insurance", dueDate: null },
    deadline: { date: "2026-03-09", cost: "The right to claim expires" },
    stepsDone: 1,
    stepsTotal: 3,
  },
];

/** The free corner of the widget contract: 56 px wide and 56 px high, at the top right. */
const corner = 56;

test.beforeEach(async ({ page }) => {
  await fixToday(page, "2026-03-10");
  await fakeEvaCases(page, evaCases);
});

for (const width of [150, 180, 203, 240, 300]) {
  for (const height of [300, 400, 520]) {
    test(`a tall card of ${String(width)} x ${String(height)} wraps each title at words, with no overlap`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/?size=tall");
      await expect(page.locator(".widget")).toHaveAttribute("data-ready", "true");
      const problems = await page.evaluate(() => {
        const found = [];
        const inside = (inner, outer) =>
          inner.left >= outer.left - 0.5 &&
          inner.right <= outer.right + 0.5 &&
          inner.top >= outer.top - 0.5 &&
          inner.bottom <= outer.bottom + 0.5;
        const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        for (const item of document.querySelectorAll(".case")) {
          const box = item.getBoundingClientRect();
          const title = item.querySelector(".case-title");
          const text = title.firstChild;
          // A word that breaks over two lines has two boxes.
          let start = 0;
          for (const word of text.textContent.split(" ")) {
            const range = document.createRange();
            range.setStart(text, start);
            range.setEnd(text, start + word.length);
            if (range.getClientRects().length !== 1) found.push(`"${word}" of "${text.textContent}" breaks`);
            start += word.length + 1;
          }
          for (const part of item.querySelectorAll(".case-title, .pill, .line")) {
            if (!inside(part.getBoundingClientRect(), box)) found.push(`a ${part.className} is cut`);
          }
          const pill = item.querySelector(".pill");
          if (pill !== null && overlap(pill.getBoundingClientRect(), title.getBoundingClientRect())) {
            found.push(`the badge overlaps "${text.textContent}"`);
          }
        }
        return found;
      });
      expect(problems).toEqual([]);
    });
  }
}

const frames = [
  { width: 160, height: 160 },
  { width: 180, height: 300 },
  { width: 203, height: 400 },
  { width: 240, height: 520 },
  { width: 390, height: 168 },
  { width: 390, height: 824 },
  { width: 800, height: 400 },
  { width: 1280, height: 800 },
];

for (const size of ["small", "medium", "large", "tall", "xlarge", "full"]) {
  for (const frame of frames) {
    test(`size ${size} keeps the top right corner free at ${String(frame.width)} x ${String(frame.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(frame);
      await page.goto(`/?size=${size}`);
      await expect(page.locator(".widget")).toHaveAttribute("data-ready", "true");
      const inCorner = await page.evaluate((side) => {
        const area = { left: window.innerWidth - side, right: window.innerWidth, top: 0, bottom: side };
        const hits = (rect) =>
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left < area.right &&
          // Half a pixel of rounding is not an overlap.
          rect.right > area.left + 0.5 &&
          rect.top < area.bottom - 0.5 &&
          rect.bottom > area.top;
        // What a box shows: an ancestor that hides its overflow, such as a cut summary, clips it.
        const shown = (rect, node) => {
          let { left, right, top, bottom } = rect;
          for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
            if (getComputedStyle(parent).overflow === "visible") continue;
            const clip = parent.getBoundingClientRect();
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
          return { left, right, top, bottom, width: right - left, height: bottom - top };
        };
        const found = [];
        const walker = document.createTreeWalker(document.querySelector(".widget"), NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.textContent.trim() === "") continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          if ([...range.getClientRects()].some((rect) => hits(shown(rect, node)))) found.push(node.textContent.trim());
        }
        for (const part of document.querySelectorAll(".widget .pill, .widget button, .widget svg, .widget progress")) {
          if (hits(shown(part.getBoundingClientRect(), part)))
            found.push(`a ${part.getAttribute("class") ?? part.tagName}`);
        }
        return found;
      }, corner);
      expect(inCorner).toEqual([]);
    });
  }
}

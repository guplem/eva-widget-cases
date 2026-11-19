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

test.beforeEach(async ({ page }) => {
  await fixToday(page, "2026-03-10");
  await fakeEvaCases(page, evaCases);
});

for (const width of [180, 203, 240, 300]) {
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

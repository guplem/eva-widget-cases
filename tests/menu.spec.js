// The menu of a case (contract 3, `asks`): the widget asks a fake Eva, in the parent page, to open
// the case or to put a text into her message box. Outside Eva, a case is not a button.
import { expect, test } from "@playwright/test";
import { fakeEvaCases, fixToday, openInFakeEva, sentAsks } from "./helpers.js";

/** Two made-up cases as Eva sends them, for a clock fixed at 2026-03-10. */
const evaCases = [
  {
    id: "fix-the-bathroom-leak",
    title: "Fix the bathroom leak",
    nextStep: { text: "Confirm the date with the plumber", waitingFor: "plumber", dueDate: "2026-03-09" },
    deadline: { date: "2026-03-22", cost: "A fine of 50 EUR" },
    stepsDone: 2,
    stepsTotal: 5,
    path: "Life/Cases/fix-the-bathroom-leak",
  },
  {
    id: "return-the-rental-deposit",
    title: "Return the rental deposit",
    nextStep: null,
    deadline: { date: "2026-03-08", cost: "The deposit of 800 EUR" },
    stepsDone: 1,
    stepsTotal: 2,
  },
];

const corner = 56;

test.beforeEach(async ({ page }) => {
  await fixToday(page, "2026-03-10");
  await fakeEvaCases(page, evaCases);
});

test("outside Eva, a case is not a button and shows no menu", async ({ page }) => {
  await page.goto("/?size=tall");
  await expect(page.locator(".widget")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".case-button")).toHaveCount(0);
  await page.locator(".case").first().click();
  await expect(page.locator(".menu")).toHaveCount(0);
});

test("a frame whose parent never answers hello shows no button either", async ({ page }) => {
  const frame = await openInFakeEva(page, { asks: null });
  await expect(frame.locator(".case")).toHaveCount(2);
  await expect(frame.locator(".case-button")).toHaveCount(0);
});

test("a tap on a case opens its menu, and each entry asks Eva", async ({ page }) => {
  const frame = await openInFakeEva(page);
  const row = frame.locator(".case-button").first();
  await expect(row).toHaveAttribute("aria-haspopup", "menu");
  await row.click();
  const menu = frame.getByRole("menu", { name: "Fix the bathroom leak" });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Open the case",
    "Start a chat about this case",
    "Ask Eva to do the next step",
    "Mark the step as done…",
  ]);
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await menu.getByRole("menuitem", { name: "Open the case" }).click();
  await expect(frame.locator(".menu")).toHaveCount(0);
  await expect
    .poll(() => sentAsks(page))
    .toEqual([expect.objectContaining({ eva: "widget", ask: "open", path: "Life/Cases/fix-the-bathroom-leak" })]);

  await row.click();
  await frame.getByRole("menuitem", { name: "Start a chat about this case" }).click();
  await row.click();
  await frame.getByRole("menuitem", { name: "Ask Eva to do the next step" }).click();
  await row.click();
  await frame.getByRole("menuitem", { name: "Mark the step as done…" }).click();
  await expect.poll(async () => (await sentAsks(page)).length).toBe(4);
  const texts = (await sentAsks(page)).slice(1).map((message) => [message.ask, message.text]);
  expect(texts).toEqual([
    [
      "chat",
      'Let us talk about my case "Fix the bathroom leak" (Life/Cases/fix-the-bathroom-leak). The next step is: Confirm the date with the plumber (waits for plumber, due 9 Mar 2026).',
    ],
    ["chat", expect.stringContaining("Help me with the next step of my case")],
    ["chat", expect.stringContaining("Mark it as done in the case")],
  ]);
  const ids = (await sentAsks(page)).map((message) => message.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("a case with no next step offers no step entries, and builds its path from its id", async ({ page }) => {
  const frame = await openInFakeEva(page);
  await frame.locator(".case-button").nth(1).click();
  await expect(frame.getByRole("menuitem")).toHaveText(["Open the case", "Start a chat about this case"]);
  await frame.getByRole("menuitem", { name: "Open the case" }).click();
  await expect
    .poll(() => sentAsks(page))
    .toEqual([expect.objectContaining({ ask: "open", path: "Life/Cases/return-the-rental-deposit" })]);
});

test("the keyboard opens the menu, moves in it, and Escape gives the focus back", async ({ page }) => {
  const frame = await openInFakeEva(page);
  const row = frame.locator(".case-button").first();
  await row.focus();
  await page.keyboard.press("Enter");
  const items = frame.getByRole("menuitem");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(frame.locator(".menu")).toHaveCount(0);
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press(" ");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => sentAsks(page)).toEqual([expect.objectContaining({ ask: "open" })]);
});

test("a tap outside closes the menu", async ({ page }) => {
  const frame = await openInFakeEva(page);
  await frame.locator(".case-button").first().click();
  await expect(frame.locator(".menu")).toHaveCount(1);
  await frame.locator(".widget-title").click();
  await expect(frame.locator(".menu")).toHaveCount(0);
});

test("only the allowed asks show, and a case with no entry left is not a button", async ({ page }) => {
  const frame = await openInFakeEva(page, { asks: ["open"] });
  await frame.locator(".case-button").first().click();
  await expect(frame.getByRole("menuitem")).toHaveText(["Open the case"]);
});

test("a case with no id has no path: with only Open allowed, it is not a button", async ({ page }) => {
  await page.unroute("**/eva/cases.json");
  await fakeEvaCases(page, [{ title: "A case with no id", nextStep: null, deadline: null }]);
  const frame = await openInFakeEva(page, { asks: ["open"] });
  await expect(frame.locator(".case")).toHaveCount(1);
  await expect(frame.locator(".case-button")).toHaveCount(0);
});

test("a refused ask says why, and a type that Eva does not allow leaves the menu", async ({ page }) => {
  const frame = await openInFakeEva(page, { answers: { open: { ok: false, reason: "not-allowed" } } });
  await frame.locator(".case-button").first().click();
  await frame.getByRole("menuitem", { name: "Open the case" }).click();
  await expect(frame.getByRole("status")).toHaveText(
    "Eva does not allow this yet. Allow it in the widget's settings in Eva.",
  );
  await frame.locator(".case-button").first().click();
  await expect(frame.getByRole("menuitem")).toHaveText([
    "Start a chat about this case",
    "Ask Eva to do the next step",
    "Mark the step as done…",
  ]);
});

test("a tap that Eva did not see asks for another tap", async ({ page }) => {
  const frame = await openInFakeEva(page, { answers: { chat: { ok: false, reason: "no-tap" } } });
  await frame.locator(".case-button").first().click();
  await frame.getByRole("menuitem", { name: "Start a chat about this case" }).click();
  await expect(frame.getByRole("status")).toHaveText("Eva needs a tap for this. Try again.");
});

const frames = [
  { size: "small", width: 160, height: 160 },
  { size: "tall", width: 203, height: 350 },
  { size: "tall", width: 300, height: 350 },
  { size: "medium", width: 358, height: 340 },
  { size: "full", width: 390, height: 824 },
  { size: "full", width: 1280, height: 800 },
];

for (const { size, width, height } of frames) {
  test(`the menu of ${size} at ${String(width)} x ${String(height)} stays in the frame and off the corner`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const frame = await openInFakeEva(page, { size });
    const row = frame.locator(".case-button").first();
    const rowBox = await row.boundingBox();
    // A tap near the right end of the case, the worst place for the menu.
    await row.click({ position: { x: rowBox.width - 4, y: 6 } });
    const box = await frame.locator(".menu").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
    const inCorner = box.x + box.width > width - corner + 0.5 && box.y < corner - 0.5;
    expect(inCorner).toBe(false);
  });
}

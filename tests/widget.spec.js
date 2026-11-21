import { expect, test } from "@playwright/test";
import { fakeEvaCases, fixToday } from "./helpers.js";

/** Three cases as Eva sends them, the most urgent first, for a clock fixed at 2026-03-10. */
const evaCases = [
  {
    id: "fix-the-bathroom-leak",
    title: "Fix the bathroom leak",
    nextStep: { text: "Confirm the date with the plumber", waitingFor: "plumber", dueDate: "2026-03-09" },
    deadline: { date: "2026-03-22", cost: "A fine of 50 EUR" },
    stepsDone: 2,
    stepsTotal: 5,
  },
  {
    id: "renew-the-car-insurance",
    title: "Renew the car insurance",
    nextStep: { text: "Compare the two quotes", waitingFor: null, dueDate: "2026-03-11" },
    deadline: null,
    stepsDone: null,
    stepsTotal: null,
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

test.beforeEach(async ({ page }) => {
  await fixToday(page, "2026-03-10");
});

test("a tall card shows each case of Eva in her order, with its nearest day and its next step", async ({ page }) => {
  await fakeEvaCases(page, evaCases);
  await page.goto("/?size=tall");
  await expect(page.locator(".case-title")).toHaveText([
    "Fix the bathroom leak",
    "Renew the car insurance",
    "Return the rental deposit",
  ]);
  await expect(page.locator(".case .pill")).toHaveText(["Overdue by 1 day", "Due tomorrow", "Deadline passed"]);
  await expect(page.locator(".case .step")).toHaveText([
    "Confirm the date with the plumber · waits for plumber",
    "Compare the two quotes",
    "No next step",
  ]);
  await expect(page.locator('[data-role="summary"]')).toHaveText("3 open");
});

test("a late step takes the warn colour and the alert icon, and only a passed deadline takes the bad one", async ({
  page,
}) => {
  await fakeEvaCases(page, evaCases);
  await page.goto("/?size=tall");
  const pills = page.locator(".case .pill");
  await expect(pills.nth(0)).toHaveClass(/\bwarn\b/);
  await expect(pills.nth(0).locator(".icon")).toHaveCount(1);
  // A day that is not late has the dot instead, so each state has a shape.
  await expect(pills.nth(1)).toHaveClass(/\bwarn\b.*\bdot\b/);
  await expect(pills.nth(1).locator(".icon")).toHaveCount(0);
  await expect(pills.nth(2)).toHaveClass(/\bbad\b/);
  await expect(pills.nth(2).locator(".icon")).toHaveCount(1);
});

test("a medium card shows the same list as a tall card", async ({ page }) => {
  await fakeEvaCases(page, evaCases);
  await page.goto("/?size=medium");
  await expect(page.locator(".case")).toHaveCount(3);
  await expect(page.locator(".cases.detailed")).toHaveCount(0);
});

test("a small card shows the most urgent case, its next step and a count of the others", async ({ page }) => {
  await fakeEvaCases(page, evaCases);
  await page.goto("/?size=small");
  await expect(page.locator(".focus .case-title")).toHaveText("Fix the bathroom leak");
  await expect(page.locator(".focus .pill")).toHaveText("Overdue by 1 day");
  await expect(page.locator(".focus .step")).toHaveText("Confirm the date with the plumber · waits for plumber");
  await expect(page.locator(".focus .more")).toHaveText("2 more cases");
  await expect(page.locator(".case")).toHaveCount(0);
});

test("a small card with one case says that no other case is open", async ({ page }) => {
  await fakeEvaCases(page, [evaCases[1]]);
  await page.goto("/?size=small");
  await expect(page.locator(".focus .more")).toHaveText("No other open case");
});

test("the header slot shows the most urgent case and its day in one line", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 70 });
  await fakeEvaCases(page, evaCases);
  await page.goto("/?size=header");
  await expect(page.locator(".headline .case-title")).toHaveText("Fix the bathroom leak");
  await expect(page.locator(".headline .pill")).toHaveText("Overdue by 1 day");
  await expect(page.locator(".headline .step")).toBeHidden();
  await expect(page.locator('[data-role="summary"]')).toHaveText("3 open");
  await page.setViewportSize({ width: 358, height: 168 });
  await expect(page.locator(".headline .step")).toBeVisible();
});

test("the narrowest header slot (330 x 72) shows the whole day of the case", async ({ page }) => {
  await page.setViewportSize({ width: 330, height: 72 });
  await fakeEvaCases(page, [{ ...evaCases[0], nextStep: { ...evaCases[0].nextStep, dueDate: "2025-03-20" } }]);
  await page.goto("/?size=header");
  const pill = page.locator(".headline .pill");
  await expect(pill).toContainText("Overdue by");
  const cut = await pill.evaluate((node) => {
    const own = node.getBoundingClientRect();
    const card = node.closest(".headline").getBoundingClientRect();
    return own.right - card.right;
  });
  expect(cut).toBeLessThanOrEqual(0.5);
});

for (const size of ["large", "xlarge", "full"]) {
  test(`a ${size} card shows every case with its steps, its deadline and the cost`, async ({ page }) => {
    await fakeEvaCases(page, evaCases);
    await page.goto(`/?size=${size}`);
    const first = page.locator(".case").first();
    await expect(page.locator(".case")).toHaveCount(3);
    await expect(first.locator(".steps")).toHaveText("2 of 5 steps");
    await expect(first.locator("progress")).toHaveJSProperty("value", 2);
    await expect(first.locator(".step")).toHaveText("Confirm the date with the plumber");
    await expect(first.locator(".waits")).toHaveText("Waits for plumber");
    await expect(first.locator(".pill")).toHaveText(["Overdue by 1 day", "Deadline in 12 days"]);
    await expect(first.locator(".cost")).toHaveText("A fine of 50 EUR");
    await expect(page.locator(".case").nth(1).locator(".steps")).toHaveCount(0);
    await expect(page.locator(".case").nth(2).locator(".pill")).toHaveText("Deadline passed");
  });
}

test("no cases folder: the widget says so, and how to ask Eva for a first case", async ({ page }) => {
  await fakeEvaCases(page, null);
  await page.goto("/?size=tall");
  await expect(page.locator(".empty strong")).toHaveText("No cases yet");
  await expect(page.locator(".empty p")).toContainText("Ask Eva in a chat to open one.");
  await expect(page.locator('[data-role="summary"]')).toHaveText("");
});

test("an empty list: the widget says that no case is open", async ({ page }) => {
  await fakeEvaCases(page, []);
  await page.goto("/?size=tall");
  await expect(page.locator(".empty strong")).toHaveText("No open cases");
  await expect(page.locator(".empty p")).toContainText("Ask Eva in a chat to open a new one");
  await expect(page.locator('[data-role="summary"]')).toHaveText("");
});

test("a refused read shows the failure and tries again on a click", async ({ page }) => {
  let calls = 0;
  await page.route("**/eva/cases.json", (route) => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 500 })
      : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(evaCases) });
  });
  await page.goto("/?size=tall");
  await expect(page.locator(".empty strong")).toHaveText("Eva could not read the cases.");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".case")).toHaveCount(3);
});

test("outside Eva, the example cases show, with dates from today", async ({ page }) => {
  await page.goto("/?size=tall");
  await expect(page.locator('[data-role="summary"]')).toHaveText("5 open · example");
  await expect(page.locator(".case .pill").first()).toHaveText("Overdue by 1 day");
  await expect(page.locator(".case .pill").nth(1)).toHaveText("Due tomorrow");
  await expect(page.locator(".case .pill").nth(2)).toHaveText("Due in 5 days");
});

test("the widget reads the cases again when the page shows again", async ({ page }) => {
  const answer = [evaCases[0]];
  await page.route("**/eva/cases.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answer) }),
  );
  await page.goto("/?size=tall");
  await expect(page.locator(".case")).toHaveCount(1);
  answer.push(evaCases[1]);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator(".case")).toHaveCount(2);
});

test("the demo server answers a broken address with 404, and keeps running", async ({ request }) => {
  expect((await request.get("/%E0%A4%A")).status()).toBe(404);
  expect((await request.get("/")).status()).toBe(200);
});

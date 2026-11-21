// The overview of the large sizes and full screen: statistics from Eva's data, a grouping by who
// a case waits for, and the filter "Waits for me". The short sizes keep their look.
import { expect, test } from "@playwright/test";
import { fakeEvaCases, fixToday } from "./helpers.js";

/** Made-up cases as Eva sends them, the most urgent first, for a clock fixed at 2026-03-10. */
const evaCases = [
  {
    id: "return-the-rental-deposit",
    title: "Return the rental deposit",
    nextStep: { text: "Ask the landlord again", waitingFor: "landlord", dueDate: "2026-03-07" },
    deadline: { date: "2026-03-08", cost: "The deposit of 800 EUR" },
    stepsDone: 1,
    stepsTotal: 2,
  },
  {
    id: "renew-the-car-insurance",
    title: "Renew the car insurance",
    nextStep: { text: "Compare the two quotes", waitingFor: null, dueDate: "2026-03-11" },
    deadline: { date: "2026-03-19", cost: "The car has no insurance" },
    stepsDone: 1,
    stepsTotal: 3,
  },
  {
    id: "fix-the-bathroom-leak",
    title: "Fix the bathroom leak",
    nextStep: { text: "Confirm the date with the plumber", waitingFor: "plumber", dueDate: "2026-03-15" },
    deadline: null,
    stepsDone: 2,
    stepsTotal: 5,
  },
  {
    id: "tax-return",
    title: "Tax return",
    nextStep: { text: "Send the receipts", waitingFor: null, dueDate: "2026-03-30" },
    deadline: null,
    stepsDone: null,
    stepsTotal: null,
  },
  {
    id: "move-to-the-new-flat",
    title: "Move to the new flat",
    nextStep: null,
    deadline: null,
    stepsDone: 0,
    stepsTotal: 4,
  },
];

test.beforeEach(async ({ page }) => {
  await fixToday(page, "2026-03-10");
  await fakeEvaCases(page, evaCases);
});

for (const size of ["large", "xlarge", "full"]) {
  test(`a ${size} card shows the statistics of today, from Eva's data`, async ({ page }) => {
    await page.goto(`/?size=${size}`);
    const stats = page.getByRole("list", { name: "Today at a glance" });
    await expect(stats.locator(".stat-label")).toHaveText([
      "Overdue",
      "Due in 7 days",
      "Wait for me",
      "Wait for others",
      "Return the rental deposit",
    ]);
    await expect(stats.locator(".stat-value")).toHaveText(["1", "2", "2", "2"]);
    // The nearest deadline: a passed one wins, in the bad colour.
    await expect(stats.locator(".nearest .pill")).toHaveText("Deadline passed");
    await expect(stats.locator(".nearest .pill")).toHaveClass(/\bbad\b/);
  });
}

test("the large view keeps Eva's order by default, and says who each step waits for", async ({ page }) => {
  await page.goto("/?size=large");
  await expect(page.getByRole("button", { name: "By urgency" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".case-title")).toHaveText([
    "Return the rental deposit",
    "Renew the car insurance",
    "Fix the bathroom leak",
    "Tax return",
    "Move to the new flat",
  ]);
  await expect(page.locator(".group-title")).toHaveCount(0);
  await expect(page.locator(".case").nth(1).locator(".waits")).toHaveText("Waits for you");
});

test("by who it waits for groups the cases, each group in Eva's order", async ({ page }) => {
  await page.goto("/?size=full");
  const choice = page.getByRole("button", { name: "By who it waits for" });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(choice).toBeFocused();
  await expect(page.locator(".group-title")).toHaveText([
    "Waits for me2",
    "Waits for landlord1",
    "Waits for plumber1",
    "No next step1",
  ]);
  await expect(page.locator(".group").first().locator(".case-title")).toHaveText([
    "Renew the car insurance",
    "Tax return",
  ]);
});

test("the filter Waits for me shows only the steps that wait for the person", async ({ page }) => {
  await page.goto("/?size=xlarge");
  const filter = page.getByRole("button", { name: "Waits for me" });
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".case-title")).toHaveText(["Renew the car insurance", "Tax return"]);
  // The statistics still count every open case.
  await expect(page.locator(".stat-value").first()).toHaveText("1");
  await filter.click();
  await expect(page.locator(".case")).toHaveCount(5);
});

test("with no step that waits for the person, the filter says so", async ({ page }) => {
  await page.unroute("**/eva/cases.json");
  await fakeEvaCases(page, [evaCases[0], evaCases[2]]);
  await page.goto("/?size=full");
  await page.getByRole("button", { name: "Waits for me" }).click();
  await expect(page.locator(".filtered-empty")).toHaveText("No next step waits for you now.");
  await expect(page.locator(".case")).toHaveCount(0);
});

test("with no deadline, the statistics leave the nearest deadline out", async ({ page }) => {
  await page.unroute("**/eva/cases.json");
  await fakeEvaCases(page, [evaCases[2], evaCases[3]]);
  await page.goto("/?size=large");
  await expect(page.locator(".stat")).toHaveCount(4);
  await expect(page.locator(".stat.nearest")).toHaveCount(0);
});

for (const size of ["small", "medium", "tall"]) {
  test(`a ${size} card shows no statistics and no choices`, async ({ page }) => {
    await page.goto(`/?size=${size}`);
    await expect(page.locator(".widget")).toHaveAttribute("data-ready", "true");
    await expect(page.locator(".stats, .toolbar")).toHaveCount(0);
  });
}

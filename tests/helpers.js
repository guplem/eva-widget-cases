// Helpers for the widget tests. Outside Eva, eva/cases.json answers 404, so a test that needs
// Eva's answer fakes it here, with no local server of Eva.

/** Answers eva/cases.json as Eva does: with this body, such as a list or null, and this status. */
export async function fakeEvaCases(page, body, status = 200) {
  await page.route("**/eva/cases.json", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

/** Fixes the clock of the page at noon of this local date, such as "2026-03-10". */
export async function fixToday(page, date) {
  await page.clock.setFixedTime(new Date(`${date}T12:00:00`));
}

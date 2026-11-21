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

/**
 * Opens the widget in a fake Eva: a parent page with the widget in a frame, which answers the asks
 * of contract 3 by postMessage. `asks` are the allowed types that `hello` answers, or null for no
 * answer at all, as outside Eva. `answers` maps an ask type to Eva's answer, `{ ok: true }` by
 * default. The parent keeps each message in `window.asks`. Returns the frame of the widget.
 */
export async function openInFakeEva(page, { size = "tall", asks = ["chat", "open"], answers = {} } = {}) {
  const config = encodeURIComponent(JSON.stringify({ asks, answers }));
  await page.route("**/fake-eva.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
<html><head><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style></head>
<body><iframe src="/?size=${size}"></iframe>
<script>
  const config = JSON.parse(decodeURIComponent(location.hash.slice(1)));
  window.asks = [];
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data?.eva !== "widget" || typeof data.ask !== "string") return;
    window.asks.push(data);
    if (data.ask === "hello") {
      if (config.asks !== null) event.source.postMessage({ eva: "widget", id: data.id, ok: true, asks: config.asks }, "*");
      return;
    }
    event.source.postMessage({ eva: "widget", id: data.id, ...(config.answers[data.ask] ?? { ok: true }) }, "*");
  });
</script></body></html>`,
    }),
  );
  await page.goto(`/fake-eva.html#${config}`);
  const frame = page.frameLocator("iframe");
  await frame.locator(".widget[data-ready='true']").waitFor();
  return frame;
}

/** The asks that the widget sent to the fake Eva, apart from `hello`. */
export async function sentAsks(page) {
  return page.evaluate(() => window.asks.filter((message) => message.ask !== "hello"));
}

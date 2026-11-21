# Cases

A widget for [Eva](https://github.com/guplem/eva)'s home page. It shows your open cases, the most urgent first, with the next step and the nearest day of each.

**Demo:** https://guplem.github.io/eva-widget-cases/

The demo uses mock data, with dates that count from today.

## What it does

- **The tall and the medium card** show as many cases as fit. Each case has its title, a pill for its nearest day, its next step and who that step waits for. A longer list scrolls inside the card.
- **The large card, the extra large card and full screen** show every open case: its steps done, its next step, who it waits for (you or someone else), the day the step is due, and the deadline with what you lose when it passes. Above the list, a few numbers help you pick what to do today: the overdue steps, the steps due in the next 7 days, the steps that wait for you and those that wait for other people, and the nearest deadline with its case. You can group the cases **by urgency** (Eva's order) or **by who they wait for** (you first, then each person, then the cases with no next step), and show only the cases that **wait for you**. The choices last until the page reloads.
- **The small card** shows the most urgent case, its next step and how many other cases are open.
- The words and the colours are those of the Cases page of Eva:
  - "Due today", "Due tomorrow", "Due in 5 days": the step is near, in the warn colour.
  - "Overdue by 1 day", with an alert icon: the step is late. It still waits for you, so it keeps the warn colour.
  - "Deadline passed", with an alert icon: you lost something. Only this state takes the red colour.
  - Each state has a word and a shape, a dot or an icon. Colour is never the only signal.
- With no cases folder, the widget says so, and how to ask Eva for a first case. With no open case, it says "No open cases".
- The widget reads the cases again each time the page shows, and every 10 minutes. So a case that Eva changes in a chat shows with no reload.

### The menu of a case

In Eva, a tap on a case (or Enter or Space on it) opens a small menu:

- **Open the case**: Eva opens the case's own page.
- **Start a chat about this case**: Eva puts a short text with the title, the next step and the path of the case into her message box.
- **Ask Eva to do the next step**: a text that asks Eva for help with the next step. Only for a case with a next step.
- **Mark the step as done…**: a text that asks Eva to mark the step as done. Only for a case with a next step.

Eva never sends a text by herself: you read it, change it if you like, and send it. Arrow keys move in the menu, and Escape closes it. Outside Eva (on GitHub Pages), or when you did not allow these asks, the menu hides its entries, and a case with no entry left is not a button.

The widget only reads. It never changes a case: a change goes through a chat with Eva.

## The data

Eva gives the widget its open cases at `eva/cases.json`, in the order of the Cases page. The widget keeps that order.

```json
[
  {
    "id": "fix-the-bathroom-leak",
    "path": "Life/Cases/fix-the-bathroom-leak",
    "title": "Fix the bathroom leak",
    "nextStep": { "text": "Confirm the date with the plumber", "waitingFor": "plumber", "dueDate": "2026-11-17" },
    "deadline": { "date": "2026-12-01", "cost": "A fine of 50 EUR" },
    "stepsDone": 2,
    "stepsTotal": 5
  }
]
```

- `nextStep`, `deadline`, `waitingFor`, `dueDate` and `cost` can be `null`. `stepsDone` and `stepsTotal` can be `null` together.
- A step with no `waitingFor` waits for you.
- `path` is the place of the case in the vault, for "Open the case". Eva sends it since contract 3. With an older Eva, the widget builds it as `Life/Cases/<id>`: Eva's widget docs say that `id` is the folder name of the case in `Life/Cases`.
- Eva answers `null` when the vault has no cases folder.
- [`example/cases.json`](example/cases.json) holds the mock cases of the demo. Its dates read `today`, `today+5` or `today-1`, so the demo always shows a late step.

## How it counts

[`cases.js`](cases.js) holds the words, with no page code, so `tests/cases.test.js` tests them in Node.

- A day counts in whole days from today, in your time zone.
- A step is near up to 7 days before its day. A deadline is near up to 14 days before.
- The pill of a short card shows the nearest of the step's day and the deadline. A passed deadline always wins, so a loss never hides behind a late step.
- "Due in 7 days" counts the steps due from today to 7 days from now. A late step counts in "Overdue" instead. A date such as `2026-12` counts in neither.
- The nearest deadline is the one with the fewest days left; a passed deadline wins, as on the pill.

## Add it to Eva

Add the widget by its address: `https://github.com/guplem/eva-widget-cases`. Eva shows the permissions when you turn it on: the widget reads your open cases, and it may ask Eva to open a case (`open`) and to put a text into your message box (`chat`).

## Run it on your computer

A browser does not run the widget from a double-click on `index.html`. Run a small web server instead:

```sh
npm install
npm start
```

Then open http://localhost:3000/. Add `?size=small`, `medium`, `tall`, `large`, `xlarge` or `full` to the address to see each size.

## Change it

The widget follows the [widget contract](https://github.com/guplem/eva/blob/main/docs/widgets.md) of Eva, contract 3. `AGENTS.md` says how to work on it, for people and for coding agents. `npm run check` runs every check.

## License

MIT. See [`LICENSE`](LICENSE).

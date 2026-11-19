# Cases

A widget for [Eva](https://github.com/guplem/eva)'s home page. It shows your open cases, the most urgent first, with the next step and the nearest day of each.

**Demo:** https://guplem.github.io/eva-widget-cases/

The demo uses mock data, with dates that count from today.

## What it does

- **The tall and the medium card** show as many cases as fit. Each case has its title, a pill for its nearest day, its next step and who that step waits for. A longer list scrolls inside the card.
- **The large card, the extra large card and full screen** show every open case: its steps done, its next step, who it waits for, the day the step is due, and the deadline with what you lose when it passes.
- **The small card** shows the most urgent case, its next step and how many other cases are open.
- The words and the colours are those of the Cases page of Eva:
  - "Due today", "Due tomorrow", "Due in 5 days": the step is near, in the warn colour.
  - "Overdue by 1 day", with an alert icon: the step is late. It still waits for you, so it keeps the warn colour.
  - "Deadline passed", with an alert icon: you lost something. Only this state takes the red colour.
  - Each state has a word and a shape, a dot or an icon. Colour is never the only signal.
- With no cases folder, the widget says so, and how to ask Eva for a first case. With no open case, it says "No open cases".
- The widget reads the cases again each time the page shows, and every 10 minutes. So a case that Eva changes in a chat shows with no reload.

The widget only reads. To open, change or close a case, ask Eva in a chat.

## The data

Eva gives the widget its open cases at `eva/cases.json`, in the order of the Cases page. The widget keeps that order.

```json
[
  {
    "id": "fix-the-bathroom-leak",
    "title": "Fix the bathroom leak",
    "nextStep": { "text": "Confirm the date with the plumber", "waitingFor": "plumber", "dueDate": "2026-11-17" },
    "deadline": { "date": "2026-12-01", "cost": "A fine of 50 EUR" },
    "stepsDone": 2,
    "stepsTotal": 5
  }
]
```

- `nextStep`, `deadline`, `waitingFor`, `dueDate` and `cost` can be `null`. `stepsDone` and `stepsTotal` can be `null` together.
- Eva answers `null` when the vault has no cases folder.
- [`example/cases.json`](example/cases.json) holds the mock cases of the demo. Its dates read `today`, `today+5` or `today-1`, so the demo always shows a late step.

## How it counts

[`cases.js`](cases.js) holds the words, with no page code, so `tests/cases.test.js` tests them in Node.

- A day counts in whole days from today, in your time zone.
- A step is near up to 7 days before its day. A deadline is near up to 14 days before.
- The pill of a short card shows the nearest of the step's day and the deadline. A passed deadline always wins, so a loss never hides behind a late step.

## Add it to Eva

Add the widget by its address: `https://github.com/guplem/eva-widget-cases`. Eva shows the permission when you turn it on: the widget reads your open cases.

## Run it on your computer

A browser does not run the widget from a double-click on `index.html`. Run a small web server instead:

```sh
npm install
npm start
```

Then open http://localhost:3000/. Add `?size=small`, `medium`, `tall`, `large`, `xlarge` or `full` to the address to see each size.

## Change it

The widget follows the [widget contract](https://github.com/guplem/eva/blob/main/docs/widgets.md) of Eva, contract 2. `AGENTS.md` says how to work on it, for people and for coding agents. `npm run check` runs every check.

## License

MIT. See [`LICENSE`](LICENSE).

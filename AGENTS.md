# Cases

This repository is a widget for Eva's home page: a small web page that Eva shows in a grid. Read the widget contract first: https://github.com/guplem/eva/blob/main/docs/widgets.md. It says which files a widget has, how it talks to Eva, its sizes, its theme and the naming rules of its data. Never copy the contract into this repository: link it.

## What must not change

- **This repository is public, and holds no data of a person.** It holds only mock data for the tests and the demo. Never write a name of a private person, a real data value, a token or a home path.
- **Plain, standard web code.** HTML, JavaScript and CSS, with no framework and no build step. A browser loads the files as they are.
- **The widget talks to its host only through `fetch` to relative paths** of the contract: `config.json`, `eva/cases.json` and `eva/theme.css`, **and through the asks of contract 3** (`asks.js`): `hello`, `chat` and `open`, by `postMessage` to its parent window, right in the click handler of a tap.
- **The widget works outside Eva,** on GitHub Pages and with `npm start`. There, `eva/cases.json` answers 404, and the widget shows `example/cases.json`.
- **The widget only reads.** Eva owns the cases. Add an input, a write, a host or an ask only with the owner. A change to a case, such as "Mark the step as done…", goes through a `chat` ask: the person sends the text, and Eva changes the case.
- **Outside Eva, no ask works.** With no answer to `hello` in about 400 ms, or an ask that the person did not allow, the widget hides its entries, and a case with no entry left is not a button.

## Rules

- Never use an inline script or an inline style. Eva's Content Security Policy blocks them.
- Never rely on `localStorage`.
- Never rely on a form submit, also `<form method="dialog">`: Eva's sandbox blocks it. Handle each button with a `click` listener.
- A pull request that adds or widens a permission of `eva-widget.json` says so in its body: a new input, a write access, the location, or a host.
- Keep the mock files in line with the code: `config.json`, `example/cases.json` and `eva/theme.css`.
- Keep `tests/fills-screen.spec.js`: the widget fills the space that it gets, at every size.
- Keep the words of a case in `cases.js`, with no page code, so `tests/cases.test.js` runs them in Node: also the texts of the asks, the entries of the menu, the statistics and the groups.
- Keep the menu inside the frame and off the free corner of 56 px at the top right. `tests/menu.spec.js` opens the widget in a fake Eva (`openInFakeEva` of `tests/helpers.js`) that answers the asks.
- A statistic comes only from a field that Eva sends. Never invent a field.
- Use the words and the tones of Eva's Cases page (`src/frontends/web/client/life-pages.ts` in Eva). A late step takes the warn colour: it waits for the person. Only a passed deadline takes the bad colour. Each state has a word and a shape, never a colour alone.
- Keep Eva's order of the cases. Never sort them in the widget. The grouping "By who it waits for" of the large sizes keeps Eva's order inside each group.
- Write each date of `example/cases.json` as `today`, `today+N` or `today-N`. The widget counts it from today, so the demo always shows a late step.
- Fix the clock with `fixToday` of `tests/helpers.js` in each test that depends on today.

## Checks

- `npm run check` runs every check: the format, the lint, the contract check (`npm run check:widget`) and the tests. CI runs the same checks as the "lint" and "test" jobs.
- `npm start` runs the widget at http://localhost:3000/. Add `?size=small`, `medium`, `tall`, `large`, `xlarge`, `full` or `header` to the address.
- The tests serve the widget on port 3100, and never reuse a server that already listens. Set `WIDGET_TEST_PORT` to test while another widget repository tests on the same computer.

## Skills

- To make any change, follow `.agents/skills/widget-change/SKILL.md`. It gives the steps of the change one at a time, with the pskill runner. When the runner cannot run, follow `.agents/skills/make-change/SKILL.md` instead, with the rules of this file.
- Before each commit, follow `.agents/skills/write-commit/SKILL.md`.
- To create an issue, follow `.agents/skills/create-issue/SKILL.md`.
- Before each rename, follow `.agents/skills/rename-symbol/SKILL.md`.
- To resume or stop a pskill run, follow `.agents/skills/pskill/SKILL.md`.

## Git and GitHub

- Branch from `origin/main` for each change.
- Open a pull request for each change, and turn on auto-merge for it with `gh pr merge --auto --merge`, with the person's GitHub login. A pull request merges only when CI is green.
- The commit prefixes pick the release version: `feat` raises the middle number, and `fix`, `perf`, `refactor` and `build` the last one. Mark a breaking change with `!`.
- After a merge to `main`, GitHub Pages shows the new version.

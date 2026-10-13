# pstack map verification map

This directory is the maintained source for verifying the pstack map in a browser. Read the index before driving the site, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch the site from the repo root with `python3 -m http.server 8765 --bind 127.0.0.1`.
- The site is healthy when `http://127.0.0.1:8765/` returns 200.
- `data/graph.json` is the graph the page fetches. Skill and playbook nodes include `text`.
- Chrome is `/usr/local/bin/google-chrome` with the flags in the skill.
- `puppeteer-core` resolves from `/tmp/node_modules/puppeteer-core`. Do not install it into this repo.
- Drive only the server this run started.

## Driving conventions

- Start from `http://127.0.0.1:8765/` unless a recipe names another query.
- Run the browser through `node .cursor/skills/verify-pstack-map/drive.mjs`.
- Wait for `window.__ready` before reading the page.
- Treat a console error or an HTTP status of 400 or higher as a failure.
- Compare card copy with `oneLiner` and `plainName` in `copy.mjs`, and kitchen file text with `node.text`.
- Keep proof in `/tmp/verify-pstack-map/`. Do not delete that directory during cleanup.

## Proof and skip reporting

- Capture the loaded theme and the opened skill, not only the final URL.
- UI proof is a screenshot plus the text the recipe names.
- Record the theme and the entry point with every artifact.
- Report an unreachable path with the URL you opened and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph, then exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with drive.mjs` starts with `Preconditions:` and pairs each user action with the helper check.
4. `Gotchas` lists traps that can waste or invalidate a run.

## Features

- [Themes](./themes.md) covers galaxy, circuit, earth, brain, and kitchen.
- [Skill card](./skill-card.md) covers the shared card on galaxy, circuit, earth, and brain.
- [Kitchen session](./kitchen-session.md) covers the station file, the fast session, the cozy branch question, and the waiter.

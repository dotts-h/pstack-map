---
name: verify-pstack-map
description: Drives the pstack map site in a browser: load each theme, open a skill card, and check skill text against the graph.
---

# verify-pstack-map

Drive the pstack map the way a reader does. Open each theme, open a skill, and compare the visible text with `data/graph.json`.

## Launch

From the repo root, start the site.

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

The site is ready when `http://127.0.0.1:8765/` returns 200.

Keep the process id of that server. Cleanup kills that pid.

## Doctor

Check the port and the process you started.

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8765/
```

Expect `200`. Confirm the listener pid is the python process you started. Read it from the shell that launched the server, or match that pid in `ss -ltnp`. Do not choose a python process by name.

## Drive

Chrome is `/usr/local/bin/google-chrome` with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --enable-webgl --ignore-gpu-blocklist --no-sandbox`. The helper also passes `--disable-dev-shm-usage` so Chrome can start in a small container.

The helper imports `puppeteer-core` from `/tmp/node_modules/puppeteer-core/lib/esm`. Version 25 drops that path, so install version 24 there if it is missing: `npm i --no-save --no-package-lock --prefix /tmp puppeteer-core@24`. Do not add it to a package.json. This repo has no package.json and must not gain one.

With the server up, from the repo root:

```sh
node .cursor/skills/verify-pstack-map/drive.mjs
```

The helper loads `/?hint=0&theme=galaxy`, `circuit`, `earth`, `brain`, and `kitchen`. It waits for `window.__ready`. It records console errors and any HTTP status of 400 or higher, and it fails on those.

On galaxy, circuit, earth, and brain it opens `architect` with `?focus=architect`. The card title must be the skill title. The card sentence must equal `oneLiner` from `copy.mjs` for that node.

On kitchen it opens `/?theme=kitchen&hint=0&open=architect`, clicks **Open skill file**, and checks that the modal contains a sentence from that node's `text` field. The sentence must not be only the one-line description.

It then loads `/?theme=kitchen&hint=0&fast=1&session=playbook:feature`. The session starts from the ticket on load, and there is no Play button. At `window.__ready`, `document.body` has class `fast`. `#hint` has computed `animation-name` `none` and `transition-duration` `0s`, `document.getAnimations()` is empty, and the lower third is showing. `#lt .ttl` must say Order up within 30 seconds, and `#ticket .k` must say ready. The helper clicks **Exit**, and the URL must keep `theme=kitchen` without `session`. It loads `session=skill:architect` and waits for Order up. It loads `/?theme=kitchen&hint=0&fast=1`, clicks the Feature ticket `#rail .tk[data-id="playbook:feature"]`, and waits for Order up in the same document.

Fast has no question bubble and no waiter. At Order up in each fast row and in the reduced-motion row, the page has no `.qb` element and `window.__srv()[1]` is `null`.

The branch row loads `/?theme=kitchen&hint=0&freeze=1&session=skill:how&pick=1:no` in Cozy and advances the clock with `window.__step(0.25)`. The bubble `.qb .qq` must read `Is the task complex?`, `.qb .qs` must read `SKILL.md:` and a line number, and no step is skipped yet. After the forced No, `#ticket li.skip` must list `Explore (complex only)` and `Synthesize (complex only)`. The waiter must reach `window.__srv()[1] === 'carry'`, and `#ticket .k` must say served. The empty-ticket row loads `session=playbook:opening-a-pr` with `freeze=1`, which has nothing to cook. After eight steps `window.__T()` must have advanced, `window.__srv()` must be `['served', null]`, and the pass has no Order up label. Another row loads `session=skill:how` in Cozy, steps until the waiter is carrying, clicks Fast, and must end at Served with no waiter.

A pace row loads `/?theme=kitchen&hint=0&session=playbook:feature` with no `fast` parameter. It clicks **Fast** and the same document's URL has `fast=1`. It clicks **Cozy** and `fast` is gone. It clicks **Fast**, then **Exit**. The URL keeps `theme=kitchen` and `fast=1`.

Last, it repeats the Feature session with reduced motion and no `fast` parameter. The body must still have class `fast`, and the ticket must still say ready. `?hint=0` hides the kitchen hint. The helper does not report fps.

## Evidence

Proof goes to `/tmp/verify-pstack-map/`. `result.json` is the pass or fail record. Screenshots in that directory are the overview of each theme, the opened skill, and the kitchen sessions in `session-kitchen.png` and `skill-flow-kitchen.png`. The branch row saves the open question in `branch-kitchen.png` and the carried plate in `waiter-kitchen.png`. Cleanup must not delete `/tmp/verify-pstack-map`.

## Cleanup

Kill the server pid you started. Do not kill by process name. Do not delete `/tmp/verify-pstack-map`.

## Helpers

`.cursor/skills/verify-pstack-map/drive.mjs` is executable. Run it with the command in Drive. The feature map is `features/README.md`.

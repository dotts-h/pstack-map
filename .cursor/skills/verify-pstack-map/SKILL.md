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

`puppeteer-core` is already installed at `/tmp/node_modules/puppeteer-core`. Do not add it to a package.json. This repo has no package.json and must not gain one.

With the server up, from the repo root:

```sh
node .cursor/skills/verify-pstack-map/drive.mjs
```

The helper loads `/?hint=0&theme=galaxy`, `circuit`, `earth`, `brain`, and `kitchen`. It waits for `window.__ready`. It records console errors and any HTTP status of 400 or higher, and it fails on those.

On galaxy, circuit, earth, and brain it opens `architect` with `?focus=architect`. The card title must be the skill title. The card sentence must equal `oneLiner` from `copy.mjs` for that node.

On kitchen it opens `/?theme=kitchen&hint=0&open=architect`, clicks **Open skill file**, and checks that the modal contains a sentence from that node's `text` field. The sentence must not be only the one-line description.

It then loads `/?theme=kitchen&hint=0&fast=1&session=playbook:feature`. `document.body` must have class `fast` before Play. A computed `animation-name` on `#hint` or `.btn.play` must be `none`. The lower third must not say Order up yet. The helper clicks **Play session**, then `#lt .ttl` must say Order up within 30 seconds. The helper does not report fps.

## Evidence

Proof goes to `/tmp/verify-pstack-map/`. `result.json` is the pass or fail record. Screenshots in that directory are the overview of each theme and the opened skill. Cleanup must not delete `/tmp/verify-pstack-map`.

## Cleanup

Kill the server pid you started. Do not kill by process name. Do not delete `/tmp/verify-pstack-map`.

## Helpers

`.cursor/skills/verify-pstack-map/drive.mjs` is executable. Run it with the command in Drive. The feature map is `features/README.md`.

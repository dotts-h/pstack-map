# Kitchen session

In the kitchen, a station opens its card, **Open skill file** shows the source from `data/files.json`, a fast session still reaches Order up, and a cozy skill session stops on its file's decisions before the waiter carries the plate out.

## Sub-features

- `station-open` opens the architect station card.
- `file-body` shows a sentence from that node's `text` that is not only the one-line description. The body comes from `data/files.json` after the click.
- `file-missing` shows the path and says the file is not in the map data when the path is not in `data/files.json`.
- `file-query` opens a principle and the router through `?file=` and shows each file's body.
- `fast-class` puts class `fast` on `body` for `?fast=1` and turns off CSS animation.
- `fast-order` reaches `Order up` on the lower third for `?fast=1&session=playbook:feature` with no click, with no question bubble and no waiter.
- `session-start` starts a session at once from a ticket click or `?session=`.
- `skill-flow` plays one skill's flow from a station click or its label.
- `branch` stops a cozy skill session on a decision from its SKILL.md. A bubble over the cook shows the question, its `SKILL.md` line, and Yes and No. The answer can skip steps, which the ticket greys out and strikes through.
- `waiter` sends a waiter to the pass at Order up. He lifts the plate, carries it out, and the ticket says served.
- `empty-ticket` takes a ticket with nothing to cook straight to Served, with no waiter.
- `exit-theme` leaves the session with Exit and keeps `theme=kitchen`.
- `pause` pauses and resumes the session with Pause, Resume, and Space.
- `pace-toggle` turns fast on from Fast, and turns the user choice off from Cozy. Reduced motion stays fast.
- `pace-url` stores that choice in the URL. Fast sets `fast=1`. Cozy removes `fast`. Exit keeps `theme=kitchen` and `fast=1`.

## How to get to it (user POV)

- Open `/?theme=kitchen`.
- Open `/?theme=kitchen&open=architect` to see the architect station card.
- Choose **Open skill file** on the station card.
- Open `/?theme=kitchen&file=pstack/skills/principle-laziness-protocol/SKILL.md` for a principle, or `/?theme=kitchen&file=pstack/skills/poteto-mode/SKILL.md` for the router.
- Click a ticket on the rail. The session starts at once.
- Click a station or its label. That skill's flow plays.
- In Cozy, wait for a skill's cook to stop at a question. Click Yes or No, or let the default answer after 1.5 seconds. `?pick=1:no` answers the second question No, and `?pick=no` answers every question No.
- Use Pause, Replay, or Exit on the lower third.
- Choose Cozy or Fast in the header. Fast puts `fast=1` in the URL. Cozy removes it. `?fast=1` starts on Fast.
- Press Esc. It closes the file, then the station card.

## Driving it with drive.mjs

Preconditions:

- The kitchen overview reached `window.__ready` with no console errors.
- The architect node in `data/graph.json` has a non-empty `text` string.

- **Open the station.** The helper loads `/?theme=kitchen&hint=0&open=architect` and waits for `#card .flink`.
- **Open the file.** The helper clicks **Open skill file** and waits until `#modal .mb` contains a sentence from `node.text` that is not the description and not the `oneLiner`. The click requests `data/files.json`. The page did not request that file before the click.
- **Query file.** The helper loads `/?theme=kitchen&hint=0&file=pstack/skills/principle-laziness-protocol/SKILL.md` and waits until the modal body contains `Do not repeat the same choice in several places.` It loads `/?theme=kitchen&hint=0&file=pstack/skills/poteto-mode/SKILL.md` and waits until the modal body contains `Cite only principles whose leaf SKILL.md you read this session.`
- **Check fast mode.** The helper loads `/?theme=kitchen&hint=0&fast=1&session=playbook:feature`. At `window.__ready`, `document.body` has class `fast`, `#hint` has computed `animation-name` `none` and `transition-duration` `0s`, `document.getAnimations()` is empty, there is no `#pvPlay`, and `#lt` is showing. `#lt .ttl` says Order up within 30 seconds. `#ticket .k` says ready. There is no `.qb`, and `window.__srv()[1]` is `null`.
- **Exit.** The helper clicks `#ltExit`. The new URL has `theme=kitchen` and no `session`.
- **Skill flow.** The helper loads `/?theme=kitchen&hint=0&fast=1&session=skill:architect`. `#lt .ttl` says Order up, and `#ticket .k` says order up. There is no `.qb`, and there is no waiter.
- **Ticket click.** The helper loads `/?theme=kitchen&hint=0&fast=1`, sets a marker on `window`, and clicks `#rail .tk[data-id="playbook:feature"]`. `#lt .ttl` says Order up, the marker is still there, and there is no `.qb` and no waiter.
- **Branch.** The helper loads `/?theme=kitchen&hint=0&freeze=1&session=skill:how&pick=1:no` and calls `window.__step(0.25)` until `.qb .qq` reads `Is the task complex?`. `.qb .qs` reads `SKILL.md:` and a line, and `#ticket li.skip` is empty. It steps on until `window.__srv()[1]` is `carry`, then until `window.__srv()[0]` is `served`. `#ticket li.skip` lists `Explore (complex only)` and `Synthesize (complex only)`, and `#ticket .k` says served.
- **Empty ticket.** The helper loads `/?theme=kitchen&hint=0&freeze=1&session=playbook:opening-a-pr` and calls `window.__step(0.25)` eight times. `window.__T()` has advanced, and `window.__srv()` is `['served', null]`.
- **Pace URL.** The helper loads `/?theme=kitchen&hint=0&session=playbook:feature` with no `fast` parameter. It clicks **Fast**. `location.search` has `fast=1` and the document did not reload. It clicks **Cozy**. `fast` is absent and the document did not reload. It clicks **Fast**, then `#ltExit`. The URL has `theme=kitchen` and `fast=1`, and no `session`.
- **Check reduced motion.** The helper loads the Feature session without `fast=1`, with `prefers-reduced-motion: reduce`. The motion checks from fast mode hold, `#ticket .k` says ready, and there is no `.qb` and no waiter.
- **Proof.** The opened file screenshot is `/tmp/verify-pstack-map/skill-kitchen.png`. The kitchen overview is `overview-kitchen.png`. The sessions are `session-kitchen.png` and `skill-flow-kitchen.png`. The open question is `branch-kitchen.png`, and the carried plate is `waiter-kitchen.png`.

## Gotchas

- Fast mode skips the waiter, so a fast ticket stays at `Order up · ready` and never says Served.
- Choosing Fast while the waiter is already carrying ends the session at Served and clears the waiter. An empty ticket reaches Served without an Order up label.
- Fast, reduced motion, and playbook sessions never ask a question. Only a cozy skill session shows `.qb`.
- The branch and empty-ticket rows use `?freeze=1`, so the clock moves only on `window.__step`. Without it, the live loop also advances time, and a real-time cozy run under swiftshader is slow.
- The `.qb` bubble is a CSS2D element. It joins the DOM on the next render, which `window.__step` performs.
- `?pick=` indexes count a skill's branches from 0, so `1:no` is the second question.
- A skill flow's kicker says `Skill · order up`, not ready.
- The rail sorts tickets by step count and is wider than the viewport, so the driver picks Feature by `data-id`, not by position.
- `?t=` is clamped to 60 seconds.
- Cozy does not override `prefers-reduced-motion`. The page stays fast, and the Fast control stays selected. Reduced motion does not write `fast=1`.
- Fast writes `fast=1` with `history.replaceState`. Cozy deletes `fast`. Exit copies the query, so the Fast choice stays after Exit.
- `?hint=0` hides the map hint and the kitchen hint. The kitchen `#hint` element stays in the page, so the motion checks can read its computed style.
- Do not look for an fps counter. The helper does not record one.
- The modal reads `data/files.json` on the first open. It does not read `node.text` from the graph. A path that is not in that file gets the miss sentence, `The file is not in the map data.`
- Do not delete `/tmp/verify-pstack-map` during cleanup.

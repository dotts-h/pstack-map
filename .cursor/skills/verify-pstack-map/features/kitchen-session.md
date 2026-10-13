# Kitchen session

In the kitchen, a station opens its card, **Open skill file** shows the source from the graph, and a fast session still reaches Order up.

## Sub-features

- `station-open` opens the architect station card.
- `file-body` shows a sentence from that node's `text` that is not only the one-line description.
- `file-missing` shows the path and says the file is not in the map data when `text` is absent.
- `fast-class` puts class `fast` on `body` for `?fast=1` and turns off CSS animation.
- `fast-order` reaches `Order up` on the lower third for `?fast=1&session=playbook:feature` with no click.
- `session-start` starts a session at once from a ticket click or `?session=`.
- `skill-flow` plays one skill's flow from a station click or its label.
- `exit-theme` leaves the session with Exit and keeps `theme=kitchen`.
- `pause` pauses and resumes the session with Pause, Resume, and Space.
- `pace-toggle` turns fast on from Fast, and turns the user choice off from Cozy. Reduced motion stays fast.

## How to get to it (user POV)

- Open `/?theme=kitchen`.
- Open `/?theme=kitchen&open=architect` to see the architect station card.
- Choose **Open skill file** on the station card.
- Click a ticket on the rail. The session starts at once.
- Click a station or its label. That skill's flow plays.
- Use Pause, Replay, or Exit on the lower third.
- Choose Cozy or Fast in the header. `?fast=1` starts on Fast.
- Press Esc. It closes the file, then the station card.

## Driving it with drive.mjs

Preconditions:

- The kitchen overview reached `window.__ready` with no console errors.
- The architect node in `data/graph.json` has a non-empty `text` string.

- **Open the station.** The helper loads `/?theme=kitchen&hint=0&open=architect` and waits for `#card .flink`.
- **Open the file.** The helper clicks **Open skill file**. The modal text must contain a sentence from `node.text` that is not the description and not the `oneLiner`.
- **Check fast mode.** The helper loads `/?theme=kitchen&hint=0&fast=1&session=playbook:feature`. At `window.__ready`, `document.body` has class `fast`, `#hint` has computed `animation-name` `none` and `transition-duration` `0s`, `document.getAnimations()` is empty, there is no `#pvPlay`, and `#lt` is showing. `#lt .ttl` says Order up within 30 seconds. `#ticket .k` says ready.
- **Exit.** The helper clicks `#ltExit`. The new URL has `theme=kitchen` and no `session`.
- **Skill flow.** The helper loads `/?theme=kitchen&hint=0&fast=1&session=skill:architect`. `#lt .ttl` says Order up, and `#ticket .k` says order up.
- **Ticket click.** The helper loads `/?theme=kitchen&hint=0&fast=1`, sets a marker on `window`, and clicks `#rail .tk[data-id="playbook:feature"]`. `#lt .ttl` says Order up, and the marker is still there.
- **Check reduced motion.** The helper loads the Feature session without `fast=1`, with `prefers-reduced-motion: reduce`. The motion checks from fast mode hold, and `#ticket .k` says ready.
- **Proof.** The opened file screenshot is `/tmp/verify-pstack-map/skill-kitchen.png`. The kitchen overview is `overview-kitchen.png`. The sessions are `session-kitchen.png` and `skill-flow-kitchen.png`.

## Gotchas

- Fast mode skips the waiter, so a fast ticket stays at `Order up · ready` and never says Served.
- A skill flow's kicker says `Skill · order up`, not ready.
- The rail sorts tickets by step count and is wider than the viewport, so the driver picks Feature by `data-id`, not by position.
- `?t=` is clamped to 60 seconds.
- Cozy does not override `prefers-reduced-motion`. The page stays fast, and the Fast control stays selected.
- `?hint=0` hides the map hint and the kitchen hint. The kitchen `#hint` element stays in the page, so the motion checks can read its computed style.
- Do not look for an fps counter. The helper does not record one.
- A missing `text` field must not be filled with invented copy. The modal names the path and says the file is not in the map data.
- Do not delete `/tmp/verify-pstack-map` during cleanup.

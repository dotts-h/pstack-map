# Kitchen session

In the kitchen, a station opens its card, **Open skill file** shows the source from the graph, and a fast session still reaches Order up.

## Sub-features

- `station-open` opens the architect station card.
- `file-body` shows a sentence from that node's `text` that is not only the one-line description.
- `file-missing` shows the path and says the file is not in the map data when `text` is absent.
- `fast-class` puts class `fast` on `body` for `?fast=1` and turns off CSS animation.
- `fast-order` reaches `Order up` on the lower third after Play, for `?fast=1&session=playbook:feature`. The session does not start before Play.
- `pace-toggle` turns fast on from Fast, and turns the user choice off from Cozy. Reduced motion stays fast.

## How to get to it (user POV)

- Open `/?theme=kitchen`.
- Click a station in the scene, or open `/?theme=kitchen&open=architect`.
- Choose **Open skill file** on the station card.
- Click a ticket on the rail, then **Play session**. `?fast=1` still waits for Play. After Play, steps land at once and the lower third says Order up.
- Choose Cozy or Fast in the header. `?fast=1` starts on Fast.
- Press Esc. It closes the file, then the station card, then the ticket preview.

## Driving it with drive.mjs

Preconditions:

- The kitchen overview reached `window.__ready` with no console errors.
- The architect node in `data/graph.json` has a non-empty `text` string.

- **Open the station.** The helper loads `/?theme=kitchen&hint=0&open=architect` and waits for `#card .flink`.
- **Open the file.** The helper clicks **Open skill file**. The modal text must contain a sentence from `node.text` that is not the description and not the `oneLiner`.
- **Check fast mode.** The helper loads `/?theme=kitchen&hint=0&fast=1&session=playbook:feature` and waits for `#pvPlay`, then waits 2 seconds. `document.body` has class `fast`. Computed `animation-name` on `#hint` and `.btn.play` is `none`. `transition-duration` is `0s`. `#lt .ttl` does not say Order up yet. The helper clicks **Play session**. `#lt .ttl` says Order up within 30 seconds. `#ticket .k` says ready.
- **Check reduced motion.** The helper loads the same session without `fast=1`, with `prefers-reduced-motion: reduce`. The body has class `fast`. Play still reaches Order up.
- **Proof.** The opened file screenshot is `/tmp/verify-pstack-map/skill-kitchen.png`. The kitchen overview is `overview-kitchen.png`.

## Gotchas

- Fast mode still waits for Play. The ticket HTML says Order up only after the session starts, so a body-text search can pass before the lower third updates. The check uses `#lt .ttl` after the Play click.
- Cozy does not override `prefers-reduced-motion`. The page stays fast, and the Fast control stays selected.
- `?hint=0` hides the map hint and the kitchen hint. The fast check still finds `#hint` while a ticket preview is open, because that preview shows the Play hint.
- Do not look for an fps counter. The helper does not record one.
- A missing `text` field must not be filled with invented copy. The modal names the path and says the file is not in the map data.
- Do not delete `/tmp/verify-pstack-map` during cleanup.

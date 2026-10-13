# Kitchen session

In the kitchen, a station opens its card, **Open skill file** shows the source from the graph, and a fast session still reaches Order up.

## Sub-features

- `station-open` opens the architect station card.
- `file-body` shows a sentence from that node's `text` that is not only the one-line description.
- `file-missing` shows the path and says the file is not in the map data when `text` is absent.
- `fast-class` puts class `fast` on `body` for `?fast=1` and turns off CSS animation.
- `fast-order` shows `Order up` for `?session=playbook:feature` while fast is on.
- `pace-toggle` turns fast on from Fast, and turns the user choice off from Cozy. Reduced motion stays fast.

## How to get to it (user POV)

- Open `/?theme=kitchen`.
- Click a station in the scene, or open `/?theme=kitchen&open=architect`.
- Choose **Open skill file** on the station card.
- Click a ticket on the rail, then **Play session**. With `?fast=1` and `?session=`, the session starts without waiting on Play.
- Choose Cozy or Fast in the header. `?fast=1` starts on Fast.
- Press Esc. It closes the file, then the station card, then the ticket preview.

## Driving it with drive.mjs

Preconditions:

- The kitchen overview reached `window.__ready` with no console errors.
- The architect node in `data/graph.json` has a non-empty `text` string.

- **Open the station.** The helper loads `/?theme=kitchen&hint=0&open=architect` and waits for `#card .flink`.
- **Open the file.** The helper clicks **Open skill file**. The modal text must contain a sentence from `node.text` that is not the description and not the `oneLiner`.
- **Check fast mode.** The helper loads `/?theme=kitchen&hint=0&fast=1&session=playbook:feature`. `document.body` has class `fast`. Computed `animation-name` on `#hint` or `.btn.play` is `none`. The page shows `Order up` within 30 seconds.
- **Proof.** The opened file screenshot is `/tmp/verify-pstack-map/skill-kitchen.png`. The kitchen overview is `overview-kitchen.png`.

## Gotchas

- Fast mode starts a `?session=` ticket without waiting for Play, so Order up can appear on the first frames. Cozy mode still waits for Play.
- Cozy does not override `prefers-reduced-motion`. The page stays fast, and the Fast control stays selected.
- `?hint=0` hides the map hint. The kitchen has its own `#hint`. The fast check uses that element when it is present.
- Do not look for an fps counter. The helper does not record one.
- A missing `text` field must not be filled with invented copy. The modal names the path and says the file is not in the map data.
- Do not delete `/tmp/verify-pstack-map` during cleanup.

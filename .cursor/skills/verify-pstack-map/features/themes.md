# Themes

A reader picks Galaxy, Kitchen, Circuit, Earth, or Brain and gets that scene, with the same header.

## Sub-features

- `theme-galaxy` loads the galaxy scene for `galaxy`, for `sphere`, and for an unknown theme name.
- `theme-circuit` loads the circuit scene.
- `theme-earth` loads the earth scene.
- `theme-brain` loads the brain scene.
- `theme-kitchen` loads the cozy kitchen and does not load the shared map scene.
- `theme-ready` sets `window.__ready` after the first frame and removes the loading panel.

## How to get to it (user POV)

- Open the site with no theme query. The page is galaxy.
- Choose a theme in the header menu labeled Theme.
- Open `/?theme=galaxy`, `/?theme=kitchen`, `/?theme=circuit`, `/?theme=earth`, or `/?theme=brain`.
- Open `/?theme=sphere` or an unknown `theme` value. Both show galaxy.

## Driving it with drive.mjs

Preconditions:

- The server from Launch returns 200 on `http://127.0.0.1:8765/`.
- `node .cursor/skills/verify-pstack-map/drive.mjs` can launch Chrome.

- **Open each theme.** Visit the five theme URLs with `hint=0`. The helper loads `/?hint=0&theme=galaxy`, then circuit, earth, brain, and kitchen. `window.__ready` becomes true, the loading panel is gone, and the overview screenshot is written.
- **Reject bad loads.** The helper records console errors and HTTP statuses of 400 or higher for that navigation. Any of those fails the run.
- **Proof.** Overview screenshots are `/tmp/verify-pstack-map/overview-<theme>.png`.

## Gotchas

- `boot.mjs` sends only `kitchen` to `kitchen.mjs`. Every other allowed theme, including `sphere` and unknown names, loads `map.js`.
- Kitchen CSS is added by `kitchen.mjs`. A galaxy page must not include `kitchen.css`.
- `window.__ready` means the first frame ran. It does not mean a focused card is open yet.
- Do not delete `/tmp/verify-pstack-map` when you stop the server.

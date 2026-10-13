# pstack map

An interactive 3D map of the [pstack](https://github.com/cursor/plugins/tree/main/pstack) Cursor plugin. Galaxy is the default: workflows are stars on five spiral arms, and the tools, rules, and docs that belong to them orbit those stars. Click a body to fly to it and open its card beside the system; chips travel onward and leave a breadcrumb trail. A workflow with several steps can play them from the card. Nothing starts playing on its own.

The header theme menu also opens Kitchen, Circuit, Earth, and Brain. `?theme=galaxy|kitchen|circuit|earth|brain` is a shareable link and stays put while you travel. `?theme=sphere` and any unknown theme open Galaxy.

**Live:** https://dotts-h.github.io/pstack-map/

## How the data refreshes

`data/graph.json` is generated from the public [cursor/plugins](https://github.com/cursor/plugins) repository (`pstack/`) by `scripts/extract-graph.mjs`. It records the upstream commit SHA and commit date.

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs on every push to `main`, every Monday at 06:00 UTC, and when started by hand. It checks out the latest `cursor/plugins`, regenerates the graph, and runs `scripts/validate-graph.mjs`. The site is deployed to GitHub Pages only if validation passes, so a bad extract leaves the last good site up. On the weekly run, if the extract finds nothing new, there is no commit and no deploy.

Regenerate locally (Node, no packages):

```sh
node scripts/extract-graph.mjs path/to/plugins/pstack --out data/graph.json --readme data/README-data.md
python3 scripts/skill-flows/mkflows.py path/to/plugins/pstack data/skill-flows.json
python3 scripts/skill-flows/mkfiles.py path/to/plugins data/graph.json data/files.json
node scripts/validate-graph.mjs data/graph.json
node scripts/check-layout.mjs data/graph.json
```

Serve the repo root and open the site (paths are relative, so it also works under `/pstack-map/`):

```sh
python3 -m http.server 8765
```

## Credits

pstack is by [Lauren Tan](https://github.com/cursor/plugins/tree/main/pstack), MIT license. This map reads that content; it does not replace it.

The 3D view uses [Three.js](https://github.com/mrdoob/three.js) r169 (MIT), vendored in `vendor/`. `vendor/CSS2DRenderer.js` keeps a one-line patch that rounds label positions to whole pixels.

Galaxy planet surfaces are from [Solar System Scope](https://www.solarsystemscope.com/textures/) (INOVE), CC BY 4.0. The Milky Way backdrop is [ESO/S. Brunier](https://www.eso.org/public/images/eso0932a/), CC BY 4.0. See `NOTICE`.

Code in this repository is MIT licensed. See `LICENSE`.

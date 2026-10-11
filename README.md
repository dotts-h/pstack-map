# pstack map

An interactive 3D map of the [pstack](https://github.com/cursor/plugins/tree/main/pstack) Cursor plugin: the `/poteto-mode` router, playbooks, principles, skills, and the scripts and references that connect them.

**Live:** https://dotts-h.github.io/pstack-map/

## How the data refreshes

`data/graph.json` is generated from the public [cursor/plugins](https://github.com/cursor/plugins) repository (`pstack/`) by `scripts/extract-graph.mjs`. It records the upstream commit SHA and commit date.

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs on every push to `main`, every Monday at 06:00 UTC, and when started by hand. It checks out the latest `cursor/plugins`, regenerates the graph, and runs `scripts/validate-graph.mjs`. The site is deployed to GitHub Pages only if validation passes, so a bad extract leaves the last good site up. On the weekly run, if the extract finds nothing new, there is no commit and no deploy.

Regenerate locally (Node, no packages):

```sh
node scripts/extract-graph.mjs path/to/plugins/pstack --out data/graph.json --readme data/README-data.md
node scripts/validate-graph.mjs data/graph.json
node scripts/check-layout.mjs data/graph.json
```

Serve the repo root and open the site (paths are relative, so it also works under `/pstack-map/`):

```sh
python3 -m http.server 8765
```

## Credits

pstack is by [Lauren Tan](https://github.com/cursor/plugins/tree/main/pstack), MIT license. This map reads that content; it does not replace it.

The 3D view uses [Three.js](https://github.com/mrdoob/three.js) r169 (MIT), vendored in `vendor/`. `vendor/CSS2DRenderer.js` keeps a one-line patch that rounds label positions to whole pixels. See `NOTICE`.

Code in this repository is MIT licensed. See `LICENSE`.

# Skill card

On galaxy, circuit, earth, and brain, choosing a skill opens the shared card. The title is the skill title. The sentence is the graph description, shortened by `oneLiner`.

## Sub-features

- `card-open` opens the architect card from the focus query.
- `card-title` shows the skill title `Architect`.
- `card-sentence` shows the same string `oneLiner` returns for that node.

## How to get to it (user POV)

- Click a visible skill in the scene.
- Open `/?theme=galaxy&focus=architect`, or the same `focus` value with `theme` set to `circuit`, `earth`, or `brain`.
- Use search in the header and choose Architect.

## Driving it with drive.mjs

Preconditions:

- The theme overview for that theme already reached `window.__ready` with no console errors.
- `data/graph.json` contains the `architect` skill.

- **Open the card.** The helper loads `/?hint=0&theme=<theme>&focus=architect` for galaxy, circuit, earth, and brain. It waits until `#popTitle` reads `Architect`.
- **Check the title.** The helper compares `#popTitle` with `plainName` for the architect node. They must match.
- **Check the sentence.** The helper compares `#pop .what` with `oneLiner(architect, graph)`. They must match.
- **Proof.** The opened card screenshot is `/tmp/verify-pstack-map/skill-<theme>.png`.

## Gotchas

- `__ready` fires on the first frame. The focus card opens after that, on a short delay. Wait for `#popTitle`, not only for `__ready`.
- The card title is the skill title from `plainName`, not the raw id `architect`.
- The sentence is the shortened description. It is not the skill file body. File body is the kitchen check.
- Kitchen does not use this card. Do not treat a kitchen station card as this proof.

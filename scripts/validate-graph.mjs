#!/usr/bin/env node
// Validates data/graph.json against the contract in SPEC.md. Exits 1 on any problem.
// Usage: node scripts/validate-graph.mjs [data/graph.json]
import fs from "node:fs";

const file = process.argv[2] ?? "data/graph.json";
const errors = [];
let g;
try {
  g = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`invalid JSON in ${file}: ${e.message}`);
  process.exit(1);
}
const isStr = (v) => typeof v === "string" && v.length > 0;
if (g.schemaVersion !== 1) errors.push("schemaVersion must be 1");
for (const k of ["repo", "commit", "commitDate", "version"]) if (!isStr(g.upstream?.[k])) errors.push(`upstream.${k} missing`);
if (g.upstream?.commit && !/^[0-9a-f]{40}$/.test(g.upstream.commit)) errors.push("upstream.commit is not a full SHA");
if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) errors.push("nodes and edges must be arrays");
const MODES = new Set(["always", "conditional", "step"]);
const ids = new Set();
for (const [i, n] of (g.nodes ?? []).entries()) {
  for (const k of ["id", "kind", "name", "group", "path"]) if (!isStr(n[k])) errors.push(`nodes[${i}].${k} missing`);
  if (typeof n.description !== "string") errors.push(`nodes[${i}].description must be a string`);
  if (ids.has(n.id)) errors.push(`duplicate node id ${n.id}`);
  if (n.kind === "principle" && !(n.appliesWhen === null || isStr(n.appliesWhen))) errors.push(`nodes[${i}].appliesWhen must be a string or null`);
  if ((n.kind === "skill" || n.kind === "playbook") && !isStr(n.text)) errors.push(`nodes[${i}].text must be a non-empty string`);
  ids.add(n.id);
}
if (!(g.nodes ?? []).some((n) => n.kind === "router")) errors.push("no router node");
for (const [i, e] of (g.edges ?? []).entries()) {
  for (const k of ["source", "target", "type"]) if (!isStr(e[k])) errors.push(`edges[${i}].${k} missing`);
  if (!ids.has(e.source)) errors.push(`edges[${i}] source ${e.source} is not a node`);
  if (!ids.has(e.target)) errors.push(`edges[${i}] target ${e.target} is not a node`);
  if (!Array.isArray(e.evidence) || e.evidence.length === 0) errors.push(`edges[${i}] has no evidence`);
  if (!MODES.has(e.mode)) errors.push(`edges[${i}].mode must be one of ${[...MODES].join(" | ")}`);
  if (!(e.when === null || isStr(e.when))) errors.push(`edges[${i}].when must be a non-empty string or null`);
  if (e.mode === "step" ? !Number.isInteger(e.order) : e.order !== undefined) errors.push(`edges[${i}].order must be an integer exactly when mode is step`);
  for (const v of e.evidence ?? []) if (!isStr(v.path) || !Number.isInteger(v.line)) errors.push(`edges[${i}] evidence needs path and line`);
}
if (g.counts?.nodes !== g.nodes?.length || g.counts?.edges !== g.edges?.length) errors.push("counts do not match arrays");
if (errors.length) {
  console.error(`${file}: ${errors.length} problem(s)\n- ${errors.slice(0, 50).join("\n- ")}`);
  process.exit(1);
}
console.log(`${file}: ok (${g.nodes.length} nodes, ${g.edges.length} edges, commit ${g.upstream.commit.slice(0, 7)})`);

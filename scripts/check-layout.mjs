#!/usr/bin/env node
// Checks home positions against SPEC acceptance check 3.
// Usage: node scripts/check-layout.mjs [data/graph.json]
import fs from 'node:fs';
import { checkLayout } from '../layout.mjs';

const file = process.argv[2] ?? 'data/graph.json';
let graph;
try {
  graph = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`invalid JSON in ${file}: ${e.message}`);
  process.exit(1);
}
const result = checkLayout(graph);
if (!result.ok) {
  console.error(`${file}: layout check failed\n- ${result.errors.slice(0, 30).join('\n- ')}`);
  process.exit(1);
}
console.log(`${file}: layout ok (${result.summary})`);

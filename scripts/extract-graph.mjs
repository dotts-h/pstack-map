#!/usr/bin/env node
// Builds data/graph.json from a pstack checkout (cursor/plugins, folder pstack/).
// Usage: node scripts/extract-graph.mjs <path-to-pstack> [--out data/graph.json] [--readme data/README-data.md]
//        [--commit <sha>] [--commit-date <iso>] [--repo cursor/plugins]
// Output is deterministic: same checkout in, byte-identical JSON out.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const ROOT = path.resolve(positional[0] ?? "pstack");
const OUT = path.resolve(opt("--out", "data/graph.json"));
const REPO = opt("--repo", "cursor/plugins");
const README = opt("--readme", null) ? path.resolve(opt("--readme")) : null;
if (!fs.existsSync(path.join(ROOT, ".cursor-plugin/plugin.json"))) {
  console.error(`not a pstack checkout (no .cursor-plugin/plugin.json): ${ROOT}`);
  process.exit(1);
}

function git(...a) {
  try {
    return execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
const toplevel = git("rev-parse", "--show-toplevel");
const PREFIX = toplevel ? path.relative(toplevel, ROOT).split(path.sep).join("/") : "pstack";
const commit = opt("--commit", git("rev-parse", "HEAD"));
const rawDate = opt("--commit-date", git("log", "-1", "--format=%cI", "HEAD"));
const commitDate = rawDate ? new Date(rawDate).toISOString() : null;
const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, ".cursor-plugin/plugin.json"), "utf8"));
const licenseText = fs.existsSync(path.join(ROOT, "LICENSE")) ? fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8") : "";
const copyright = (licenseText.match(/^Copyright.*$/m) || [null])[0];

const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");
const repoPath = (r) => (PREFIX ? `${PREFIX}/${r}` : r);
const read = (r) => fs.readFileSync(path.join(ROOT, r), "utf8");
const lineCount = (text) => (text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0));
const exists = (r) => fs.existsSync(path.join(ROOT, r));
const isDir = (r) => exists(r) && fs.statSync(path.join(ROOT, r)).isDirectory();
const ls = (r) => (isDir(r) ? fs.readdirSync(path.join(ROOT, r)).sort() : []);
function walk(r) {
  const out = [];
  for (const name of ls(r)) {
    const child = r ? `${r}/${name}` : name;
    if (isDir(child)) out.push(...walk(child));
    else out.push(child);
  }
  return out;
}
const kebab = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
const TEXT_EXT = /\.(md|mjs|js|ts|sh|json|tsv|yaml|yml|txt)$/;
const isText = (r) => TEXT_EXT.test(r) || !path.basename(r).includes(".");

// Frontmatter: flat `key: value` pairs, quoted strings, inline arrays, and `>-`/`|` blocks.
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { data: {}, body: text };
  const data = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, value] = kv;
    if (/^[>|][-+]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S|^\s*$/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = value.startsWith(">") ? block.filter(Boolean).join(" ") : block.join("\n").trim();
    } else if (/^".*"$/.test(value)) {
      value = JSON.parse(value);
    } else if (/^'.*'$/.test(value)) {
      value = value.slice(1, -1).replace(/''/g, "'");
    } else if (/^\[.*\]$/.test(value)) {
      try { value = JSON.parse(value); } catch { /* keep raw */ }
    } else if (value === "true" || value === "false") {
      value = value === "true";
    }
    data[key] = value;
  }
  return { data, body: text.slice(m[0].length), bodyStartLine: m[0].split("\n").length };
}
const firstHeading = (text) => ((text.match(/^#{1,6}\s+(.+)$/m) || [])[1] || "").trim();
function firstParagraph(text) {
  const { body } = frontmatter(text);
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim();
    if (t && !t.startsWith("#") && !t.startsWith("```") && !t.startsWith("#!")) return t.replace(/\s+/g, " ");
  }
  return "";
}
function leadingComment(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("#!")) continue;
    const c = line.match(/^\s*(?:#|\/\/)\s?(.*)$/);
    if (!c) break;
    if (/^Usage:/i.test(c[1])) break;
    out.push(c[1]);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

// ---------- nodes ----------
const nodes = new Map();
function addNode(n) {
  if (nodes.has(n.id)) throw new Error(`duplicate node id ${n.id}`);
  nodes.set(n.id, n);
}
const fileOwner = new Map(); // pstack-relative file -> node id (for path resolution)
const scanFiles = new Map(); // node id -> files whose text is scanned for edges

function skillNode(dir, { kind: forcedKind, group: forcedGroup, owner } = {}) {
  const file = `${dir}/SKILL.md`;
  const text = read(file);
  const { data } = frontmatter(text);
  const id = path.basename(dir);
  const flags = {};
  for (const [k, v] of Object.entries(data)) if (k !== "name" && k !== "description") flags[k] = v;
  const kind = forcedKind ?? (data.mode === true ? "router" : id.startsWith("principle-") ? "principle" : "skill");
  addNode({
    id, kind, name: data.name ?? id, title: firstHeading(frontmatter(text).body) || null,
    group: forcedGroup ?? (kind === "router" ? "router" : kind === "principle" ? "principles" : "skills"),
    description: data.description ?? "", path: repoPath(file), owner: owner ?? null,
    lines: lineCount(text), flags,
  });
  fileOwner.set(file, id);
  scanFiles.set(id, [file]);
  return id;
}

// Skills (and the router) under skills/.
const skillDirs = ls("skills").filter((d) => exists(`skills/${d}/SKILL.md`)).map((d) => `skills/${d}`);
for (const d of skillDirs) skillNode(d);

// Playbooks, scripts, references owned by each skill.
for (const d of skillDirs) {
  const owner = path.basename(d);
  for (const f of ls(`${d}/playbooks`).filter((f) => f.endsWith(".md"))) {
    const file = `${d}/playbooks/${f}`;
    const text = read(file);
    const id = `playbook:${f.replace(/\.md$/, "")}`;
    addNode({
      id, kind: "playbook", name: firstHeading(text) || f, title: firstHeading(text) || null, group: "playbooks",
      description: firstParagraph(text), path: repoPath(file), owner, lines: lineCount(text), flags: {},
    });
    fileOwner.set(file, id);
    scanFiles.set(id, [file]);
  }
  for (const entry of ls(`${d}/scripts`)) {
    const r = `${d}/scripts/${entry}`;
    if (isDir(r)) {
      if (entry === "node_modules") continue;
      const files = walk(r).filter(isText);
      const id = `script:${owner}/${entry}/`;
      const main = files.find((f) => path.basename(f) === entry) ?? files.find((f) => /cli\.|main\.|index\./.test(path.basename(f))) ?? files.find((f) => path.basename(f) === `${entry}.ts`) ?? files[0];
      addNode({
        id, kind: "script", name: `${entry}/`, title: null, group: owner,
        description: leadingComment(read(main)), path: repoPath(r), owner,
        lines: files.reduce((s, f) => s + lineCount(read(f)), 0), flags: {},
        files: files.map(repoPath),
      });
      for (const f of files) fileOwner.set(f, id);
      scanFiles.set(id, files);
    } else if (/\.(mjs|js|ts|sh|py)$/.test(entry)) {
      const text = read(r);
      const id = `script:${owner}/${entry}`;
      addNode({
        id, kind: "script", name: entry, title: null, group: owner, description: leadingComment(text),
        path: repoPath(r), owner, lines: lineCount(text), flags: {},
      });
      fileOwner.set(r, id);
      scanFiles.set(id, [r]);
    }
  }
  for (const file of walk(`${d}/references`)) addReference(file, owner);
}

function addReference(file, owner) {
  const text = read(file);
  const id = `ref:${file.replace(/^skills\//, "")}`;
  addNode({
    id, kind: "reference", name: path.basename(file), title: firstHeading(text) || null, group: owner,
    description: file.endsWith(".md") ? firstParagraph(text) : "", path: repoPath(file), owner,
    lines: lineCount(text), flags: {},
  });
  fileOwner.set(file, id);
  scanFiles.set(id, [file]);
}

// Agents.
for (const f of ls("agents").filter((f) => f.endsWith(".md"))) {
  const file = `agents/${f}`;
  const text = read(file);
  const { data } = frontmatter(text);
  const flags = {};
  for (const [k, v] of Object.entries(data)) if (k !== "name" && k !== "description") flags[k] = v;
  const id = `agent:${f.replace(/\.md$/, "")}`;
  addNode({
    id, kind: "agent", name: data.name ?? f, title: firstHeading(frontmatter(text).body) || null, group: "agents",
    description: data.description ?? "", path: repoPath(file), owner: null, lines: lineCount(text), flags,
  });
  fileOwner.set(file, id);
  scanFiles.set(id, [file]);
}

// Automation packs: the pack itself, its dormant skills, and its other files as references.
for (const pack of ls("automations").filter((p) => isDir(`automations/${p}`))) {
  const dir = `automations/${pack}`;
  const packId = `automation:${pack}`;
  const readme = exists(`${dir}/README.md`) ? `${dir}/README.md` : null;
  const text = readme ? read(readme) : "";
  addNode({
    id: packId, kind: "automation", name: pack, title: firstHeading(text) || null, group: "automations",
    description: firstParagraph(text), path: repoPath(dir), owner: null, lines: lineCount(text), flags: {},
  });
  if (readme) { fileOwner.set(readme, packId); scanFiles.set(packId, [readme]); }
  const packSkills = new Set();
  for (const s of ls(`${dir}/skills`).filter((s) => exists(`${dir}/skills/${s}/SKILL.md`))) {
    skillNode(`${dir}/skills/${s}`, { kind: "automation", group: pack, owner: packId });
    packSkills.add(`${dir}/skills/${s}/SKILL.md`);
  }
  for (const file of walk(dir)) {
    if (file === readme || packSkills.has(file) || fileOwner.has(file) || !isText(file)) continue;
    const skillDir = file.match(new RegExp(`^${dir}/skills/([^/]+)/`));
    const textR = read(file);
    const id = `ref:${file.replace(/^automations\//, "")}`;
    addNode({
      id, kind: "reference", name: path.basename(file), title: file.endsWith(".md") ? firstHeading(textR) || null : null,
      group: pack, description: file.endsWith(".md") ? firstParagraph(textR) : "", path: repoPath(file),
      owner: skillDir ? skillDir[1] : packId, lines: lineCount(textR), flags: {},
    });
    fileOwner.set(file, id);
    scanFiles.set(id, [file]);
  }
}

// Quote helpers for edge conditions. Output is always a verbatim substring of the source line,
// trimmed of whitespace, stray bold markers, and trailing punctuation.
function trimQuote(t) {
  let q = t.trim().replace(/^(?:\*\*)+|(?:\*\*)+$/g, "").trim().replace(/[\s.,:;]+$/, "").trim();
  if ((q.match(/\*\*/g) || []).length % 2 === 1) q = q.replace(/\*\*/, "").trim();
  return q || null;
}
function firstSentence(t) {
  const s = t.trim();
  const m = s.match(/^(.+?[.!?])(?=\s+[A-Z`*"(]|\s*$)/);
  return trimQuote(m ? m[1] : s);
}
// Sentence spans of one line: [{ start, end }], split after . ! ? followed by space and a capital/markup.
function sentences(line) {
  const out = [];
  let start = 0;
  const re = /[.!?](?=\s+[A-Z`*"(])/g;
  let m;
  while ((m = re.exec(line))) { out.push({ start, end: m.index + 1 }); start = m.index + 1; }
  out.push({ start, end: line.length });
  return out;
}

// ---------- router metadata: principle groups and playbook index ----------
const router = [...nodes.values()].find((n) => n.kind === "router");
const routerFile = router ? router.path.slice(PREFIX ? PREFIX.length + 1 : 0) : null;
const routerLines = router ? read(routerFile).split("\n") : [];
const routerPlaybookLine = new Map(); // playbook id -> line number of its index entry
const routerIndex = new Map(); // router line number -> { target, when } for principle and playbook index entries
{
  let section = null, sub = null;
  routerLines.forEach((line, i) => {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { section = h[1].trim(); sub = null; return; }
    const s = line.match(/^\*\*([^*]+)\*\*\s*$/);
    if (s) { sub = s[1].trim(); return; }
    const b = line.match(/^- \*\*([^*]+?)\.?\*\*(.*)$/);
    if (!b) return;
    const title = b[1].replace(/\.$/, "");
    if (section === "Principles") {
      const explicit = b[2].match(/\(\*\*(principle-[a-z0-9-]+)\*\*\)/);
      const id = explicit ? explicit[1] : `principle-${kebab(title)}`;
      const n = nodes.get(id);
      if (n) {
        n.group = sub ? sub.toLowerCase() : "principles";
        n.routerTitle = title;
        routerIndex.set(i + 1, { target: id, when: firstSentence(b[2].replace(/^\s*\(\*\*principle-[a-z0-9-]+\*\*\)\.?/, "")) });
      }
    } else if (section === "Playbooks") {
      const explicit = b[2].match(/File:\s*`playbooks\/([^`]+)\.md`/);
      const id = `playbook:${explicit ? explicit[1] : kebab(title)}`;
      const n = nodes.get(id);
      if (n) {
        routerPlaybookLine.set(id, i + 1);
        routerIndex.set(i + 1, { target: id, when: firstSentence(b[2]) });
        n.routerTitle = title;
        const desc = b[2].replace(/\s*File:\s*`[^`]+`\.?\s*$/, "").trim();
        if (desc) { n.description = desc; n.descriptionSource = "router index"; }
      }
    }
  });
}
for (const n of nodes.values()) {
  if (n.kind === "principle" && n.group === "principles") n.group = "unindexed";
  if (n.kind === "playbook" && !n.descriptionSource) n.descriptionSource = "first paragraph";
}

// ---------- name matchers ----------
// Each matcher: { re, target, how }. All case-sensitive.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchers = [];
const B = "(?<![A-Za-z0-9_./-])"; // not inside a word or a path
const A = "(?![A-Za-z0-9_-])"; // ...and not continued (a trailing "." or "/" is checked per match)
for (const n of nodes.values()) {
  if (!["skill", "principle", "router", "automation"].includes(n.kind) || n.id.startsWith("automation:")) continue;
  const id = n.id;
  matchers.push({ re: new RegExp(`(?<![A-Za-z0-9_./-])/${esc(id)}${A}`, "g"), target: id, how: "slash-command" });
  if (id.includes("-")) {
    matchers.push({ re: new RegExp(`${B}${esc(id)}${A}(?!/)`, "g"), target: id, how: "name" });
    if (id.startsWith("principle-")) {
      const short = id.slice("principle-".length);
      matchers.push({ re: new RegExp(`(?:\\*\\*|\`)${esc(short)}(?:\\*\\*|\`)\\s+principle`, "g"), target: id, how: "name (principle prefix omitted)" });
    }
  } else {
    matchers.push({ re: new RegExp(`(?:\\*\\*${esc(id)}\\*\\*|\`${esc(id)}\`)`, "g"), target: id, how: "name (bold/code)" });
    matchers.push({ re: new RegExp(`${B}${esc(id)} skill\\b`, "g"), target: id, how: "name + 'skill'" });
  }
  if (n.kind === "principle") {
    for (const t of new Set([n.title, n.routerTitle].filter(Boolean))) {
      matchers.push({ re: new RegExp(`(?<![A-Za-z])${esc(t)}(?![A-Za-z])`, "g"), target: id, how: "principle title" });
    }
  }
}
for (const n of nodes.values()) {
  if (n.kind === "agent") {
    const slug = n.id.slice("agent:".length);
    matchers.push({ re: new RegExp(`${B}${esc(slug)}${A}(?!/)`, "g"), target: n.id, how: "agent name" });
    if (n.name !== slug) matchers.push({ re: new RegExp(`(?<![A-Za-z])${esc(n.name)}(?![A-Za-z])`, "g"), target: n.id, how: "agent name" });
  }
  if (n.kind === "playbook") {
    for (const t of new Set([n.title, n.routerTitle].filter(Boolean))) {
      matchers.push({ re: new RegExp(`\\*\\*${esc(t)}\\.?\\*\\*`, "g"), target: n.id, how: "playbook title (bold)" });
      matchers.push({ re: new RegExp(`(?<![A-Za-z])${esc(t)}(?:'s)? playbook`, "g"), target: n.id, how: "playbook title + 'playbook'" });
    }
  }
}

// Path-like tokens: relative links, `scripts/...`, `references/...`, `playbooks/...`, bare script filenames.
const PATH_RE = /(?<![A-Za-z0-9_-])(?:\.{1,2}\/)*(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+(?:\.(?:md|mjs|js|ts|sh|tsv|yaml|yml|json)|\/)?(?![A-Za-z0-9_-])/g;
const basenameIndex = new Map();
for (const f of fileOwner.keys()) {
  const b = path.basename(f);
  if (!basenameIndex.has(b)) basenameIndex.set(b, new Set());
  basenameIndex.get(b).add(fileOwner.get(f));
}
const dirOwner = new Map();
for (const n of nodes.values()) if (n.kind === "script" && n.id.endsWith("/")) dirOwner.set(n.path.slice(PREFIX ? PREFIX.length + 1 : 0), n.id);

function skillRootOf(file) {
  const m = file.match(/^(skills\/[^/]+|automations\/[^/]+\/skills\/[^/]+|automations\/[^/]+)\//);
  return m ? m[1] : "";
}
function resolvePath(token, file) {
  let t = token.replace(/\/$/, "");
  if (!t.includes("/") && !/\.(mjs|js|ts|sh)$/.test(t)) return null; // bare words are not paths
  const bases = [path.posix.dirname(file), skillRootOf(file), skillRootOf(file).replace(/\/skills\/[^/]+$/, ""), "", ".."];
  for (const base of new Set(bases)) {
    let cand = path.posix.normalize(base ? `${base}/${t}` : t);
    if (cand.startsWith("../")) cand = cand.replace(/^\.\.\/[^/]+\//, ""); // e.g. ../pstack/skills/... from repo root
    if (cand.startsWith(`${PREFIX}/`)) cand = cand.slice(PREFIX.length + 1);
    if (fileOwner.has(cand)) return fileOwner.get(cand);
    if (dirOwner.has(cand)) return dirOwner.get(cand);
    for (const [d, id] of dirOwner) if (cand.startsWith(`${d}/`)) return id;
  }
  if (!t.includes("/")) {
    const owners = basenameIndex.get(t);
    if (owners && owners.size === 1) return [...owners][0];
  }
  // Path given from repo root with a prefix like "pstack/skills/...".
  const idx = t.indexOf("skills/");
  if (idx > 0) return resolvePath(t.slice(idx), "");
  return null;
}

// ---------- edges ----------
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const edges = new Map();
function edgeType(source, target) {
  const s = nodes.get(source), t = nodes.get(target);
  if (s.kind === "router" && t.kind === "playbook") return "loads";
  if (t.kind === "script") return s.kind === "script" ? "imports" : "runs";
  if (t.kind === "principle" && ["router", "playbook", "skill"].includes(s.kind)) return "applies";
  return "references";
}
function addEdge(source, target, file, line, text, how, col = null) {
  if (!target || source === target) return;
  const type = edgeType(source, target);
  const key = `${source}\u0000${target}\u0000${type}`;
  if (!edges.has(key)) edges.set(key, { source, target, type, evidence: [] });
  const ev = edges.get(key).evidence;
  const p = repoPath(file);
  let item = ev.find((e) => e.path === p && e.line === line);
  if (!item) {
    const snippet = text.trim();
    item = { path: p, line, text: snippet.length > 240 ? `${snippet.slice(0, 237)}...` : snippet, match: how, _file: file, _raw: text, _cols: [] };
    ev.push(item);
  }
  if (col !== null && !item._cols.includes(col)) item._cols.push(col);
}
for (const [source, files] of scanFiles) {
  for (const file of files) {
    if (path.basename(file) === "bun.lock") continue;
    read(file).split("\n").forEach((line, i) => {
      for (const m of matchers) {
        m.re.lastIndex = 0;
        let hit;
        while ((hit = m.re.exec(line))) {
          addEdge(source, m.target, file, i + 1, line, m.how, hit.index);
          if (hit[0] === "") m.re.lastIndex++;
        }
      }
      for (const pm of line.matchAll(PATH_RE)) {
        const target = resolvePath(pm[0], file);
        if (target) addEdge(source, target, file, i + 1, line, "path", pm.index);
      }
    });
  }
}
// Router loads every playbook its index lists (index line is the evidence), even without a path token.
for (const [id, ln] of routerPlaybookLine) addEdge(router.id, id, routerFile, ln, routerLines[ln - 1], "router playbook index");

// ---------- edge modes ----------
// mode: always | conditional | step. `when` quotes the source; `order` is the playbook step number.
// Rank picks the edge-level mode when evidence lines disagree (lower wins, then earliest line).
const caveats = { arrowBeforeTarget: 0, conditionalSentenceNoClause: 0, playbookFenceRefs: 0, mixedModeEdges: 0 };
const lineInfoCache = new Map();
function lineInfo(file) {
  if (lineInfoCache.has(file)) return lineInfoCache.get(file);
  const lines = read(file).split("\n");
  const info = [];
  let inFront = lines[0] === "---", fence = false, section = null, step = null;
  lines.forEach((line, i) => {
    if (inFront && i > 0 && line === "---") { info.push({ front: true }); inFront = false; return; }
    if (inFront) { info.push({ front: true }); return; }
    if (/^\s*```/.test(line)) { fence = !fence; info.push({ fence: true, section, step: null }); return; }
    if (fence) { info.push({ fence: true, section, step: null }); return; }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { if (h[1] === "##") section = h[2].trim(); step = null; info.push({ section, step: null }); return; }
    const num = line.match(/^(\d+)\.\s+(.*)$/);
    if (num) step = { n: Number(num[1]), text: num[2] };
    else if (line.trim() && !/^\s/.test(line)) step = null;
    info.push({ section, step });
  });
  lineInfoCache.set(file, info);
  return info;
}
const COND_START = /^(If|When|Unless|Before|After|Only)\b/;
function stripLead(t) {
  const m = t.match(/^(\s*(?:[-*>]\s+|\d+\.\s+)?(?:\*\*)?)/);
  return m[1].length;
}
// Condition clause of a sentence starting with If/When/...: text up to the first ", " before the target.
function clauseOf(sentence, targetOffset) {
  const lead = stripLead(sentence);
  const body = sentence.slice(lead);
  if (!COND_START.test(body)) return { starts: false };
  const comma = body.indexOf(", ");
  if (comma < 0 || lead + comma >= targetOffset) return { starts: true, when: null };
  return { starts: true, when: trimQuote(body.slice(0, comma)) };
}
const CLAUSE_KINDS = new Set(["router", "skill", "principle", "playbook", "automation"]);
function classify(source, target, ev) {
  const s = nodes.get(source);
  const info = lineInfo(ev._file)[ev.line - 1] || {};
  const raw = ev._raw;
  const cols = ev._cols.length ? ev._cols : [0];
  if (info.front) return { mode: "always" };
  if (s.kind === "router" && ev._file === routerFile) {
    const idx = routerIndex.get(ev.line);
    if (idx && idx.target === target) return { mode: "conditional", when: idx.when, rank: 0 };
    const arrow = raw.match(/^- (.+?)\s(?:→|->)\s/);
    if (arrow && !info.fence) {
      const at = raw.indexOf(arrow[0]) + arrow[0].length;
      if (cols.some((c) => c >= at)) return { mode: "conditional", when: trimQuote(arrow[1]), rank: 1 };
      caveats.arrowBeforeTarget++;
    }
    for (const sp of sentences(raw)) {
      const sent = raw.slice(sp.start, sp.end);
      const r = sent.indexOf(" routes to ");
      if (r > 0 && cols.some((c) => c >= sp.start + r && c < sp.end)) return { mode: "conditional", when: trimQuote(sent.slice(0, r)), rank: 2 };
    }
  }
  if (s.kind === "playbook") {
    if (info.fence) { caveats.playbookFenceRefs++; return { mode: "always" }; }
    if (info.step) {
      const c = clauseOf(info.step.text, Infinity);
      return { mode: "step", order: info.step.n, when: c.when ?? null, rank: 3 };
    }
  }
  if (CLAUSE_KINDS.has(s.kind) && !source.startsWith("automation:") && !info.fence) {
    const col = Math.min(...cols);
    const sp = sentences(raw).find((x) => col >= x.start && col < x.end) ?? { start: 0, end: raw.length };
    const c = clauseOf(raw.slice(sp.start, sp.end), col - sp.start);
    if (c.starts && c.when) return { mode: "conditional", when: c.when, rank: 4 };
    if (c.starts) caveats.conditionalSentenceNoClause++;
  }
  return { mode: "always" };
}
for (const e of edges.values()) {
  e.evidence.sort((a, b) => cmp(a.path, b.path) || a.line - b.line);
  let best = null;
  const modes = new Set();
  for (const ev of e.evidence) {
    const c = classify(e.source, e.target, ev);
    modes.add(c.mode);
    ev.mode = c.mode;
    if (c.mode !== "always") ev.when = c.when ?? null;
    if (c.mode === "step") ev.order = c.order;
    if (c.mode !== "always" && (!best || c.rank < best.rank)) best = c;
    delete ev._file; delete ev._raw; delete ev._cols;
  }
  if (modes.size > 1) caveats.mixedModeEdges++;
  e.mode = best ? best.mode : "always";
  e.when = best ? best.when ?? null : null;
  if (e.mode === "step") e.order = best.order;
}

// ---------- assemble ----------
const edgeList = [...edges.values()]
  .map((e) => {
    const out = { source: e.source, target: e.target, type: e.type, mode: e.mode, when: e.when };
    if (e.mode === "step") out.order = e.order;
    return { ...out, evidence: e.evidence, weight: e.evidence.length };
  })
  .sort((a, b) => cmp(a.source, b.source) || cmp(a.target, b.target) || cmp(a.type, b.type));
const degree = new Map([...nodes.keys()].map((k) => [k, { in: 0, out: 0 }]));
for (const e of edgeList) { degree.get(e.source).out++; degree.get(e.target).in++; }
const nodeList = [...nodes.values()]
  .map((n) => {
    const d = degree.get(n.id);
    const out = { id: n.id, kind: n.kind, name: n.name, title: n.title, group: n.group, description: n.description };
    if (n.descriptionSource) out.descriptionSource = n.descriptionSource;
    if (n.kind === "principle") out.appliesWhen = /^Apply\b/.test(n.description) ? firstSentence(n.description) : null;
    Object.assign(out, { path: n.path, owner: n.owner, lines: n.lines, flags: n.flags });
    if (n.files) out.files = n.files;
    out.degree = { in: d.in, out: d.out, total: d.in + d.out };
    return out;
  })
  .sort((a, b) => cmp(a.kind, b.kind) || cmp(a.id, b.id));
const countBy = (arr, k) => Object.fromEntries(Object.entries(arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {})).sort(([a], [b]) => cmp(a, b)));

const graph = {
  schemaVersion: 1,
  upstream: {
    repo: REPO,
    url: `https://github.com/${REPO}`,
    pluginPath: PREFIX,
    commit,
    commitShort: commit ? commit.slice(0, 7) : null,
    commitDate,
    version: plugin.version ?? null,
    sourceUrlTemplate: commit ? `https://github.com/${REPO}/blob/${commit}/{path}` : null,
    license: plugin.license ?? null,
    licenseUrl: commit ? `https://github.com/${REPO}/blob/${commit}/${repoPath("LICENSE")}` : null,
    copyright,
    author: plugin.author?.name ?? null,
  },
  generator: "scripts/extract-graph.mjs",
  counts: { nodes: nodeList.length, edges: edgeList.length, nodesByKind: countBy(nodeList, "kind"), edgesByType: countBy(edgeList, "type"), edgesByMode: countBy(edgeList, "mode") },
  nodes: nodeList,
  edges: edgeList,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(graph, null, 2)}\n`);
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${nodeList.length} nodes, ${edgeList.length} edges @ ${graph.upstream.commitShort} (v${graph.upstream.version})`);

if (README) {
  const top = [...nodeList].sort((a, b) => b.degree.total - a.degree.total || cmp(a.id, b.id));
  const cutoff = top[9]?.degree.total ?? 0;
  const topRows = top.filter((n, i) => i < 10 || n.degree.total === cutoff);
  const u = graph.upstream;
  const md = `# pstack graph data

Generated by \`scripts/extract-graph.mjs\` from [${u.repo}](${u.url}) \`${u.pluginPath}/\`. Do not edit by hand; rerun the script.

- pstack version: ${u.version}
- Upstream commit: [\`${u.commitShort}\`](${u.url}/commit/${u.commit}) (${u.commitDate})
- License: ${u.license}, ${u.copyright}. pstack is by ${u.author}; this data is derived from it.

Regenerate:

\`\`\`sh
node scripts/extract-graph.mjs path/to/plugins/pstack --out data/graph.json --readme data/README-data.md
node scripts/validate-graph.mjs data/graph.json
\`\`\`

## Counts

${nodeList.length} nodes, ${edgeList.length} edges.

| Node kind | Count |
| --- | --- |
${Object.entries(graph.counts.nodesByKind).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

| Edge type | Count |
| --- | --- |
${Object.entries(graph.counts.edgesByType).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

## Edge modes

Every edge has \`mode\` (\`always\`, \`conditional\` or \`step\`) and \`when\` (a verbatim quote from the source, or null). Step edges also have \`order\`, the playbook step number. Each evidence line carries its own \`mode\`/\`when\`/\`order\` too, and the edge takes the strongest one (see rules).

| Mode | Count |
| --- | --- |
${Object.entries(graph.counts.edgesByMode).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

| Source kind | always | conditional | step |
| --- | --- | --- | --- |
${(() => {
  const kindOf = new Map(nodeList.map((n) => [n.id, n.kind]));
  const t = {};
  for (const e of edgeList) { const k = kindOf.get(e.source); t[k] ??= { always: 0, conditional: 0, step: 0 }; t[k][e.mode]++; }
  return Object.keys(t).sort().map((k) => `| ${k} | ${t[k].always} | ${t[k].conditional} | ${t[k].step} |`).join("\n");
})()}

Principle nodes also have \`appliesWhen\`: the first sentence of their frontmatter description when it starts with "Apply" (${nodeList.filter((n) => n.kind === "principle" && n.appliesWhen).length} of ${nodeList.filter((n) => n.kind === "principle").length}).

Sample conditional edges (evenly spaced through the sorted list):

| Source | Target | when |
| --- | --- | --- |
${(() => {
  const c = edgeList.filter((e) => e.mode === "conditional");
  const step = Math.max(1, Math.floor(c.length / 10));
  return c.filter((_, i) => i % step === 0).slice(0, 10).map((e) => `| \`${e.source}\` | \`${e.target}\` | ${e.when.replace(/\|/g, "\\|")} |`).join("\n");
})()}

Mode rules, highest priority first:
1. Router principle and playbook index entries (\`- **Title.** text\`), for the entry's own target: conditional, when = first sentence of the entry text.
2. Router trigger bullets \`- <situation> → <target>\`, for targets after the arrow: conditional, when = the text before the arrow.
3. Router sentences of the form "<X> routes to <target>": conditional, when = X.
4. Playbook numbered steps (and their indented sub-lines): step, order = the step number. when is the step's opening clause up to the first comma if the step starts with If/When/Unless/Before/After/Only, else null.
5. Router, skill, principle, playbook and automation-skill lines: a sentence that starts with If/When/Unless/Before/After/Only and has a comma before the target is conditional, when = the text up to that comma.
6. Everything else, including frontmatter and code fences: always, when null.

Mode caveats from this run:
- ${caveats.arrowBeforeTarget} router trigger mention(s) sat before the arrow, so they were left \`always\`.
- ${caveats.conditionalSentenceNoClause} mention(s) were in a sentence starting with If/When/... but with no comma before the target. With no clean clause to quote, they were left \`always\`.
- ${caveats.playbookFenceRefs} playbook mention(s) inside code fences (templates and skeletons) were left \`always\` rather than tied to a step.
- ${caveats.mixedModeEdges} edge(s) have evidence lines with different modes. The edge shows the highest-priority one, and every evidence line keeps its own.
- A trigger line's \`when\` covers every target after its arrow. For example, "Parallel fan-out" is the when for both swarm and arena, though the line scopes arena further in its own words.
- \`when\` is verbatim apart from trimmed whitespace, stray \`**\` at the ends and trailing punctuation, so inline markdown (backticks, bold) is kept.
- Sentences are split on ". " before a capital or markup, so abbreviations could split a sentence early. Spot-check new quotes after upstream changes.

## Most connected nodes

Degree counts distinct edges (one per source, target and type), not mentions. Ties at the cutoff are all listed.

| Node | Kind | In | Out | Total |
| --- | --- | --- | --- | --- |
${topRows.map((n) => `| \`${n.id}\` | ${n.kind} | ${n.degree.in} | ${n.degree.out} | ${n.degree.total} |`).join("\n")}

## Format

Top level: \`schemaVersion\`, \`upstream\` (repo, commit SHA, commit date in UTC, version, \`sourceUrlTemplate\`, license), \`counts\`, \`nodes\`, \`edges\`.

Node fields: \`id\`, \`kind\`, \`name\`, \`title\` (first heading), \`group\`, \`description\`, \`path\` (repo-relative, e.g. \`pstack/skills/how/SKILL.md\`; fill \`{path}\` in \`sourceUrlTemplate\` for "View source"), \`owner\` (skill or pack a playbook, script or reference belongs to), \`lines\`, \`flags\` (every frontmatter key except name and description, e.g. \`disable-model-invocation\`, \`mode\`, \`paths\`, \`is_background\`), \`files\` (directory scripts only), \`degree\`.

Kinds: router, playbook, principle, skill, script, reference, agent, automation. SPEC.md lists router, playbook, principle, script, reference and other; skill, agent and automation are extra kinds that the page should colour separately or show as "other".

Groups: principles use the router's index sections (core, architecture, verification, delegation, meta). Playbooks are \`playbooks\`, scripts and references take their owning skill's id, and benny pack files are \`benny\`.

Edge fields: \`source\`, \`target\`, \`type\`, \`evidence\` (list of \`{path, line, text, match}\`, where \`match\` names the rule that found it), \`weight\` (number of evidence lines).

Edge types:
- \`loads\`: the router's playbook index lists the playbook, or the router links its file.
- \`runs\`: a skill or playbook names a script by path or filename.
- \`imports\`: one script imports another.
- \`applies\`: the router, a playbook or a skill names a principle (same matching as references, relabelled by source and target kind).
- \`references\`: any other mention.

## How references are found

Each node's own files are scanned line by line (directory scripts: every text file inside). A line counts as a reference when it has:
- \`/name\` for a skill (slash command);
- a hyphenated skill id as a whole token, not inside a path;
- a one-word skill id (\`how\`, \`why\`, \`tdd\`...) only in bold, in backticks, or followed by "skill";
- \`**short-name** principle\` (the "principle-" prefix left off);
- a principle's title (its H1 or router index title, e.g. "Laziness Protocol");
- a playbook's title in bold, or followed by "playbook";
- an agent's id or display name;
- a relative path or link that resolves to a node's file. Resolution tries the file's directory, the skill root, the plugin root and the repo root, and a bare script filename is accepted only if it is unique.

Self-references are dropped. Edges are deduplicated by (source, target, type), and every evidence line is kept.

## Caveats

- Matching is text-based, so a mention is not proof of runtime invocation. "references" means the text names it.
- Only references inside pstack nodes are edges. External skills and tools (\`create-skill\`, \`deslop\`, \`control-ui\`, \`control-cli\`, \`cursor-team-kit\`, \`loop\`, \`gh\`, Origin) are not nodes and get no edges.
- \`README.md\` and \`docs/guide/\` are not scanned and are not nodes.
- Bare CLI subcommands such as \`orch inbox drain\` are not matched; only paths and filenames to scripts are. The orchestrate → orch edge rests on \`scripts/orch/orch.ts\` mentions.
- Lowercase plain-word mentions of one-word skills (e.g. "how it works") are deliberately ignored, so a few real informal mentions may be missed.
- Benny skills under \`automations/benny/skills\` are dormant automation sources, not slash skills, so they are kind \`automation\`, owned by \`automation:benny\`. Their paths in the text (\`.cursor/automations/benny/...\`) resolve to the in-repo files.
- Directory scripts (\`orch/\`, \`watch-pr/\`) are one node each, tests included. \`package.json\`, \`bun.lock\` and \`tsconfig.json\` are not script nodes.
- Playbook descriptions come from the router's index entry when there is one, otherwise from the file's first paragraph (see \`descriptionSource\`). Script descriptions come from a leading comment and are empty when there is none.
- The frontmatter parser handles the flat YAML pstack uses (scalars, quoted strings, inline arrays, folded blocks), not full YAML.
`;
  fs.writeFileSync(README, md);
  console.log(`wrote ${path.relative(process.cwd(), README)}`);
}

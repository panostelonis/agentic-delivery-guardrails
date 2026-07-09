#!/usr/bin/env node
'use strict';

/*
 * claim-check — verify an AI agent's state claims against the actual repository.
 *
 * Guardrails #10 and #12, turned into executable code:
 *   #10  A claim about state is a question for the system, not the model.
 *   #12  Render status from data, not narration.
 *
 * You give it a small list of claims the agent made about a change
 * ({claim_type, target}). For each claim it asks git — not a language model —
 * whether the claim is true, and prints PASS / FAIL / UNVERIFIABLE with a
 * one-line reason. It is deterministic: the same repo state and the same claims
 * file always produce the same output and the same exit code.
 *
 * It verifies four claim types with git plumbing:
 *   merged / contains_commit   git merge-base --is-ancestor <target> <base>
 *   path_exists                git ls-tree --name-only <ref> -- <target>
 *   no_secrets_added           git diff <range>, scan added lines for secrets
 *
 * Anything it cannot decide from the repo alone (does the build pass? do the
 * tests pass? is it deployed?) it reports as UNVERIFIABLE. It does not run your
 * tests and it will not pretend it did. That refusal is the point of the tool.
 *
 * No dependencies. Node >= 14, git on PATH.
 *
 * Usage:
 *   node claim-check.js <claims.(json|yaml)> [--repo <dir>] [--base <ref>] [--json]
 *   node claim-check.js -   (read claims from stdin)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Results are one of exactly three values. Everything funnels through here.
// ---------------------------------------------------------------------------
const PASS = 'PASS';
const FAIL = 'FAIL';
const UNVERIFIABLE = 'UNVERIFIABLE';

// Claim types we know we CANNOT settle from the repo alone. Named explicitly so
// the reason is specific rather than a generic "unknown". This list is the
// honest boundary of the tool.
const KNOWN_UNVERIFIABLE = {
  tests_pass: 'this tool does not run tests',
  tests_passing: 'this tool does not run tests',
  build_passes: 'this tool does not build the project',
  builds: 'this tool does not build the project',
  lint_passes: 'this tool does not run the linter',
  no_regressions: 'requires running the software and comparing behavior',
  works: 'requires executing the code; not a repo-state question',
  deployed: 'deployment state lives in the platform, not in git',
  reviewed: 'review status lives in the forge (PR), not in the local repo',
  performance_ok: 'requires running and measuring the software',
  backwards_compatible: 'requires exercising old and new behavior',
  secure: 'a claim this broad is not a single mechanical check',
};

// ---------------------------------------------------------------------------
// git helper. Never throws; returns {status, stdout, stderr}. status is the
// process exit code (a number), or null if git could not be spawned at all.
// ---------------------------------------------------------------------------
function git(repo, args) {
  try {
    const stdout = execFileSync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return {
      status: typeof e.status === 'number' ? e.status : null,
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : String(e.message || e),
    };
  }
}

function firstLine(s) {
  return String(s || '').split('\n')[0].trim();
}

// ---------------------------------------------------------------------------
// Checkers. Each returns { result, reason }.
// ---------------------------------------------------------------------------

// merged / contains_commit: is <target> an ancestor of <base>?
//   exit 0 -> ancestor      -> PASS
//   exit 1 -> not ancestor  -> FAIL  (note: a squash/rebase merge reads FAIL too)
//   other  -> a ref did not resolve -> UNVERIFIABLE (we could not even ask)
function checkAncestor(repo, claim, defaultBase, label) {
  const target = claim.target;
  const base = claim.base || defaultBase;
  if (!target) return { result: UNVERIFIABLE, reason: 'no target given' };
  if (!base) {
    return {
      result: UNVERIFIABLE,
      reason: 'no base ref (set "base" on the claim or pass --base)',
    };
  }

  // Resolve both refs first so the reason can name the one that is missing.
  // An object we cannot see is the honest "I do not know", not a false claim.
  for (const [role, ref] of [['target', target], ['base', base]]) {
    const r = git(repo, ['rev-parse', '--verify', '--quiet', ref + '^{commit}']);
    if (r.status !== 0 || !r.stdout.trim()) {
      return {
        result: UNVERIFIABLE,
        reason: `cannot resolve ${role} "${ref}" in this repo (fetch it, then re-run)`,
      };
    }
  }

  const anc = git(repo, ['merge-base', '--is-ancestor', target, base]);
  if (anc.status === 0) {
    return { result: PASS, reason: `${short(target)} is an ancestor of ${base}` };
  }
  if (anc.status === 1) {
    return {
      result: FAIL,
      reason:
        `${short(target)} is not an ancestor of ${base}` +
        (label === 'merged'
          ? ' (a squash- or rebase-merged branch also reads FAIL here — verify those by content/path, not by this commit id)'
          : ''),
    };
  }
  return { result: UNVERIFIABLE, reason: `git error: ${firstLine(anc.stderr)}` };
}

// path_exists: does <target> exist in the tree at <ref> (default HEAD)?
// Uses ls-tree, which resolves through trees only — no blob fetch, so it works
// on a partial (blobless) clone.
//   git error   -> ref did not resolve -> UNVERIFIABLE
//   empty output-> path is not in the tree -> FAIL
//   non-empty   -> path is present -> PASS
function checkPathExists(repo, claim) {
  const target = claim.target;
  const ref = claim.ref || 'HEAD';
  if (!target) return { result: UNVERIFIABLE, reason: 'no target path given' };

  const r = git(repo, ['ls-tree', '--name-only', ref, '--', target]);
  if (r.status !== 0) {
    return {
      result: UNVERIFIABLE,
      reason: `cannot resolve ref "${ref}": ${firstLine(r.stderr)}`,
    };
  }
  if (r.stdout.trim() === '') {
    return { result: FAIL, reason: `"${target}" does not exist at ${ref}` };
  }
  return { result: PASS, reason: `"${target}" exists at ${ref}` };
}

// no_secrets_added: scan the ADDED lines of a diff for secret-shaped literals.
// target is a diff range ("A..B", "A...B") or a single commit (-> parent..commit).
// This is a coarse net, honestly. It catches high-confidence provider tokens and
// long values assigned to secret-ish names; it will miss custom secret formats
// and can false-positive. Treat a PASS as "nothing obvious", not "proven clean".
function checkNoSecrets(repo, claim) {
  const target = claim.target;
  if (!target) return { result: UNVERIFIABLE, reason: 'no diff range given' };

  const range = target.includes('..') ? [target] : [target + '~1', target];
  const d = git(repo, ['diff', '--no-color', ...range]);
  if (d.status !== 0) {
    return {
      result: UNVERIFIABLE,
      reason: `cannot diff "${target}": ${firstLine(d.stderr)}`,
    };
  }

  const hits = scanDiffForSecrets(d.stdout);
  if (hits.length === 0) {
    return { result: PASS, reason: `no secret-shaped literals in added lines of ${target}` };
  }
  const shown = hits.slice(0, 5).map((h) => `${h.file}:${h.line} (${h.rule})`);
  const more = hits.length > 5 ? ` +${hits.length - 5} more` : '';
  return { result: FAIL, reason: `added secret-shaped literal — ${shown.join('; ')}${more}` };
}

// ---------------------------------------------------------------------------
// Secret scanning over a unified diff. We track the new-side line number so a
// hit points at a real file:line a human can open.
// ---------------------------------------------------------------------------
const SECRET_RULES = [
  ['private-key-block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['aws-access-key-id', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[0-9A-Za-z]{36}\b/],
  ['github-fine-grained-pat', /\bgithub_pat_[0-9A-Za-z_]{22,}\b/],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_\-]{35}\b/],
  ['stripe-secret-key', /\b[rs]k_live_[0-9A-Za-z]{24,}\b/],
];

// Generic: a long value assigned to a secret-ish name. The length floor is what
// keeps short test fixtures like "secret1" from tripping it.
const GENERIC_KEY = /(api[_-]?key|secret|token|passwo?rd|passwd|pwd|private[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token)["']?\s*[:=]\s*["']([^"']{16,})["']/i;
// Obvious non-secrets, so the generic rule is less noisy.
const PLACEHOLDER = /^(?:x{4,}|\.{3,}|<[^>]*>|\$\{[^}]*\}|process\.env|os\.environ|example|changeme|your[_-]|placeholder|dummy|redacted)/i;

function scanDiffForSecrets(diff) {
  const hits = [];
  let file = null;
  let newLine = 0;
  for (const raw of diff.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim();
      file = p === '/dev/null' ? null : p.replace(/^b\//, '');
      continue;
    }
    if (line.startsWith('--- ')) continue;
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith('+')) {
      const content = line.slice(1);
      const rule = matchSecret(content);
      if (rule && file) hits.push({ file, line: newLine, rule });
      newLine++;
    } else if (line.startsWith(' ')) {
      newLine++;
    } // '-' lines and headers do not advance the new-side counter
  }
  return hits;
}

function matchSecret(text) {
  for (const [name, re] of SECRET_RULES) {
    if (re.test(text)) return name;
  }
  const g = text.match(GENERIC_KEY);
  if (g && !PLACEHOLDER.test(g[2])) return 'secret-shaped-assignment';
  return null;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
function verify(repo, claim, defaultBase) {
  const type = String(claim.claim_type || '').trim();
  switch (type) {
    case 'merged':
      return checkAncestor(repo, claim, defaultBase, 'merged');
    case 'contains_commit':
      return checkAncestor(repo, claim, defaultBase, 'contains_commit');
    case 'path_exists':
      return checkPathExists(repo, claim);
    case 'no_secrets_added':
      return checkNoSecrets(repo, claim);
    default:
      if (KNOWN_UNVERIFIABLE[type]) {
        return { result: UNVERIFIABLE, reason: KNOWN_UNVERIFIABLE[type] };
      }
      return {
        result: UNVERIFIABLE,
        reason: `unknown claim_type "${type || '(empty)'}" — this tool verifies: merged, contains_commit, path_exists, no_secrets_added`,
      };
  }
}

// ---------------------------------------------------------------------------
// Input parsing: JSON is primary. A small YAML subset is supported for
// ergonomics — a list of maps with plain string scalar values, nothing more.
// ---------------------------------------------------------------------------
function loadClaims(text, filename) {
  const ext = (filename || '').toLowerCase();
  if (ext.endsWith('.json')) return asClaimList(JSON.parse(text));
  if (ext.endsWith('.yaml') || ext.endsWith('.yml')) return asClaimList(parseSimpleYaml(text));
  // stdin or unknown extension: try JSON, then fall back to the YAML subset.
  try {
    return asClaimList(JSON.parse(text));
  } catch (_) {
    return asClaimList(parseSimpleYaml(text));
  }
}

function asClaimList(data) {
  if (!Array.isArray(data)) {
    throw new Error('claims file must be a list of {claim_type, target} objects');
  }
  return data;
}

// Minimal YAML: top-level list; each item is "- key: value" followed by indented
// "key: value" lines. Scalar string values only. Full-line "#" comments allowed.
// Not a general YAML parser — deliberately small so its behavior is obvious.
function parseSimpleYaml(text) {
  const items = [];
  let cur = null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const m = line.match(/^(\s*)-\s+(.*)$/);
    if (m) {
      cur = {};
      items.push(cur);
      addPair(cur, m[2], i + 1);
      continue;
    }
    if (/^\s+\S/.test(line) && cur) {
      addPair(cur, line.trim(), i + 1);
      continue;
    }
    throw new Error(`claims YAML: unexpected line ${i + 1}: "${line}"`);
  }
  return items;
}

function addPair(obj, pair, lineNo) {
  const idx = pair.indexOf(':');
  if (idx === -1) throw new Error(`claims YAML: expected "key: value" on line ${lineNo}: "${pair}"`);
  const key = pair.slice(0, idx).trim();
  obj[key] = unquote(pair.slice(idx + 1).trim());
}

function unquote(v) {
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function short(ref) {
  return /^[0-9a-f]{40}$/i.test(ref) ? ref.slice(0, 10) + '…' : ref;
}

const PAD = { [PASS]: 'PASS        ', [FAIL]: 'FAIL        ', [UNVERIFIABLE]: 'UNVERIFIABLE' };

function renderHuman(repo, base, rows, summary, verdict) {
  const out = [];
  out.push(`claim-check — ${rows.length} claim(s) against ${repo}` + (base ? `  (base: ${base})` : ''));
  out.push('');
  rows.forEach((r, i) => {
    const n = String(i + 1).padStart(2, ' ');
    const tgt = r.claim.target ? ` ${short(String(r.claim.target))}` : '';
    out.push(`  ${n}  ${PAD[r.result]}  ${r.claim.claim_type}${tgt}`);
    out.push(`        ${r.reason}`);
  });
  out.push('');
  out.push(
    `VERDICT: ${summary[PASS]} PASS · ${summary[FAIL]} FAIL · ${summary[UNVERIFIABLE]} UNVERIFIABLE — ${verdict}`
  );
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { repo: process.cwd(), base: null, json: false, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--base') opts.base = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (!opts.file) opts.file = a;
    else throw new Error(`unexpected argument: ${a}`);
  }
  return opts;
}

const HELP = `claim-check — verify an agent's state claims against the repo (guardrails #10, #12)

  node claim-check.js <claims.(json|yaml)> [--repo <dir>] [--base <ref>] [--json]
  node claim-check.js -                     read claims from stdin

Claim types verified deterministically:
  merged | contains_commit   {target, base?}   is target an ancestor of base
  path_exists                {target, ref?}     does the path exist at ref (default HEAD)
  no_secrets_added           {target}           scan added lines of a diff range

Any other claim_type (tests_pass, deployed, works, ...) is reported UNVERIFIABLE.

Exit code: 1 if any claim FAILs, else 0. (UNVERIFIABLE does not fail the run;
it is a signal that a human must check that fact another way.)`;

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(String(e.message) + '\n');
    process.exit(2);
  }
  if (opts.help || !opts.file) {
    process.stdout.write(HELP + '\n');
    process.exit(opts.help ? 0 : 2);
  }

  let text;
  try {
    text = opts.file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(opts.file, 'utf8');
  } catch (e) {
    process.stderr.write(`cannot read claims file "${opts.file}": ${e.message}\n`);
    process.exit(2);
  }

  const repo = path.resolve(opts.repo);
  const isRepo = git(repo, ['rev-parse', '--git-dir']);
  if (isRepo.status !== 0) {
    process.stderr.write(`"${repo}" is not a git repository\n`);
    process.exit(2);
  }

  let claims;
  try {
    claims = loadClaims(text, opts.file === '-' ? '' : opts.file);
  } catch (e) {
    process.stderr.write(`could not parse claims: ${e.message}\n`);
    process.exit(2);
  }

  const rows = claims.map((claim) => {
    const { result, reason } = verify(repo, claim, opts.base);
    return { claim, result, reason };
  });

  const summary = { [PASS]: 0, [FAIL]: 0, [UNVERIFIABLE]: 0 };
  rows.forEach((r) => (summary[r.result] += 1));

  let verdict;
  if (summary[FAIL] > 0) verdict = 'HOLD (a claim is false)';
  else if (summary[UNVERIFIABLE] > 0) verdict = 'REVIEW (unverifiable claims — check them another way)';
  else verdict = 'OK (all claims verified true)';

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          repo,
          base: opts.base,
          claims: rows.map((r, i) => ({
            index: i + 1,
            claim_type: r.claim.claim_type,
            target: r.claim.target,
            base: r.claim.base || (r.claim.claim_type === 'merged' || r.claim.claim_type === 'contains_commit' ? opts.base : undefined),
            ref: r.claim.ref,
            result: r.result,
            reason: r.reason,
          })),
          summary: { pass: summary[PASS], fail: summary[FAIL], unverifiable: summary[UNVERIFIABLE] },
          verdict,
        },
        null,
        2
      ) + '\n'
    );
  } else {
    process.stdout.write(renderHuman(repo, opts.base, rows, summary, verdict) + '\n');
  }

  process.exit(summary[FAIL] > 0 ? 1 : 0);
}

main();

'use strict';

/*
 * Fixture-based regression suite for claim-check.
 *
 * This is the checked contract: it builds a controlled repository with known
 * ground truth (fixtures.js), runs the real CLI against it, and asserts the
 * structured (--json) output. selftest.sh remains the narrated smoke demo; this
 * suite is what fails CI when a verdict, reason, summary or exit code drifts.
 *
 * SHA handling (deliberate): commit SHAs are the fixture builder's output, not
 * hard-coded and not stripped. Each claim's actual `target` is asserted to equal
 * the SHA the builder reported, and each reason is asserted against a semantic
 * template with that same SHA substituted in. result, claim_type, summary,
 * verdict and exit code are exact. The determinism test compares two identical
 * runs' raw stdout byte-for-byte with no normalisation.
 *
 * Requires the built-in node:test module (Node 18+). The CLI under test stays
 * dependency-free and Node 14+.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { buildFixture } = require('./fixtures');

const CC = path.join(__dirname, '..', 'claim-check.js');
const spec = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'expected', 'scenarios.json'), 'utf8')
);

let fx;
before(() => {
  fx = buildFixture();
});
after(() => {
  if (fx) fx.cleanup();
});

// Mirror of claim-check.js's short(): a 40-char hex ref renders as its first ten
// hex chars plus an ellipsis; anything else is left as-is.
function short(ref) {
  return /^[0-9a-f]{40}$/i.test(ref) ? ref.slice(0, 10) + '…' : ref;
}

// "@name" resolves to the SHA the fixture builder reported for that commit.
function resolveTarget(target) {
  if (typeof target === 'string' && target.startsWith('@')) {
    const name = target.slice(1);
    if (!(name in fx.shas)) throw new Error(`unknown fixture ref: ${target}`);
    return fx.shas[name];
  }
  return target;
}

function resolveClaim(claim) {
  return { ...claim, target: resolveTarget(claim.target) };
}

function fillReason(templateStr, resolvedTarget) {
  return templateStr
    .replace('{short}', short(resolvedTarget))
    .replace('{full}', resolvedTarget);
}

// Run the CLI against the fixture, reading claims from stdin as JSON. Never
// throws on a non-zero exit: returns the raw stdout buffer, the parsed JSON, and
// the process exit code so the exit-code contract can be asserted directly.
function runCli(claims) {
  const args = [CC, '-', '--repo', fx.dir, '--base', spec.base, '--json'];
  try {
    const stdout = execFileSync(process.execPath, args, {
      input: JSON.stringify(claims),
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: 0, stdout, json: JSON.parse(stdout.toString('utf8')) };
  } catch (e) {
    const stdout = e.stdout || Buffer.alloc(0);
    return {
      status: typeof e.status === 'number' ? e.status : null,
      stdout,
      json: stdout.length ? JSON.parse(stdout.toString('utf8')) : null,
    };
  }
}

// One test per authoritative ROADMAP scenario.
for (const sc of spec.scenarios) {
  test(sc.name, () => {
    const resolvedTarget = resolveTarget(sc.claim.target);
    const { json } = runCli([resolveClaim(sc.claim)]);
    const row = json.claims[0];

    assert.strictEqual(row.result, sc.expect.result, 'result');
    assert.strictEqual(row.claim_type, sc.expect.claim_type, 'claim_type');
    // Actual target must be exactly the SHA (or literal) the fixture provided.
    assert.strictEqual(row.target, resolvedTarget, 'target');
    // Reason matched through a semantic template carrying the fixture SHA.
    assert.strictEqual(row.reason, fillReason(sc.expect.reason, resolvedTarget), 'reason');
  });
}

// Aggregate: one claims file, verify summary counts + overall verdict + exit code together.
test('aggregate claims file: summary, verdict and exit code', () => {
  const claims = spec.scenarios.map((sc) => resolveClaim(sc.claim));
  const { status, json } = runCli(claims);
  assert.deepStrictEqual(json.summary, spec.aggregate.summary, 'summary');
  assert.strictEqual(json.verdict, spec.aggregate.verdict, 'verdict');
  assert.strictEqual(status, spec.aggregate.exitCode, 'exit code');
});

// Exit-code contract: a set with no FAIL exits 0; a set with a FAIL exits 1.
test('exit 0 when no claim FAILs (PASS/UNVERIFIABLE only)', () => {
  const claims = spec.exitZero.claims.map(resolveClaim);
  const { status, json } = runCli(claims);
  assert.deepStrictEqual(json.summary, spec.exitZero.summary, 'summary');
  assert.strictEqual(json.verdict, spec.exitZero.verdict, 'verdict');
  assert.strictEqual(status, spec.exitZero.exitCode, 'exit code');
});

test('exit 1 when a claim FAILs', () => {
  const claims = spec.exitOne.claims.map(resolveClaim);
  const { status, json } = runCli(claims);
  assert.deepStrictEqual(json.summary, spec.exitOne.summary, 'summary');
  assert.strictEqual(json.verdict, spec.exitOne.verdict, 'verdict');
  assert.strictEqual(status, spec.exitOne.exitCode, 'exit code');
});

// Determinism: two identical runs against the same fixture produce byte-for-byte
// identical raw JSON stdout. No normalisation.
test('repeated identical run is byte-for-byte identical', () => {
  const claims = spec.scenarios.map((sc) => resolveClaim(sc.claim));
  const a = runCli(claims);
  const b = runCli(claims);
  assert.strictEqual(a.status, b.status, 'exit code differs between identical runs');
  assert.ok(
    Buffer.isBuffer(a.stdout) && Buffer.isBuffer(b.stdout) && a.stdout.equals(b.stdout),
    'raw JSON stdout differs between two identical runs'
  );
});

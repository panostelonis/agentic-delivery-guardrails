'use strict';

/*
 * Deterministic git fixtures for the claim-check regression suite.
 *
 * buildFixture() constructs a throwaway git repository with known ground truth
 * in a temp directory and returns the directory plus the exact commit SHAs it
 * created. Tests assert claim-check's output against those returned SHAs — the
 * builder is the source of truth for what "the right answer" is, so nothing is
 * hard-coded and nothing has to be stripped from the tool's output.
 *
 * Every commit is built with a pinned identity, pinned author/committer dates,
 * line endings forced to LF, signing off, and a fixed default branch, so the
 * SHAs are reproducible on any platform and the fixture never depends on the
 * host's git configuration.
 *
 * No dependencies. Node built-ins only. This file defines helpers and exports
 * buildFixture; it performs no work at import time.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// A 40-char hex string that is not a real object in the fixture. Used for the
// "unknown commit -> UNVERIFIABLE" scenario. Exported so tests and the expected
// file agree on the exact literal.
const UNKNOWN_SHA = '0000000000000000000000000000000000000000';

// Pinned so commit SHAs are byte-for-byte reproducible across machines.
const FIXED_ENV = {
  GIT_AUTHOR_NAME: 'claim-check fixtures',
  GIT_AUTHOR_EMAIL: 'fixtures@example.com',
  GIT_AUTHOR_DATE: '2026-01-01T00:00:00 +0000',
  GIT_COMMITTER_NAME: 'claim-check fixtures',
  GIT_COMMITTER_EMAIL: 'fixtures@example.com',
  GIT_COMMITTER_DATE: '2026-01-01T00:00:00 +0000',
};

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...FIXED_ENV },
  });
}

function head(dir) {
  return git(dir, ['rev-parse', 'HEAD']).trim();
}

function write(dir, rel, contents) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
  return head(dir);
}

/*
 * Ground truth built on `main`:
 *   c1  add packages/prisma/schema.prisma + foo.txt
 *   c2  append to foo.txt                        (clean commit)
 *   c3  add config.js containing an AWS key      (planted secret)
 * plus two branches:
 *   feature   off c2, one commit, LEFT UNMERGED  -> a genuinely unreachable head
 *   squashme  off c3, one commit, then folded into main via `git merge --squash`
 *             + commit, so its content lands on main under a NEW commit while its
 *             original head is not an ancestor of main.
 *
 * Returned SHAs:
 *   c1, c2, c3        commits on main
 *   feature           unmerged branch head (unreachable from main)
 *   squashHead        original head of the squash-merged branch (unreachable)
 *   squashLand        the squash commit on main that carries the landed content
 */
function buildFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fixture-'));

  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.name', 'claim-check fixtures']);
  git(dir, ['config', 'user.email', 'fixtures@example.com']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  git(dir, ['config', 'core.eol', 'lf']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  write(dir, '.gitattributes', '* -text\n');

  write(dir, 'packages/prisma/schema.prisma', 'model X {}\n');
  write(dir, 'foo.txt', 'hello\n');
  const c1 = commitAll(dir, 'c1');

  fs.appendFileSync(path.join(dir, 'foo.txt'), 'more\n');
  const c2 = commitAll(dir, 'c2-clean');

  // A well-known AWS example key (not a live credential).
  write(dir, 'config.js', 'const k = "AKIAIOSFODNN7EXAMPLE";\n');
  const c3 = commitAll(dir, 'c3-secret');

  // Unmerged feature branch off c2.
  git(dir, ['checkout', '-q', '-b', 'feature', c2]);
  write(dir, 'feature.txt', 'x\n');
  const feature = commitAll(dir, 'feat');
  git(dir, ['checkout', '-q', 'main']);

  // Squash-merged branch off c3 (main tip). Its content lands on main under a
  // new commit; its own head never becomes an ancestor of main.
  git(dir, ['checkout', '-q', '-b', 'squashme', c3]);
  write(dir, 'squashed-feature.txt', 'landed by squash\n');
  const squashHead = commitAll(dir, 'squashme-work');
  git(dir, ['checkout', '-q', 'main']);
  git(dir, ['merge', '--squash', 'squashme']);
  const squashLand = commitAll(dir, 'squash-land squashme');

  return {
    dir,
    shas: { c1, c2, c3, feature, squashHead, squashLand },
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

module.exports = { buildFixture, UNKNOWN_SHA, FIXED_ENV };

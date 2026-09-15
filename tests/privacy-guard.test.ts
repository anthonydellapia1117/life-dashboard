import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSensitiveValues } from '../scripts/privacy-guard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const guardScript = path.join(repoRoot, 'scripts', 'privacy-guard.mjs');

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runGuardCli(root: string): CliResult {
  try {
    const stdout = execFileSync('node', [guardScript], {
      cwd: root,
      env: { ...process.env, PRIVACY_GUARD_ROOT: root },
      encoding: 'utf8',
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

function makeSandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-dashboard-guard-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

describe('collectSensitiveValues', () => {
  it('collects content strings and 4+ digit numbers, but skips structural keys', () => {
    const values = collectSensitiveValues({
      name: 'A Real Person Name',
      pill: 'watch',
      area: 'Family',
      balance: 24680.13,
      short: 'hi',
    });
    expect(values.has('A Real Person Name')).toBe(true);
    expect(values.has('24680.13')).toBe(true);
    expect(values.has('watch')).toBe(false);
    expect(values.has('Family')).toBe(false);
    expect(values.has('hi')).toBe(false);
  });
});

describe('privacy-guard CLI - break each check once, then restore', () => {
  const sandboxes: string[] = [];

  afterEach(() => {
    // Restore: remove every sandbox this test created, every time.
    while (sandboxes.length > 0) {
      const dir = sandboxes.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes on a clean sandbox with no plaintext data file', () => {
    const dir = makeSandbox();
    sandboxes.push(dir);
    fs.writeFileSync(path.join(dir, 'README.md'), '# clean sandbox\n');
    execFileSync('git', ['add', '-A'], { cwd: dir });

    const result = runGuardCli(dir);
    expect(result.code).toBe(0);
  });

  it('fails when data/life.json would be tracked, then passes once restored', () => {
    const dir = makeSandbox();
    sandboxes.push(dir);
    fs.mkdirSync(path.join(dir, 'data'));
    fs.writeFileSync(path.join(dir, 'data', 'life.json'), '{"secret":"should never ship"}\n');

    const broken = runGuardCli(dir);
    expect(broken.code).toBe(1);
    expect(broken.stderr).toContain('data/life.json');
    expect(broken.stderr).toContain('must never be tracked');

    // Restore: gitignore the plaintext file and confirm the guard passes again.
    fs.writeFileSync(path.join(dir, '.gitignore'), 'data/*.json\n');
    const restored = runGuardCli(dir);
    expect(restored.code).toBe(0);
  });

  it('fails when a sensitive value leaks into a tracked file, then passes once restored', () => {
    const dir = makeSandbox();
    sandboxes.push(dir);
    const secretPhrase = 'Totally Secret Address Only In The Data File';
    fs.writeFileSync(path.join(dir, '.gitignore'), 'data/*.json\n');
    fs.mkdirSync(path.join(dir, 'data'));
    fs.writeFileSync(path.join(dir, 'data', 'life.json'), JSON.stringify({ secretDetail: secretPhrase }));
    fs.writeFileSync(path.join(dir, 'leaky.txt'), `oops: ${secretPhrase}\n`);

    const broken = runGuardCli(dir);
    expect(broken.code).toBe(1);
    expect(broken.stderr).toContain('possible plaintext leak in leaky.txt');
    // The guard reports a hash, never the actual value.
    expect(broken.stderr).not.toContain(secretPhrase);

    // Restore: remove the leak and confirm the guard passes again.
    fs.rmSync(path.join(dir, 'leaky.txt'));
    const restored = runGuardCli(dir);
    expect(restored.code).toBe(0);
  });
});

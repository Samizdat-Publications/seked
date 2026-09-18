/**
 * The two things the runner does on disk: find the key, and write a proposal
 * where a proposal goes. The rule the whole track exists to protect is that a
 * proposal never lands in `data/claims/`, so most of what is tested here is
 * that there is no way to ask for that.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { ClaimSchema, normaliseClaim, type ClaimFile } from '@seked/claims/browser';
import { DATA_DIR, REPO_ROOT } from '@seked/data';
import { KEYS_FILE, PROPOSED_DIR, anthropicKey, proposedIds, writeProposal } from './index';

const proposal: ClaimFile = {
  id: 'P999',
  title: 'A claim written by a test',
  group: 'proportion',
  summary: 'Written so the test can read it back and delete it.',
  status: 'computed',
  comparisons: [{ label: 'x', formula: 'g1.base.perimeter', target: 'g1.height.original', unit: 'm' }],
  tolerance_pct: 0.5,
  free_choices: [],
  sources: { for: [], context: [], against: [] },
  origin: 'proposed',
  prose: 'somebody said something',
};

describe('where a proposal is allowed to land', () => {
  it('is under build/ and nowhere near data/', () => {
    expect(PROPOSED_DIR).toBe(join(REPO_ROOT, 'build', 'claims'));
    expect(relative(DATA_DIR, PROPOSED_DIR).startsWith('..')).toBe(true);
  });

  it('writes a proposal there, header and all', () => {
    const path = writeProposal(proposal, ['Proposed by a test.', '', 'The words it came from:', '  something']);
    try {
      expect(path).toBe(join(PROPOSED_DIR, 'P999.yaml'));
      expect(proposedIds()).toContain('P999');
      const written = readFileSync(path, 'utf8');
      expect(written.startsWith('# Proposed by a test.\n#\n')).toBe(true);
      expect(written).toContain('id: P999');
      expect(written).toContain('origin: proposed');
      // The header is comments, so what was written still parses as a claim.
      const read = normaliseClaim(ClaimSchema.parse(parseYaml(written)), 'P999.yaml');
      expect(read.id).toBe('P999');
      expect(read.origin).toBe('proposed');
      expect(read.prose).toBe('somebody said something');
      expect(read.comparisons[0]?.formula).toBe('g1.base.perimeter');
    } finally {
      rmSync(path, { force: true });
    }
  });

  it('refuses a claim that is not a proposal', () => {
    expect(() => writeProposal({ ...proposal, id: 'A1' })).toThrow(/not a proposal's id/);
    expect(() => writeProposal({ ...proposal, origin: 'filed' })).toThrow(/only a proposed claim/);
    expect(() => writeProposal({ ...proposal, id: '../../data/claims/A1' })).toThrow(/not a proposal's id/);
  });

  it('counts only the proposals it finds', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seked-claims-'));
    try {
      writeFileSync(join(dir, 'P3.yaml'), '');
      writeFileSync(join(dir, 'P11.yaml'), '');
      writeFileSync(join(dir, 'A1.yaml'), '');
      writeFileSync(join(dir, 'notes.md'), '');
      expect(proposedIds(dir).sort()).toEqual(['P11', 'P3']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(proposedIds(join(tmpdir(), 'seked-claims-that-are-not-there'))).toEqual([]);
  });
});

describe('finding the key', () => {
  it('prefers the environment', () => {
    expect(anthropicKey({ ANTHROPIC_API_KEY: ' sk-test ' }, '/nowhere')).toBe('sk-test');
  });

  it('falls back to the keys file, past the other keys in it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seked-keys-'));
    const file = join(dir, 'keys.env');
    try {
      writeFileSync(file, 'SKETCHFAB_TOKEN=abc\nMESHY_API_KEY=def\nANTHROPIC_API_KEY=sk-from-file\n');
      expect(anthropicKey({}, file)).toBe('sk-from-file');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('says where to put it rather than what it was', () => {
    const missing = join(tmpdir(), 'seked-keys-that-are-not-there', 'keys.env');
    expect(() => anthropicKey({}, missing)).toThrow(/set ANTHROPIC_API_KEY/);
    expect(() => anthropicKey({}, missing)).toThrow(new RegExp(missing.replace(/[\\/]/g, '.')));
    expect(KEYS_FILE.endsWith(join('.seked', 'keys.env'))).toBe(true);
  });
});

// The proposal directory is created on demand and is gitignored; nothing here
// leaves it behind but the directory itself.
if (!existsSync(PROPOSED_DIR)) mkdirSync(PROPOSED_DIR, { recursive: true });

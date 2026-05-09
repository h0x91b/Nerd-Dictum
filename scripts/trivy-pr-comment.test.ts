import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildTrivyCommentAction,
  readTrivyCommentAction,
  TRIVY_COMMENT_HEADER,
} from './trivy-pr-comment.js';

describe('buildTrivyCommentAction', () => {
  it('returns delete when the results file is empty', () => {
    expect(buildTrivyCommentAction({ exists: true, content: '   \n' })).toEqual({
      type: 'delete',
    });
  });

  it('returns an upsert action with findings when vulnerabilities exist', () => {
    const action = buildTrivyCommentAction({
      exists: true,
      content: 'CRITICAL: example vulnerability',
    });

    expect(action).toEqual({
      type: 'upsert',
      body: `${TRIVY_COMMENT_HEADER}\n\n\`\`\`\nCRITICAL: example vulnerability\n\`\`\`\n`,
    });
  });

  it('returns delete when the Trivy summary shows no vulnerabilities and no secrets', () => {
    const cleanReport = `Report Summary

┌──────────┬──────┬─────────────────┬─────────┐
│  Target  │ Type │ Vulnerabilities │ Secrets │
├──────────┼──────┼─────────────────┼─────────┤
│ bun.lock │ bun  │        0        │    -    │
└──────────┴──────┴─────────────────┴─────────┘
Legend:
- '-': Not scanned
- '0': Clean (no security findings detected)
`;

    expect(buildTrivyCommentAction({ exists: true, content: cleanReport })).toEqual({
      type: 'delete',
    });
  });

  it('returns delete when every target in a multi-row summary is clean', () => {
    const cleanReport = `Report Summary

┌──────────────┬──────┬─────────────────┬─────────┐
│    Target    │ Type │ Vulnerabilities │ Secrets │
├──────────────┼──────┼─────────────────┼─────────┤
│ bun.lock     │ bun  │        0        │    0    │
│ package.json │ npm  │        -        │    0    │
└──────────────┴──────┴─────────────────┴─────────┘
`;

    expect(buildTrivyCommentAction({ exists: true, content: cleanReport })).toEqual({
      type: 'delete',
    });
  });

  it('returns upsert when the summary reports any vulnerabilities', () => {
    const dirtyReport = `Report Summary

┌──────────┬──────┬─────────────────┬─────────┐
│  Target  │ Type │ Vulnerabilities │ Secrets │
├──────────┼──────┼─────────────────┼─────────┤
│ bun.lock │ bun  │       13        │    -    │
└──────────┴──────┴─────────────────┴─────────┘

bun.lock (bun)
==============
Total: 13 (MEDIUM: 9, HIGH: 4, CRITICAL: 0)
`;

    const action = buildTrivyCommentAction({ exists: true, content: dirtyReport });
    expect(action.type).toBe('upsert');
    expect(action.body).toContain('Total: 13');
  });

  it('returns upsert when the summary reports any secrets', () => {
    const secretsReport = `Report Summary

┌──────────┬──────┬─────────────────┬─────────┐
│  Target  │ Type │ Vulnerabilities │ Secrets │
├──────────┼──────┼─────────────────┼─────────┤
│ .env     │ env  │        -        │    2    │
└──────────┴──────┴─────────────────┴─────────┘
`;

    const action = buildTrivyCommentAction({ exists: true, content: secretsReport });
    expect(action.type).toBe('upsert');
  });
});

describe('readTrivyCommentAction', () => {
  it('returns a warning comment when the results file is missing', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'trivy-pr-comment-'));

    try {
      expect(readTrivyCommentAction(join(tempDir, 'missing.txt'))).toEqual({
        type: 'upsert',
        body: `${TRIVY_COMMENT_HEADER}\n\n⚠️ Trivy results file not found.\n`,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns delete when the file only contains whitespace', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'trivy-pr-comment-'));
    const resultsPath = join(tempDir, 'trivy-results.txt');

    try {
      writeFileSync(resultsPath, ' \n\t');

      expect(readTrivyCommentAction(resultsPath)).toEqual({ type: 'delete' });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

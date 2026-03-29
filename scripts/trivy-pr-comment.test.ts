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

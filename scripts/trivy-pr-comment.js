import { existsSync, readFileSync } from 'node:fs';

export const TRIVY_COMMENT_HEADER = '## 🔍 Trivy Vulnerability Scan';

export function buildTrivyCommentAction({ exists, content }) {
  if (!exists) {
    return {
      type: 'upsert',
      body: `${TRIVY_COMMENT_HEADER}\n\n⚠️ Trivy results file not found.\n`,
    };
  }

  const results = content.trim();
  if (results.length === 0) {
    return { type: 'delete' };
  }

  return {
    type: 'upsert',
    body: `${TRIVY_COMMENT_HEADER}\n\n\`\`\`\n${results}\n\`\`\`\n`,
  };
}

export function readTrivyCommentAction(resultsPath = 'trivy-results.txt') {
  if (!existsSync(resultsPath)) {
    return buildTrivyCommentAction({ exists: false, content: '' });
  }

  return buildTrivyCommentAction({
    exists: true,
    content: readFileSync(resultsPath, 'utf8'),
  });
}

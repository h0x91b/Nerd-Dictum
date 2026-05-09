import { existsSync, readFileSync } from 'node:fs';

export const TRIVY_COMMENT_HEADER = '## 🔍 Trivy Vulnerability Scan';

function parseSummaryRows(content) {
  const lines = content.split('\n');
  const dividerIdx = lines.findIndex((l) => l.startsWith('├'));
  if (dividerIdx === -1) return null;

  const rows = [];
  for (let i = dividerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('└')) break;
    if (!line.startsWith('│')) continue;
    const cells = line.split('│').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 4) return null;
    const [target, type, vulns, secrets] = cells;
    rows.push({ target, type, vulns, secrets });
  }
  return rows.length > 0 ? rows : null;
}

function isCleanReport(content) {
  const rows = parseSummaryRows(content);
  if (!rows) return false;
  return rows.every(
    (r) => (r.vulns === '0' || r.vulns === '-') && (r.secrets === '0' || r.secrets === '-')
  );
}

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

  if (isCleanReport(results)) {
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

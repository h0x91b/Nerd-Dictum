import { hasBlockingFindings } from './trivy-pr-comment.js';

const resultsPath = process.argv[2] ?? 'trivy-results.txt';

if (hasBlockingFindings(resultsPath)) {
  console.error(
    `Trivy reported vulnerabilities or secrets (see ${resultsPath} and the PR comment). Failing the job to block merge.`
  );
  process.exit(1);
}

console.log('Trivy scan is clean.');

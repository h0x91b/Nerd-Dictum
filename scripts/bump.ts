#!/usr/bin/env bun
/**
 * Version bump script
 * Usage: bun run bump [patch|minor|major]
 * Default: patch
 */

import { $ } from 'bun';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const packageJsonPath = join(rootDir, 'package.json');

// Parse arguments
const bumpType = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: bun run bump [patch|minor|major]');
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version;

// Parse and bump version
const [major, minor, patch] = currentVersion.split('.').map(Number);
let newVersion: string;

switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

console.log(`Bumping version: ${currentVersion} → ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✓ Updated package.json');

// Git operations
try {
  await $`git add package.json`.cwd(rootDir);
  await $`git commit -m "Bump version to ${newVersion}"`.cwd(rootDir);
  console.log('✓ Created commit');

  await $`git tag v${newVersion}`.cwd(rootDir);
  console.log(`✓ Created tag v${newVersion}`);

  await $`git push`.cwd(rootDir);
  await $`git push --tags`.cwd(rootDir);
  console.log('✓ Pushed to remote');

  console.log(`\n🚀 Release v${newVersion} triggered!`);
  console.log('   Check GitHub Actions for build progress.');
} catch (error) {
  console.error('Git operation failed:', error);
  process.exit(1);
}

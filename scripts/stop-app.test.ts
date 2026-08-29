import { describe, it, expect } from 'bun:test';
import { parseRunningApps } from './stop-app';

const PS_OUTPUT = [
  '  501 /Applications/Nerd Dictum.app/Contents/MacOS/Nerd Dictum',
  '50496 /Users/me/worktree/release/mac-arm64/Nerd Dictum.app/Contents/MacOS/Nerd Dictum',
  '84578 /Applications/Nerd Dictum.app/Contents/Frameworks/Nerd Dictum Helper.app/Contents/MacOS/Nerd Dictum Helper --type=gpu-process --user-data-dir=/x',
  '12345 /Applications/Safari.app/Contents/MacOS/Safari',
  '50495 open -W -n --env LOCAL_DEV_BUILD=true ./release/mac-arm64/Nerd Dictum.app',
].join('\n');

describe('parseRunningApps', () => {
  it('finds both the installed copy and the dev build', () => {
    const apps = parseRunningApps(PS_OUTPUT);
    expect(apps.map((a) => a.pid)).toEqual([501, 50496]);
  });

  it('ignores helper processes, other apps and the launching open(1)', () => {
    const paths = parseRunningApps(PS_OUTPUT).map((a) => a.path);
    expect(paths.some((p) => p.includes('Helper'))).toBe(false);
    expect(paths.some((p) => p.includes('Safari'))).toBe(false);
    expect(paths.some((p) => p.startsWith('open '))).toBe(false);
  });

  it('returns nothing for empty output', () => {
    expect(parseRunningApps('')).toEqual([]);
  });
});

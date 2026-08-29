/**
 * Kill every running Nerd Dictum before a dev build starts.
 *
 * Electron's single-instance lock is keyed on userData, which the installed
 * /Applications copy shares with the dev build — so a running installed copy
 * makes `bun run dev:mac` launch and immediately quit, silently. This kills
 * whatever is running, installed copy included, and waits for it to be gone.
 */

const MAIN_PROCESS_PATTERN = /\/Contents\/MacOS\/Nerd Dictum$/;
const WAIT_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 200;

interface RunningApp {
  pid: number;
  path: string;
}

/**
 * Parse `ps -eo pid=,command=` output into main Nerd Dictum processes.
 * Helper processes are excluded: their command line carries `--type=...`
 * arguments, so it never ends at the executable path.
 */
export function parseRunningApps(psOutput: string): RunningApp[] {
  const apps: RunningApp[] = [];
  for (const line of psOutput.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    if (!match) continue;
    const [, pidText, command] = match;
    if (!MAIN_PROCESS_PATTERN.test(command)) continue;
    apps.push({ pid: parseInt(pidText, 10), path: command });
  }
  return apps;
}

async function listRunningApps(): Promise<RunningApp[]> {
  const proc = Bun.spawn(['ps', '-eo', 'pid=,command='], { stdout: 'pipe' });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return parseRunningApps(output);
}

function kill(app: RunningApp, signal: 'SIGTERM' | 'SIGKILL'): void {
  try {
    process.kill(app.pid, signal);
  } catch {
    // Already gone — that is the outcome we wanted anyway.
  }
}

async function main(): Promise<void> {
  const running = await listRunningApps();

  if (running.length === 0) {
    console.log('[stop-app] Nothing to stop');
    return;
  }

  for (const app of running) {
    console.log(`[stop-app] Killing pid ${app.pid}: ${app.path}`);
    kill(app, 'SIGTERM');
  }

  // The single-instance lock is only released once the process is really gone,
  // so returning early would hand the next launch the same failure.
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await Bun.sleep(POLL_INTERVAL_MS);
    if ((await listRunningApps()).length === 0) {
      console.log('[stop-app] All instances stopped');
      return;
    }
  }

  const stubborn = await listRunningApps();
  console.log(`[stop-app] ${stubborn.length} instance(s) ignored SIGTERM, sending SIGKILL`);
  for (const app of stubborn) {
    kill(app, 'SIGKILL');
  }
  await Bun.sleep(POLL_INTERVAL_MS);
}

if (import.meta.main) {
  await main();
}

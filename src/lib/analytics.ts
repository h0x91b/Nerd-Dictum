/**
 * Google Analytics 4 Measurement Protocol client for Electron
 * Sends events directly to GA4 without requiring browser environment
 */
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GA_MEASUREMENT_ID = 'G-NRCQ59JM7R';
const GA_API_SECRET = 'Lbb5rbS1QY6v43KNoCvvRQ';
const GA_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`;

let clientId: string | null = null;
let appVersion: string | null = null;

function getClientIdPath(): string {
  return path.join(app.getPath('userData'), 'analytics-client-id');
}

/**
 * Initialize analytics by loading or creating a persistent client ID
 * Call this once at app startup
 * @param version App version to include in all events
 */
export function initAnalytics(version?: string): void {
  appVersion = version || app.getVersion();

  const clientIdPath = getClientIdPath();
  try {
    if (fs.existsSync(clientIdPath)) {
      clientId = fs.readFileSync(clientIdPath, 'utf-8').trim();
    } else {
      clientId = crypto.randomUUID();
      fs.writeFileSync(clientIdPath, clientId, 'utf-8');
    }
  } catch {
    // Fallback to in-memory UUID if file operations fail
    clientId = crypto.randomUUID();
  }
}

/**
 * Track an event in Google Analytics
 * @param name Event name (e.g., 'app_start', 'recording_start')
 * @param params Optional event parameters
 */
export async function trackEvent(
  name: string,
  params: Record<string, string | number> = {}
): Promise<void> {
  if (!clientId) return;

  try {
    const response = await fetch(GA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        // Required for events to show in Realtime reports
        timestamp_micros: Date.now() * 1000,
        // User properties persist across sessions and are visible in GA4 reports
        user_properties: {
          app_version: { value: String(appVersion) },
          platform: { value: String(process.platform) },
        },
        events: [{
          name,
          params: {
            ...params,
            // engagement_time_msec is required for events to appear in Realtime
            engagement_time_msec: 100,
            // session_id helps group events together
            session_id: sessionId,
          },
        }],
      }),
    });
    console.log(`[Analytics] Event '${name}' sent, status: ${response.status}`);
  } catch (error) {
    console.log('[Analytics] Failed to send event:', error);
    // Silently ignore analytics errors - should never block app functionality
  }
}

// Session ID for grouping events (generated once per app launch)
const sessionId = Date.now().toString();

// Heartbeat interval reference for cleanup
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Start sending periodic heartbeat pings to show active users in Realtime
 * Sends a ping every hour
 */
export function startHeartbeat(): void {
  // Send initial heartbeat
  trackEvent('heartbeat');

  // Then send every hour (3600000 ms)
  heartbeatInterval = setInterval(() => {
    trackEvent('heartbeat');
  }, 60 * 60 * 1000);
}

/**
 * Stop the heartbeat interval (call on app quit)
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

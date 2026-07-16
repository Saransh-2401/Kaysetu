/**
 * Single source of truth for the agent "Online / Offline" badge.
 *
 * The mobile app sends an app heartbeat (~every 2 min) and flushes location
 * every ~60 s. The previous, duplicated `<= 3` minute rule flipped agents to
 * "Offline" on a single missed heartbeat or a brief network blip. A 6-minute
 * window tolerates a couple of missed beats / flushes while still reflecting a
 * genuine drop-off quickly. Tune here once instead of in four files.
 */
export const AGENT_ONLINE_WINDOW_MIN = 6;

/** Minutes since the agent's last heartbeat, or null if never/unparseable. */
export function minutesSinceLastSeen(lastSeen: string | null): number | null {
  if (!lastSeen) return null;
  const ts = new Date(lastSeen).getTime();
  if (Number.isNaN(ts)) return null;
  return (Date.now() - ts) / 60000;
}

/** True when the agent's heartbeat is within the online window. */
export function isAgentOnline(lastSeen: string | null): boolean {
  const diff = minutesSinceLastSeen(lastSeen);
  return diff !== null && diff <= AGENT_ONLINE_WINDOW_MIN;
}

/** Human-friendly "Offline · 12m" / "Offline · 2h" label. */
export function offlineLabel(lastSeen: string | null): string {
  const diff = minutesSinceLastSeen(lastSeen);
  if (diff === null) return "Offline";
  return diff >= 60
    ? `Offline · ${Math.floor(diff / 60)}h`
    : `Offline · ${Math.round(diff)}m`;
}

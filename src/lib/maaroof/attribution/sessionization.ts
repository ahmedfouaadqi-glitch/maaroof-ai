import type { NormalizedTrafficRecord } from "./adapters";
import type { TrafficChannel } from "./domain";

export type SessionChannelCount = {
  channel: TrafficChannel;
  sessions: number;
};

export type SessionSummary = {
  workspaceId: string;
  humanSessions: number;
  aiReferralSessions: number;
  crawlerSessions: number;
  eventsWithoutSessionId: number;
  sessionsByChannel: SessionChannelCount[];
  limitations: string[];
};

/**
 * Summarizes only explicit session identifiers supplied by an analytics source.
 * It does not create cookies, infer sessions from event gaps, or count crawler
 * sessions as human visits.
 */
export function summarizeSessions(
  traffic: NormalizedTrafficRecord[],
  workspaceId: string,
): SessionSummary {
  const scoped = traffic.filter((item) => item.event.workspaceId === workspaceId);
  const groups = new Map<string, NormalizedTrafficRecord[]>();
  let eventsWithoutSessionId = 0;

  for (const item of scoped) {
    const sessionId = item.event.sessionId;
    if (!sessionId) {
      eventsWithoutSessionId += 1;
      continue;
    }
    const key = item.provider + ":" + workspaceId + ":" + sessionId;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  const channelCounts = new Map<TrafficChannel, number>();
  let humanSessions = 0;
  let aiReferralSessions = 0;
  let crawlerSessions = 0;

  for (const group of groups.values()) {
    const ordered = [...group].sort(
      (a, b) => Date.parse(a.event.occurredAt) - Date.parse(b.event.occurredAt),
    );

    if (ordered.some((item) => item.classification.channel === "crawler")) {
      crawlerSessions += 1;
      continue;
    }

    const sessionChannel = ordered[0].classification.channel;
    humanSessions += 1;
    if (sessionChannel === "ai_referral") aiReferralSessions += 1;
    channelCounts.set(sessionChannel, (channelCounts.get(sessionChannel) || 0) + 1);
  }

  const limitations = [
    "Session totals use provider-supplied session IDs; no inactivity-based sessionization is performed.",
    "Events without a session ID are excluded from session totals.",
    "A session containing any crawler-marker event is excluded from human sessions; user-agent identification is provisional.",
    "The earliest event's source classification is used as the session source; this is not a causal attribution model.",
  ];

  if (scoped.length === 0) limitations.push("No traffic events were supplied for this workspace.");

  return {
    workspaceId,
    humanSessions,
    aiReferralSessions,
    crawlerSessions,
    eventsWithoutSessionId,
    sessionsByChannel: [...channelCounts.entries()].map(([channel, sessions]) => ({ channel, sessions })),
    limitations,
  };
}

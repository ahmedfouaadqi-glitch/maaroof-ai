export type BrandBoostFrequency = "daily" | "weekly" | "monthly";

/** Weekly means two runs per seven days, spaced by 84 hours. */
export function nextBrandBoostRunAt(frequency: string, from: Date): Date {
  const next = new Date(from);
  if (!Number.isFinite(next.getTime())) throw new Error("invalid_schedule_date");
  if (frequency === "daily") {
    next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
    return next;
  }
  if (frequency === "weekly") {
    next.setTime(next.getTime() + 84 * 60 * 60 * 1000);
    return next;
  }
  if (frequency === "monthly") {
    const day = next.getUTCDate();
    const hour = next.getUTCHours();
    const minute = next.getUTCMinutes();
    const second = next.getUTCSeconds();
    const ms = next.getUTCMilliseconds();
    const targetMonth = next.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
    next.setUTCMonth(targetMonth, Math.min(day, lastDay));
    next.setUTCHours(hour, minute, second, ms);
    return next;
  }
  next.setTime(next.getTime() + 7 * 24 * 60 * 60 * 1000);
  return next;
}

export function previousCalendarMonth(now: Date): { month: string; start: string; end: string } {
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const startDate = new Date(Date.UTC(year, monthIndex - 1, 1));
  const endDate = new Date(Date.UTC(year, monthIndex, 1));
  return {
    month: startDate.toISOString().slice(0, 7),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

/** Retry report dispatch throughout the first seven UTC days if Cron was briefly unavailable. */
export function shouldSendMonthlyBrandReport(now: Date): boolean {
  return now.getUTCDate() >= 1 && now.getUTCDate() <= 7;
}

export function isValidReportEmail(value: string): boolean {
  const email = String(value || "").trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type CronField = Set<number>;
export type ParsedCron = {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
  dayOfMonthWildcard: boolean;
  dayOfWeekWildcard: boolean;
};

function fieldValues(field: string, min: number, max: number, dow = false): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart == null ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) return null;
    let from: number;
    let to: number;
    if (rangePart === "*") {
      from = min; to = max;
    } else if (rangePart.includes("-")) {
      const [a, b, ...rest] = rangePart.split("-");
      from = Number(a); to = Number(b);
      if (rest.length) return null;
    } else {
      from = Number(rangePart);
      to = stepPart == null ? from : max;
    }
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < min || from > max || to < min || to > max || from > to) return null;
    for (let value = from; value <= to; value += step) values.add(dow && value === 7 ? 0 : value);
  }
  return values.size ? values : null;
}

/** Parse standard five-field UTC cron. Unsupported forms fail closed instead of silently becoming hourly. */
export function parseCronExpression(expression: string): ParsedCron | null {
  const fields = String(expression || "").trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const parsedMinute = fieldValues(minute, 0, 59);
  const parsedHour = fieldValues(hour, 0, 23);
  const parsedDom = fieldValues(dayOfMonth, 1, 31);
  const parsedMonth = fieldValues(month, 1, 12);
  const parsedDow = fieldValues(dayOfWeek, 0, 7, true);
  if (!parsedMinute || !parsedHour || !parsedDom || !parsedMonth || !parsedDow) return null;
  return {
    minute: parsedMinute, hour: parsedHour, dayOfMonth: parsedDom, month: parsedMonth, dayOfWeek: parsedDow,
    dayOfMonthWildcard: dayOfMonth === "*", dayOfWeekWildcard: dayOfWeek === "*",
  };
}

function dayMatches(date: Date, cron: ParsedCron): boolean {
  const dom = cron.dayOfMonth.has(date.getUTCDate());
  const dow = cron.dayOfWeek.has(date.getUTCDay());
  if (cron.dayOfMonthWildcard && cron.dayOfWeekWildcard) return true;
  if (cron.dayOfMonthWildcard) return dow;
  if (cron.dayOfWeekWildcard) return dom;
  // Standard cron behavior: when both day-of-month and day-of-week are constrained, either may match.
  return dom || dow;
}

/** Next strictly-future UTC occurrence. Uses field-aware jumps, not a minute-by-minute 500k iteration scan. */
export function nextCronRunDate(expression: string, after: Date = new Date()): Date | null {
  const cron = parseCronExpression(expression);
  if (!cron || !Number.isFinite(after.getTime())) return null;
  const candidate = new Date(after.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setTime(candidate.getTime() + 60_000);

  for (let step = 0; step < 20_000; step++) {
    const month = candidate.getUTCMonth() + 1;
    if (!cron.month.has(month)) {
      let nextMonth = Array.from(cron.month).filter((m) => m > month).sort((a, b) => a - b)[0];
      let year = candidate.getUTCFullYear();
      if (nextMonth == null) {
        nextMonth = Math.min(...cron.month);
        year += 1;
      }
      candidate.setUTCFullYear(year, nextMonth - 1, 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(candidate, cron)) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }
    const hour = candidate.getUTCHours();
    if (!cron.hour.has(hour)) {
      const nextHour = Array.from(cron.hour).filter((h) => h > hour).sort((a, b) => a - b)[0];
      if (nextHour != null) candidate.setUTCHours(nextHour, 0, 0, 0);
      else {
        candidate.setUTCDate(candidate.getUTCDate() + 1);
        candidate.setUTCHours(0, 0, 0, 0);
      }
      continue;
    }
    const minute = candidate.getUTCMinutes();
    if (!cron.minute.has(minute)) {
      const nextMinute = Array.from(cron.minute).filter((m) => m > minute).sort((a, b) => a - b)[0];
      if (nextMinute != null) candidate.setUTCMinutes(nextMinute, 0, 0);
      else {
        candidate.setUTCHours(candidate.getUTCHours() + 1, 0, 0, 0);
      }
      continue;
    }
    return candidate;
  }
  return null;
}

export function validateSchedulePolicy(input: {
  cadence: string;
  cronExpression?: string | null;
  approvalMode: string;
  maxRuns: number;
  forceTools: string[];
  allowedTools: string[];
  workspaceOwned: boolean;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.workspaceOwned) errors.push("workspace_not_owned");
  if (input.forceTools.some((tool) => !input.allowedTools.includes(tool))) errors.push("force_tool_not_executable");
  if (input.cadence === "custom_cron" && !parseCronExpression(String(input.cronExpression || ""))) errors.push("invalid_custom_cron");
  if (input.approvalMode !== "per_run" && input.maxRuns < 1) errors.push("automatic_schedule_requires_finite_max_runs");
  if (input.maxRuns < 0 || input.maxRuns > 10000) errors.push("max_runs_out_of_range");
  return { valid: errors.length === 0, errors };
}

import { describe, expect, it } from "vitest";
import { buildTaskHistoryExportPayload } from "@/lib/maaroof/task-history-export";

describe("archived task export", () => {
  it("rebuilds detailed audit sections from persisted tool-result and final events", () => {
    const payload = buildTaskHistoryExportPayload({
      id: "job-1",
      goal: "Visibility audit",
      status: "completed",
      created_at: "2026-10-25T12:00:00.000Z",
      request_payload: {},
    }, [
      {
        seq: 1,
        event_type: "tool_result",
        created_at: "2026-10-25T12:00:01.000Z",
        payload: {
          index: 0,
          tool: "visibility",
          ok: true,
          output: {
            probe: {
              query: "Where is this brand visible?",
              blind_query: "Where is this brand visible?",
              asked: ["chatgpt"],
              answers: [{
                engine: "chatgpt",
                answer: "Recorded model answer mentioning Acme.",
                mentioned: true,
                rank: 1,
                sources: [{ url: "https://example.com/source" }],
              }],
            },
          },
        },
      },
      {
        seq: 2,
        event_type: "final",
        created_at: "2026-10-25T12:00:03.000Z",
        payload: { text: "Final archived answer." },
      },
    ], "en");

    const serialized = JSON.stringify(payload);
    const headings = payload.sections.map((section) => section.heading).join("\n");
    expect(payload.title).toBe("Visibility audit");
    expect(serialized).toContain("Final archived answer.");
    expect(serialized).toContain("Where is this brand visible?");
    expect(serialized).toContain("https://example.com/source");
    expect(headings).toContain("SEO card");
    expect(headings).toContain("AEO card");
    expect(headings).toContain("GEO card");
    expect(headings).toContain("SGE card");
    expect(headings).toContain("GSEO card");
    expect(headings).toContain("Activity log");
    expect(headings).toContain("Status");
  });

  it("creates a useful report for tasks whose saved event stream has no tool outputs", () => {
    const payload = buildTaskHistoryExportPayload({
      id: "job-2",
      goal: "Partial task",
      status: "completed",
      created_at: "2026-10-25T12:00:00.000Z",
    }, [
      { seq: 1, event_type: "final", payload: { text: "Summary only" } },
    ], "ar");
    const headings = payload.sections.map((section) => section.heading).join("\n");
    expect(JSON.stringify(payload)).toContain("Summary only");
    expect(headings).toContain("بطاقة SEO");
    expect(headings).toContain("بطاقة GSEO");
    expect(headings).toContain("سجل العمل");
  });
});

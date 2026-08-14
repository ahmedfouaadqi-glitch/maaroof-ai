import { describe, expect, it } from "vitest";
import {
  buildDriveWorkspaceLayout,
  resolveKnowledgeStorageStatus,
} from "@/lib/maaroof/knowledge-storage.server";

const supabase = { provider: "supabase", google_drive_enabled: false } as const;
const drive = { provider: "google_drive", google_drive_enabled: true } as const;

describe("knowledge storage boundary", () => {
  it("builds deterministic user/workspace branches without leaking path characters", () => {
    const layout = buildDriveWorkspaceLayout({
      brandName: "Acme / Global",
      specialty: "Growth: AI",
      userId: "user-123",
      workspaceId: "ws-456",
    });
    expect(layout.rootName).toBe("MAAROOF Knowledge");
    expect(layout.userFolderName).toBe("user-123 — Acme Global");
    expect(layout.workspaceFolderName).toBe("ws-456 — Growth AI");
    expect(layout.branches).toContain("evidence");
  });

  it("keeps Supabase active and Drive opt-in until OAuth is present", () => {
    expect(resolveKnowledgeStorageStatus(supabase)).toMatchObject({
      provider: "supabase",
      available: true,
      connected: true,
    });
    expect(resolveKnowledgeStorageStatus(drive)).toMatchObject({
      provider: "google_drive",
      available: false,
      connected: false,
      requiresUserOAuth: true,
    });
    expect(resolveKnowledgeStorageStatus(drive, "oauth-token")).toMatchObject({
      provider: "google_drive",
      available: true,
      connected: true,
    });
  });
});

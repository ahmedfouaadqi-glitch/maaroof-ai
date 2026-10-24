import { describe, it, expect } from "vitest";
import { validateAttachment, attachmentKind, attachmentPath, ownsPath } from "./attachments";

describe("attachments", () => {
  it("rejects files over 10MB", () => {
    expect(validateAttachment({ size: 10 * 1024 * 1024 + 1, type: "image/png" })).toBe("too_large");
    expect(validateAttachment({ size: 1000, type: "image/png" })).toBe("ok");
  });
  it("accepts images, PDF and text only", () => {
    expect(attachmentKind("application/pdf")).toBe("pdf");
    expect(attachmentKind("application/zip")).toBeNull();
  });
  it("stores inside the owner's folder and blocks others", () => {
    const p = attachmentPath("u1", "my logo.png", 5);
    expect(p).toBe("u1/5-my_logo.png");
    expect(ownsPath("u1", p)).toBe(true);
    expect(ownsPath("u2", p)).toBe(false);
    expect(ownsPath("u1", "u1/../u2/x")).toBe(false);
  });
});

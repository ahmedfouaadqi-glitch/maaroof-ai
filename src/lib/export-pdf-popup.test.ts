import { afterEach, describe, expect, it, vi } from "vitest";
import { exportToPDF, type ExportPayload } from "./exports";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PDF export popup handling", () => {
  it("uses a popup opened by the click handler instead of opening one after async work", async () => {
    const popupDocument = {
      title: "",
      body: { textContent: "" },
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    };
    const popup = { document: popupDocument, closed: false } as unknown as Window;
    const open = vi.fn();

    vi.stubGlobal("window", { open });

    const payload: ExportPayload = {
      title: "Popup regression test",
      lang: "en",
      sections: [],
      identity: { showLogo: false },
    };

    await exportToPDF(payload, popup);

    expect(open).not.toHaveBeenCalled();
    expect(popupDocument.open).toHaveBeenCalledOnce();
    expect(popupDocument.write).toHaveBeenCalledOnce();
    expect(popupDocument.write.mock.calls[0]?.[0]).toContain("<title>Popup regression test — MAAROOF Ai</title>");
    expect(popupDocument.close).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect } from "vitest";
import { buildMachineFiles } from "@/components/MachineFilesPanel";

describe("buildMachineFiles", () => {
  it("uses only facts from the user's text", () => {
    const t = "Zain is a telecom operator in Iraq. It serves 16 million subscribers across 18 governorates. Support is available all day.";
    const f = buildMachineFiles(t, "Zain", "https://zain.example");
    expect(f.llms).toContain("# Zain");
    expect(f.llms).toContain("16 million");
    const ld = JSON.parse(f.jsonld);
    expect(ld[0].url).toBe("https://zain.example");
    expect(f.jsonld).not.toMatch(/\b99\b/);
  });
});

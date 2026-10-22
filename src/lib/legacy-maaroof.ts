/** Maps an old /maaroof tab to its Maaroof Space (/workspace) tab. Pure. */
export function mapLegacyMaaroofTab(tab: unknown): string | undefined {
  switch (tab) {
    case "tasks": return "ops";
    case "channels": return "channels";
    case "approvals": return "approvals";
    case "knowledge": return "knowledge";
    default: return undefined;
  }
}

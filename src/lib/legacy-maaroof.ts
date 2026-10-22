/** Maps an old /maaroof tab to its Maaroof Space (/workspace) tab. Pure. */
export function mapLegacyMaaroofTab(tab: unknown): string | undefined {
  switch (tab) {
    case "tasks": return "extras";
    case "channels": return "extras";
    case "approvals": return "interview";
    case "knowledge": return "knowledge";
    default: return undefined;
  }
}

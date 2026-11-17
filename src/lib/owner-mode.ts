/** Presentation policy for the single-owner operating workspace.
 * This is deliberately UI-only: it does not grant identity, authorization,
 * billing, or data-access privileges.
 */
export type OwnerModeOptions = {
  isSingleOwnerMode?: boolean;
  hideBalanceCards?: boolean;
  hideTokenCounts?: boolean;
  hideToolPrices?: boolean;
};

export type OwnerWorkspacePresentation = {
  isSingleOwnerMode: boolean;
  showBalanceCards: boolean;
  showTokenCounts: boolean;
  showToolPrices: boolean;
};

export function resolveOwnerWorkspacePresentation(
  options: OwnerModeOptions = {},
): OwnerWorkspacePresentation {
  const isSingleOwnerMode = options.isSingleOwnerMode ?? true;
  return {
    isSingleOwnerMode,
    showBalanceCards: !isSingleOwnerMode || !(options.hideBalanceCards ?? true),
    showTokenCounts: !isSingleOwnerMode || !(options.hideTokenCounts ?? true),
    showToolPrices: !isSingleOwnerMode || !(options.hideToolPrices ?? true),
  };
}

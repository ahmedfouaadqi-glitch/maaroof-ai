export type FloatingMenuDirection = "ltr" | "rtl";

export type FloatingMenuRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type FloatingMenuSize = { width: number; height: number };
export type FloatingMenuViewport = { width: number; height: number };
export type FloatingMenuPosition = { top: number; left: number; side: "above" | "below" };

/** Positions a portal-mounted menu within the visible viewport, avoiding clipped scroll containers. */
export function computeFloatingMenuPosition(
  anchor: FloatingMenuRect,
  menu: FloatingMenuSize,
  viewport: FloatingMenuViewport,
  direction: FloatingMenuDirection,
  gutter = 12,
  gap = 8,
): FloatingMenuPosition {
  const width = Math.min(menu.width, Math.max(0, viewport.width - gutter * 2));
  const height = Math.min(menu.height, Math.max(0, viewport.height - gutter * 2));
  const preferredLeft = direction === "rtl" ? anchor.right - width : anchor.left;
  const left = Math.max(gutter, Math.min(preferredLeft, viewport.width - width - gutter));
  const roomBelow = viewport.height - anchor.bottom - gutter;
  const roomAbove = anchor.top - gutter;
  const side: "above" | "below" = height + gap > roomBelow && roomAbove > roomBelow ? "above" : "below";
  const preferredTop = side === "above" ? anchor.top - height - gap : anchor.bottom + gap;
  const top = Math.max(gutter, Math.min(preferredTop, viewport.height - height - gutter));

  return { top, left, side };
}

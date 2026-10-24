import type { ReactNode } from "react";

/**
 * Hexagonal frame inspired by the MAAROOF Ai logo silhouette.
 * Renders a gradient ring (primary → accent) around a hex-clipped inner surface.
 */
export function HexBadge({
  size = 44,
  children,
  className = "",
  innerClassName = "",
  ring = true,
}: {
  size?: number;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  ring?: boolean;
}) {
  const padding = ring ? Math.max(2, Math.round(size * 0.06)) : 0;
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {ring && (
        <div
          aria-hidden
          className="absolute inset-0 clip-hex bg-gradient-to-br from-[var(--cyber)] via-primary/60 to-[var(--accent)]"
        />
      )}
      <div
        className={`absolute clip-hex grid place-items-center bg-background/85 backdrop-blur-sm ${innerClassName}`}
        style={{ inset: padding }}
      >
        {children}
      </div>
    </div>
  );
}

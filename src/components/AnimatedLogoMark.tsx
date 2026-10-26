import type { CSSProperties } from "react";

type AnimatedLogoMarkProps = {
  src: string;
  alt: string;
};

/**
 * A lightweight, React Bits-inspired logo treatment: breathing halo,
 * image-masked shimmer, slow orbit and a restrained hover response.
 * The underlying brand asset is used unchanged.
 */
export function AnimatedLogoMark({ src, alt }: AnimatedLogoMarkProps) {
  const shimmerMask: CSSProperties = {
    maskImage: `url("${src}")`,
    WebkitMaskImage: `url("${src}")`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };

  return (
    <span className="maaroof-logo-motion" aria-label={alt} role="img">
      <span className="maaroof-logo-halo" aria-hidden="true" />
      <span className="maaroof-logo-orbit" aria-hidden="true">
        <span className="maaroof-logo-breath">
          <img src={src} alt="" draggable={false} className="maaroof-logo-image" />
          <span aria-hidden="true" className="maaroof-logo-shimmer" style={shimmerMask} />
        </span>
      </span>
    </span>
  );
}

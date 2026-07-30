import { motion, type Transition } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ElementType } from "react";

type Snapshot = Record<string, string | number>;

const buildKeyframes = (from: Snapshot, steps: Snapshot[]) => {
  const keys = new Set<string>([...Object.keys(from), ...steps.flatMap((s) => Object.keys(s))]);
  const keyframes: Record<string, (string | number)[]> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])] as (string | number)[];
  });
  return keyframes;
};

export type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Snapshot;
  animationTo?: Snapshot[];
  onAnimationComplete?: () => void;
  stepDuration?: number;
  /** Semantic tag to render (keeps SEO heading structure intact). */
  as?: ElementType;
  /** Extra delay (ms) before the sequence starts — used to stagger title → subtitle. */
  startDelay?: number;
  /** Center the wrapped segments (default true, matches hero layouts). */
  center?: boolean;
  /** Class applied to each animated segment (use for text-gradient, which
   * cannot clip across animated children). */
  segmentClassName?: string;
  /** Loop the reveal indefinitely while visible (default true). */
  repeat?: boolean;
  /** Idle time (ms) between loops. */
  repeatDelay?: number;
};

/**
 * BlurText — React Bits blur-in text reveal, adapted to TS + RTL + a11y.
 * Renders any semantic tag, respects prefers-reduced-motion, and re-runs
 * when the text changes (e.g. language switch).
 */
export function BlurText({
  text = "",
  delay = 70,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.15,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  onAnimationComplete,
  stepDuration = 0.28,
  as,
  startDelay = 0,
  center = true,
  segmentClassName = "",
  repeat = true,
  repeatDelay = 4000,
}: BlurTextProps) {
  const Tag = (as ?? "p") as ElementType;
  const MotionSpan = motion.span;
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setInView(true);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (!repeat) observer.disconnect();
        } else if (repeat) {
          // pause the loop while off-screen
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, repeat]);

  const defaultFrom = useMemo<Snapshot>(
    () =>
      direction === "top"
        ? { filter: "blur(10px)", opacity: 0, y: -24 }
        : { filter: "blur(10px)", opacity: 0, y: 24 },
    [direction],
  );

  const defaultTo = useMemo<Snapshot[]>(
    () => [
      { filter: "blur(5px)", opacity: 0.5, y: direction === "top" ? 4 : -4 },
      { filter: "blur(0px)", opacity: 1, y: 0 },
    ],
    [direction],
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;
  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)));

  if (reduced) {
    return (
      <Tag ref={ref as never} className={className}>
        {text}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref as never}
      className={className}
      style={{ display: "flex", flexWrap: "wrap", justifyContent: center ? "center" : undefined }}
    >
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);
        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (startDelay + index * delay) / 1000,
          ease: "easeOut",
        };
        return (
          <MotionSpan
            className={`inline-block will-change-[transform,filter,opacity] ${segmentClassName}`}
            key={`${text}-${index}`}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          >
            {segment === " " ? "\u00A0" : segment}
            {animateBy === "words" && index < elements.length - 1 && "\u00A0"}
          </MotionSpan>
        );
      })}
    </Tag>
  );
}

export default BlurText;

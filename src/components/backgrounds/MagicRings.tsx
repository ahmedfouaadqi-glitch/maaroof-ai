import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import "./MagicRings.css";

/**
 * MagicRings — React Bits concentric-glow rings.
 * Ported from the three.js reference to `ogl` (already used by Lightfall)
 * so the app does not ship a second WebGL runtime. Shader math is unchanged.
 */

const vertex = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;

uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform float uMouseInfluence, uHoverAmount, uHoverScale, uParallax, uBurst;
uniform vec2 uResolution, uMouse;
uniform vec3 uColor, uColorTwo;
uniform int uRingCount;

const float HP = 1.5707963;
const float CYCLE = 3.45;

float fade(float t) {
  return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * uScaleRate;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * uLineThickness;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}

void main() {
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  float cr = cos(uRotation), sr = sin(uRotation);
  p = mat2(cr, -sr, sr, cr) * p;
  p -= uMouse * uMouseInfluence;
  float sc = mix(1.0, uHoverScale, uHoverAmount) + uBurst * 0.3;
  p /= sc;

  vec3 c = vec3(0.0);
  float rcf = max(float(uRingCount) - 1.0, 1.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uRingCount) break;
    float fi = float(i);
    vec2 pr = p - fi * uParallax * uMouse;
    vec3 rc = mix(uColor, uColorTwo, fi / rcf);
    c = mix(c, rc, vec3(ring(pr, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 2.95 * fi, px)));
  }
  c *= 1.0 + uBurst * 2.0;

  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;

  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)) * uOpacity);
}
`;

const hexToRGB = (hex: string): [number, number, number] => {
  const c = hex.replace("#", "").padEnd(6, "0");
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
};

export interface MagicRingsProps {
  className?: string;
  color?: string;
  colorTwo?: string;
  speed?: number;
  ringCount?: number;
  attenuation?: number;
  lineThickness?: number;
  baseRadius?: number;
  radiusStep?: number;
  scaleRate?: number;
  opacity?: number;
  blur?: number;
  noiseAmount?: number;
  rotation?: number;
  ringGap?: number;
  fadeIn?: number;
  fadeOut?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  hoverScale?: number;
  parallax?: number;
  clickBurst?: boolean;
  /** Skip rendering entirely (e.g. off-screen cards). */
  paused?: boolean;
}

export function MagicRings({
  className,
  color = "#A855F7",
  colorTwo = "#6366F1",
  speed = 1,
  ringCount = 6,
  attenuation = 10,
  lineThickness = 2,
  baseRadius = 0.35,
  radiusStep = 0.1,
  scaleRate = 0.1,
  opacity = 1,
  blur = 0,
  noiseAmount = 0.1,
  rotation = 0,
  ringGap = 1.5,
  fadeIn = 0.7,
  fadeOut = 0.5,
  followMouse = false,
  mouseInfluence = 0.2,
  hoverScale = 1.2,
  parallax = 0.05,
  clickBurst = false,
  paused = false,
}: MagicRingsProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef<Required<Omit<MagicRingsProps, "className" | "blur">>>(null as never);
  const mouseRef = useRef<[number, number]>([0, 0]);
  const smoothMouseRef = useRef<[number, number]>([0, 0]);
  const hoverAmountRef = useRef(0);
  const isHoveredRef = useRef(false);
  const burstRef = useRef(0);

  propsRef.current = {
    color, colorTwo, speed, ringCount, attenuation, lineThickness,
    baseRadius, radiusStep, scaleRate, opacity, noiseAmount,
    rotation, ringGap, fadeIn, fadeOut, followMouse, mouseInfluence,
    hoverScale, parallax, clickBurst, paused,
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let renderer: any;
    try {
      renderer = new Renderer({ alpha: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    mount.appendChild(canvas);

    const uniforms = {
      uTime: { value: 0 },
      uAttenuation: { value: attenuation },
      uResolution: { value: [1, 1] },
      uColor: { value: hexToRGB(color) },
      uColorTwo: { value: hexToRGB(colorTwo) },
      uLineThickness: { value: lineThickness },
      uBaseRadius: { value: baseRadius },
      uRadiusStep: { value: radiusStep },
      uScaleRate: { value: scaleRate },
      uRingCount: { value: ringCount },
      uOpacity: { value: opacity },
      uNoiseAmount: { value: noiseAmount },
      uRotation: { value: 0 },
      uRingGap: { value: ringGap },
      uFadeIn: { value: fadeIn },
      uFadeOut: { value: fadeOut },
      uMouse: { value: [0, 0] },
      uMouseInfluence: { value: 0 },
      uHoverAmount: { value: 0 },
      uHoverScale: { value: hoverScale },
      uParallax: { value: parallax },
      uBurst: { value: 0 },
    };

    let program: any;
    let geometry: any;
    let mesh: any;
    try {
      program = new Program(gl, { vertex, fragment, uniforms, transparent: true });
      geometry = new Triangle(gl);
      mesh = new Mesh(gl, { geometry, program });
    } catch (e) {
      console.error(e);
      if (canvas.parentElement === mount) mount.removeChild(canvas);
      return;
    }

    let hasSize = false;
    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1));
      uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
      // The container can mount at zero height (opening panels); paint once
      // as soon as real dimensions arrive so the first frame isn't blank.
      if (!hasSize && rect.width > 1 && rect.height > 1) {
        hasSize = true;
        try { renderer.render({ scene: mesh }); } catch { /* ignore */ }
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);


    // Only animate while the card is on screen.
    let onScreen = true;
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0 });
    io.observe(mount);

    const host = mount.parentElement ?? mount;
    const onMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouseRef.current[0] = (e.clientX - rect.left) / rect.width - 0.5;
      mouseRef.current[1] = -((e.clientY - rect.top) / rect.height - 0.5);
    };
    const onMouseEnter = () => { isHoveredRef.current = true; };
    const onMouseLeave = () => {
      isHoveredRef.current = false;
      mouseRef.current[0] = 0;
      mouseRef.current[1] = 0;
    };
    const onClick = () => { burstRef.current = 1; };
    host.addEventListener("mousemove", onMouseMove);
    host.addEventListener("mouseenter", onMouseEnter);
    host.addEventListener("mouseleave", onMouseLeave);
    host.addEventListener("click", onClick);

    let frameId = 0;
    const animate = (t: number) => {
      frameId = requestAnimationFrame(animate);
      const p = propsRef.current;
      if (p.paused || !onScreen || document.visibilityState === "hidden") return;

      smoothMouseRef.current[0] += (mouseRef.current[0] - smoothMouseRef.current[0]) * 0.08;
      smoothMouseRef.current[1] += (mouseRef.current[1] - smoothMouseRef.current[1]) * 0.08;
      hoverAmountRef.current += ((isHoveredRef.current ? 1 : 0) - hoverAmountRef.current) * 0.08;
      burstRef.current *= 0.95;
      if (burstRef.current < 0.001) burstRef.current = 0;

      uniforms.uTime.value = t * 0.001 * p.speed;
      uniforms.uAttenuation.value = p.attenuation;
      uniforms.uColor.value = hexToRGB(p.color);
      uniforms.uColorTwo.value = hexToRGB(p.colorTwo);
      uniforms.uLineThickness.value = p.lineThickness;
      uniforms.uBaseRadius.value = p.baseRadius;
      uniforms.uRadiusStep.value = p.radiusStep;
      uniforms.uScaleRate.value = p.scaleRate;
      uniforms.uRingCount.value = p.ringCount;
      uniforms.uOpacity.value = p.opacity;
      uniforms.uNoiseAmount.value = p.noiseAmount;
      uniforms.uRotation.value = (p.rotation * Math.PI) / 180;
      uniforms.uRingGap.value = p.ringGap;
      uniforms.uFadeIn.value = p.fadeIn;
      uniforms.uFadeOut.value = p.fadeOut;
      uniforms.uMouse.value = [smoothMouseRef.current[0], smoothMouseRef.current[1]];
      uniforms.uMouseInfluence.value = p.followMouse ? p.mouseInfluence : 0;
      uniforms.uHoverAmount.value = hoverAmountRef.current;
      uniforms.uHoverScale.value = p.hoverScale;
      uniforms.uParallax.value = p.parallax;
      uniforms.uBurst.value = p.clickBurst ? burstRef.current : 0;

      try {
        renderer.render({ scene: mesh });
      } catch (e) {
        console.error(e);
      }
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("mousemove", onMouseMove);
      host.removeEventListener("mouseenter", onMouseEnter);
      host.removeEventListener("mouseleave", onMouseLeave);
      host.removeEventListener("click", onClick);
      if (canvas.parentElement === mount) mount.removeChild(canvas);
      const callIfFn = (obj: any, key: string) => {
        if (obj && typeof obj[key] === "function") obj[key].call(obj);
      };
      callIfFn(program, "remove");
      callIfFn(geometry, "remove");
      callIfFn(mesh, "remove");
      callIfFn(renderer, "destroy");
    };
    // Renderer is created once; live values flow through propsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      className={`magic-rings-container ${className ?? ""}`}
      style={blur > 0 ? { filter: `blur(${blur}px)` } : undefined}
      aria-hidden
    />
  );
}

export default MagicRings;

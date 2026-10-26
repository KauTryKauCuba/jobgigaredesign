"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { ThemeAudience, ThemeEffect, ThemeEffectScope } from "@/lib/site-themes-shared";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  color: string;
};

// Particles per 1440px of width — kept light so it decorates, not distracts.
const DENSITY: Record<Exclude<ThemeEffect, "none">, number> = {
  confetti: 42,
  petals: 26,
  snow: 55,
  sparkles: 30,
  lanterns: 9,
};

function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function spawn(effect: Exclude<ThemeEffect, "none">, w: number, h: number, palette: string[], initial: boolean): Particle {
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const color = palette[Math.floor(Math.random() * palette.length)] ?? "#FFFFFF";
  const rising = effect === "lanterns";
  const floating = effect === "sparkles";
  return {
    x: rand(0, w),
    y: floating || initial ? rand(0, h) : rising ? h + rand(20, 120) : -rand(10, 80),
    vx: rand(-0.25, 0.25),
    vy:
      effect === "confetti"
        ? rand(0.9, 1.7)
        : effect === "petals"
          ? rand(0.5, 1)
          : effect === "snow"
            ? rand(0.35, 0.9)
            : rising
              ? -rand(0.35, 0.7)
              : rand(-0.12, 0.12),
    size:
      effect === "confetti"
        ? rand(5, 9)
        : effect === "petals"
          ? rand(6, 11)
          : effect === "snow"
            ? rand(2, 4.5)
            : rising
              ? rand(14, 22)
              : rand(4, 8),
    rot: rand(0, Math.PI * 2),
    vr: rand(-0.04, 0.04),
    phase: rand(0, Math.PI * 2),
    color,
  };
}

function draw(ctx: CanvasRenderingContext2D, effect: Exclude<ThemeEffect, "none">, p: Particle, t: number, main: string) {
  ctx.save();
  ctx.translate(p.x, p.y);
  switch (effect) {
    case "confetti": {
      ctx.rotate(p.rot);
      // Squash on one axis as it "flips" while falling.
      ctx.scale(1, Math.abs(Math.cos(p.rot * 1.6)) * 0.8 + 0.2);
      ctx.fillStyle = hexToRgba(p.color, 0.75);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      break;
    }
    case "petals": {
      ctx.rotate(p.rot);
      ctx.fillStyle = hexToRgba(p.color, 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size / 2, p.size / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "snow": {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = hexToRgba(main, 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "sparkles": {
      const twinkle = (Math.sin(t / 600 + p.phase) + 1) / 2;
      const s = p.size * (0.5 + twinkle * 0.6);
      ctx.rotate(p.rot);
      ctx.fillStyle = hexToRgba(p.color, 0.25 + twinkle * 0.6);
      ctx.beginPath();
      // A four-point star.
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? s : s * 0.28;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "lanterns": {
      const sway = Math.sin(t / 1400 + p.phase) * 0.12;
      ctx.rotate(sway);
      const w = p.size;
      const h = p.size * 1.3;
      // Soft enough that text behind a lantern stays readable.
      ctx.globalAlpha = 0.55;
      ctx.shadowColor = hexToRgba("#FFC94D", 0.55);
      ctx.shadowBlur = 14;
      ctx.fillStyle = hexToRgba(p.color, 0.85);
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, w / 2.6);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Warm glow inside, and the cap and tassel.
      ctx.fillStyle = "rgba(255,226,140,0.55)";
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 4, h / 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexToRgba(main, 0.9);
      ctx.fillRect(-w / 4, -h / 2 - 3, w / 2, 3);
      ctx.fillRect(-w / 4, h / 2, w / 2, 3);
      ctx.fillRect(-0.75, h / 2 + 3, 1.5, h / 4);
      break;
    }
  }
  ctx.restore();
}

function EffectCanvas({
  effect,
  palette,
  main,
  contained,
}: {
  effect: Exclude<ThemeEffect, "none">;
  palette: string[];
  main: string;
  contained: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteKey = palette.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const colors = paletteKey.split(",");
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    const resize = () => {
      const rect = contained && canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : null;
      w = rect ? rect.width : window.innerWidth;
      h = rect ? rect.height : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(4, Math.round(DENSITY[effect] * Math.min(1.2, Math.max(contained ? 0.35 : 0.45, w / 1440))));
      particles = Array.from({ length: count }, (_, i) => particles[i] ?? spawn(effect, w, h, colors, true));
    };
    resize();
    const observer = contained && canvas.parentElement ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas.parentElement!);
    else window.addEventListener("resize", resize);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Frame-rate independent, and no catch-up jump after a background tab.
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += (p.vx + Math.sin(now / 1200 + p.phase) * (effect === "sparkles" ? 0.08 : 0.35)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const gone = effect === "lanterns" ? p.y < -60 : effect === "sparkles" ? false : p.y > h + 30;
        if (gone || p.x < -60 || p.x > w + 60) particles[i] = spawn(effect, w, h, colors, false);
        draw(ctx, effect, particles[i], now, main);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [effect, paletteKey, main, contained]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none ${contained ? "absolute inset-0" : "fixed inset-0 z-[40]"}`}
    />
  );
}

/**
 * A theme's decorative effect, drawn over the page. Ignores clicks, pauses
 * in a background tab, and is skipped entirely for reduced-motion users.
 * `scope="landing"` limits it to the side's landing page.
 */
export default function SiteThemeEffects({
  effect,
  scope,
  audience,
  palette,
  main,
  contained = false,
}: {
  effect: ThemeEffect;
  scope: ThemeEffectScope;
  audience: ThemeAudience;
  palette: string[];
  main: string;
  contained?: boolean;
}) {
  const pathname = usePathname();
  if (effect === "none") return null;
  if (!contained && scope === "landing" && pathname !== `/${audience}`) return null;
  return <EffectCanvas key={effect} effect={effect} palette={palette} main={main} contained={contained} />;
}

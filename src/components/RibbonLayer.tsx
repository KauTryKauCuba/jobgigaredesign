"use client";

import type { Pointer } from "@/hooks/useRibbonAnimation";

export type Pool = {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  opacity: number;
  /** Degrees, aligned to the ribbon's local flow direction at this point. */
  rotate: number;
  /** Drift amplitude in viewBox units — how far the light travels. */
  dx: number;
  dy: number;
  duration: number;
  /** Mouse-parallax travel in px at full pointer deflection. */
  parallax: number;
};

/**
 * One soft pool of light inside the ribbon.
 *
 * Pools are lights, not slices of a shape, so each can safely drift on its
 * own clock — that independence is what stops the ribbon's shading from
 * pulsing in lockstep.
 */
export default function RibbonLayer({
  pool,
  pointer,
  animate,
}: {
  pool: Pool;
  pointer: Pointer;
  animate: boolean;
}) {
  const dx = pointer.x * pool.parallax;
  const dy = pointer.y * pool.parallax * 0.4;

  return (
    <g
      style={{
        transform: `translate3d(${dx}px, ${dy}px, 0)`,
        transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
      }}
    >
      {/*
        Drift lives on this outer group and rotation on the ellipse below, so
        the two never compose into one transform list where drift ends up
        applied inside the pool's own rotated frame.
      */}
      <g>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`0 0; ${pool.dx} ${pool.dy}; 0 0; ${-pool.dx} ${-pool.dy}; 0 0`}
            dur={`${pool.duration}s`}
            calcMode="spline"
            keyTimes="0; 0.25; 0.5; 0.75; 1"
            keySplines="0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1; 0.42 0 0.58 1"
            repeatCount="indefinite"
          />
        )}
        <ellipse
          cx={pool.cx}
          cy={pool.cy}
          rx={pool.rx}
          ry={pool.ry}
          transform={`rotate(${pool.rotate} ${pool.cx} ${pool.cy})`}
          fill={`url(#pool-${pool.id})`}
          opacity={pool.opacity}
        />
      </g>
    </g>
  );
}

import { SIDE_RESIZING_THRESHOLD } from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type { Radians } from "@excalidraw/math";

import type {
  TransformHandles,
  TransformHandleType,
} from "../transformHandles";

/**
 * ActionBoard corner rotation — the dedicated rotation handle (the lollipop
 * above the selection) is removed and rotation instead starts from a ring
 * zone hugging the outside of each corner resize handle, Figma-style.
 *
 * This half of the feature lives in `@excalidraw/element` because the rotation
 * math (`resizeElements.ts`) and the handle geometry (`transformHandles.ts`)
 * hook into it; the pointer/cursor wiring lives in
 * `packages/excalidraw/actionboard/cornerRotation.ts`. Upstream call sites are
 * listed in the divergence log (ACTIONBOARD.md).
 */

/** screen px the rotation ring extends beyond a corner handle's edge — keep
 * it tight so it can't swallow clicks meant for nearby elements */
const CORNER_ROTATION_BAND = 10;

const CORNER_HANDLES = ["nw", "ne", "sw", "se"] as const;

export const abWithoutRotationHandle = <
  T extends { [K in TransformHandleType]?: boolean },
>(
  omitSides: T,
): T => ({ ...omitSides, rotation: true });

/**
 * True when the pointer sits in the rotation ring of one of the corner
 * handles: near a corner handle's center, but outside every handle rect
 * (resizing wins there) and outside the selection area including the
 * side-resizing reach (moving/side-resizing win there).
 *
 * `bounds` is the unrotated bounding box the handles were derived from;
 * `angle` its rotation. Coordinates are scene coordinates.
 */
export const abCornerRotationBandHit = (
  transformHandles: TransformHandles,
  bounds: readonly [number, number, number, number],
  angle: Radians,
  x: number,
  y: number,
  zoomValue: number,
): boolean => {
  for (const key of Object.keys(transformHandles)) {
    const handle = transformHandles[key as TransformHandleType];
    if (
      handle &&
      x >= handle[0] &&
      x <= handle[0] + handle[2] &&
      y >= handle[1] &&
      y <= handle[1] + handle[3]
    ) {
      return false;
    }
  }

  const [x1, y1, x2, y2] = bounds;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const pad = (SIDE_RESIZING_THRESHOLD * 2) / zoomValue;
  const [ux, uy] = pointRotateRads(
    pointFrom(x, y),
    pointFrom(cx, cy),
    -angle as Radians,
  );
  if (ux >= x1 - pad && ux <= x2 + pad && uy >= y1 - pad && uy <= y2 + pad) {
    return false;
  }

  for (const key of CORNER_HANDLES) {
    const handle = transformHandles[key];
    if (!handle) {
      continue;
    }
    const handleCenterX = handle[0] + handle[2] / 2;
    const handleCenterY = handle[1] + handle[3] / 2;
    const reach = handle[2] * 0.75 + CORNER_ROTATION_BAND / zoomValue;
    if ((x - handleCenterX) ** 2 + (y - handleCenterY) ** 2 <= reach ** 2) {
      return true;
    }
  }
  return false;
};

/**
 * A corner-started rotation must be relative — the stock formula in
 * `resizeElements.ts` assumes the grab point is the handle above the shape
 * and would snap the shape's top toward the pointer on the first move. The
 * session captures where the gesture actually started; while one is active,
 * `abAdjustRotationAngle` replaces the absolute angle with
 * base + (pointer angle − start pointer angle).
 *
 * For single elements `baseAngle` is the element's angle at pointer down;
 * for multi-selection it is 0 (the group formula already adds each element's
 * own original angle).
 */
export type CornerRotationSession = {
  baseAngle: number;
  startPointerAngle: number;
};

let session: CornerRotationSession | null = null;

export const abSetCornerRotationSession = (
  next: CornerRotationSession | null,
) => {
  session = next;
};

export const abAdjustRotationAngle = (
  angle: Radians,
  cx: number,
  cy: number,
  pointerX: number,
  pointerY: number,
): Radians => {
  if (!session) {
    return angle;
  }
  return (session.baseAngle +
    Math.atan2(pointerY - cy, pointerX - cx) -
    session.startPointerAngle) as Radians;
};

const ROTATE_CURSOR_PATHS =
  `<path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4"/>` +
  `<path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>`;

export const AB_ROTATE_CURSOR = `url(data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g stroke="#fff" stroke-width="4.5">${ROTATE_CURSOR_PATHS}</g>` +
    `<g stroke="#1b1b1f" stroke-width="1.75">${ROTATE_CURSOR_PATHS}</g>` +
    `</g></svg>`,
)}) 11 11, auto`;

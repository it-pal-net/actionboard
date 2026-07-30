import type { Radians } from "@excalidraw/math";

import {
  AB_ROTATE_CURSOR,
  abAdjustRotationAngle,
  abCornerRotationBandHit,
  abSetCornerRotationSession,
  abWithoutRotationHandle,
} from "../actionboard/cornerRotation";
import { getTransformHandlesFromCoords } from "../transformHandles";

const BOUNDS = [0, 0, 100, 100] as const;
const ZOOM = { value: 1 } as any;
const CORNERS_ONLY = { e: true, s: true, n: true, w: true };

const handlesFor = (angle = 0) =>
  getTransformHandlesFromCoords(
    [...BOUNDS, 50, 50],
    angle as Radians,
    ZOOM,
    "mouse",
    CORNERS_ONLY,
  );

describe("abWithoutRotationHandle", () => {
  it("forces the rotation handle off and keeps other omissions", () => {
    expect(abWithoutRotationHandle({ n: true })).toEqual({
      n: true,
      rotation: true,
    });
  });

  it("removes the rotation handle from getTransformHandlesFromCoords", () => {
    const handles = getTransformHandlesFromCoords(
      [...BOUNDS, 50, 50],
      0 as Radians,
      ZOOM,
      "mouse",
      {},
    );
    expect(handles.rotation).toBeUndefined();
    expect(handles.nw).toBeDefined();
  });
});

describe("abCornerRotationBandHit", () => {
  // nw corner handle: rect [-10,-2]×[-10,-2], center (-6,-6), ring reach 20
  it("hits diagonally outside a corner handle", () => {
    expect(
      abCornerRotationBandHit(handlesFor(), BOUNDS, 0 as Radians, -14, -14, 1),
    ).toBe(true);
  });

  it("leaves the handle rect itself to resizing", () => {
    expect(
      abCornerRotationBandHit(handlesFor(), BOUNDS, 0 as Radians, -6, -6, 1),
    ).toBe(false);
  });

  it("leaves the selection area and side-resize reach alone", () => {
    expect(
      abCornerRotationBandHit(handlesFor(), BOUNDS, 0 as Radians, 50, 50, 1),
    ).toBe(false);
    expect(
      abCornerRotationBandHit(handlesFor(), BOUNDS, 0 as Radians, 50, -6, 1),
    ).toBe(false);
  });

  it("ends beyond the ring", () => {
    expect(
      abCornerRotationBandHit(handlesFor(), BOUNDS, 0 as Radians, -40, -40, 1),
    ).toBe(false);
  });

  it("claims the dead zone just beyond the side-resize reach", () => {
    expect(
      abCornerRotationBandHit(handlesFor(), BOUNDS, 0 as Radians, -16, 4, 1),
    ).toBe(true);
  });

  it("follows the element's rotation", () => {
    // a non-square box — a square maps its corners onto each other at 90°
    const bounds = [0, 0, 100, 40] as const;
    const angle = (Math.PI / 2) as Radians;
    const handles = getTransformHandlesFromCoords(
      [...bounds, 50, 20],
      angle,
      ZOOM,
      "mouse",
      CORNERS_ONLY,
    );
    // at 90° the nw handle center (-6, -6) lands at (76, -36)
    expect(abCornerRotationBandHit(handles, bounds, angle, 84, -44, 1)).toBe(
      true,
    );
    expect(abCornerRotationBandHit(handles, bounds, angle, -14, -14, 1)).toBe(
      false,
    );
  });
});

describe("abAdjustRotationAngle", () => {
  it("passes the stock angle through without a session", () => {
    abSetCornerRotationSession(null);
    expect(abAdjustRotationAngle(1.23 as Radians, 0, 0, 10, 10)).toBe(1.23);
  });

  it("rotates relative to where the gesture started", () => {
    abSetCornerRotationSession({
      baseAngle: 0.5,
      startPointerAngle: Math.atan2(10, 10),
    });
    const adjusted = abAdjustRotationAngle(999 as Radians, 0, 0, 0, 10);
    expect(adjusted).toBeCloseTo(0.5 + Math.PI / 2 - Math.PI / 4);
    abSetCornerRotationSession(null);
  });
});

describe("AB_ROTATE_CURSOR", () => {
  it("is a self-contained svg cursor with a fallback", () => {
    expect(AB_ROTATE_CURSOR).toMatch(/^url\(data:image\/svg\+xml,/);
    expect(AB_ROTATE_CURSOR).toMatch(/, auto$/);
  });
});

import type { Radians } from "@excalidraw/math";

import {
  AB_DOT_EDGE_OFFSET,
  abDotsVisibleForBounds,
  abGetConnectorDots,
  abHitConnectorDots,
} from "../actionboard/connectorDots";

const BOUNDS = [0, 0, 100, 60, 50, 30] as const;

const dotBySide = (dots: ReturnType<typeof abGetConnectorDots>, side: string) =>
  dots.find((dot) => dot.side === side)!;

describe("abGetConnectorDots", () => {
  it("places dots just outside the side midpoints, anchors on the edge", () => {
    const dots = abGetConnectorDots(BOUNDS, 0 as Radians, 1);
    expect(dots).toHaveLength(4);
    expect(dotBySide(dots, "n")).toEqual({
      side: "n",
      cx: 50,
      cy: -AB_DOT_EDGE_OFFSET,
      anchorX: 50,
      anchorY: 0,
    });
    expect(dotBySide(dots, "e")).toEqual({
      side: "e",
      cx: 100 + AB_DOT_EDGE_OFFSET,
      cy: 30,
      anchorX: 100,
      anchorY: 30,
    });
    expect(dotBySide(dots, "s").cy).toBe(60 + AB_DOT_EDGE_OFFSET);
    expect(dotBySide(dots, "w").cx).toBe(-AB_DOT_EDGE_OFFSET);
  });

  it("keeps a constant screen-size gap across zoom", () => {
    const dots = abGetConnectorDots(BOUNDS, 0 as Radians, 2);
    expect(dotBySide(dots, "n").cy).toBe(-AB_DOT_EDGE_OFFSET / 2);
  });

  it("rotates with the element", () => {
    const dots = abGetConnectorDots(BOUNDS, (Math.PI / 2) as Radians, 1);
    const north = dotBySide(dots, "n");
    // (50, -4) rotated 90° around (50, 30) → (84, 30)
    expect(north.cx).toBeCloseTo(50 + 30 + AB_DOT_EDGE_OFFSET);
    expect(north.cy).toBeCloseTo(30);
    expect(north.anchorX).toBeCloseTo(80);
    expect(north.anchorY).toBeCloseTo(30);
  });
});

describe("abHitConnectorDots", () => {
  it("hits within the screen-size radius, misses elsewhere", () => {
    const dots = abGetConnectorDots(BOUNDS, 0 as Radians, 1);
    expect(abHitConnectorDots(dots, 100 + AB_DOT_EDGE_OFFSET, 34, 1)?.side).toBe(
      "e",
    );
    expect(abHitConnectorDots(dots, 50, 30, 1)).toBeNull();
    expect(abHitConnectorDots(dots, 100 + AB_DOT_EDGE_OFFSET, 60, 1)).toBeNull();
  });

  it("scales the hit radius with zoom", () => {
    const dots = abGetConnectorDots(BOUNDS, 0 as Radians, 2);
    const ex = 100 + AB_DOT_EDGE_OFFSET / 2;
    expect(abHitConnectorDots(dots, ex, 35, 2)?.side).toBe("e");
    expect(abHitConnectorDots(dots, ex, 36.5, 2)).toBeNull();
  });
});

describe("abDotsVisibleForBounds", () => {
  it("hides dots on elements too small on screen", () => {
    expect(abDotsVisibleForBounds([0, 0, 10, 10, 5, 5], 1)).toBe(false);
    expect(abDotsVisibleForBounds([0, 0, 10, 10, 5, 5], 3)).toBe(true);
    expect(abDotsVisibleForBounds(BOUNDS, 1)).toBe(true);
  });
});

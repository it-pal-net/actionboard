import React from "react";
import { reseed } from "@excalidraw/common";

import type { ExcalidrawArrowElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { AB_DOT_EDGE_OFFSET } from "../actionboard/connectorDots";

import { UI, Pointer } from "./helpers/ui";
import { render, unmountComponent } from "./test-utils";

unmountComponent();

const { h } = window;
const mouse = new Pointer("mouse");

const drawRect = () => {
  UI.clickTool("rectangle");
  mouse.reset();
  mouse.downAt(100, 100);
  mouse.moveTo(200, 200);
  mouse.up();
  return h.elements[h.elements.length - 1];
};

beforeEach(async () => {
  localStorage.clear();
  reseed(7);
  mouse.reset();
  await render(<Excalidraw />);
});

describe("connector dot arrows", () => {
  it("start out bound to the dot's element and follow it when it moves", () => {
    const rect = drawRect();

    // the rect stays selected, so its dots are live — press the east dot
    // (edge midpoint + offset) and drag out an arrow
    mouse.reset();
    mouse.downAt(200 + AB_DOT_EDGE_OFFSET, 150);
    mouse.moveTo(320, 150);
    mouse.up();

    const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
    expect(arrow.type).toBe("arrow");
    expect(arrow.startBinding?.elementId).toBe(rect.id);
    expect(h.elements[0].boundElements).toEqual([
      { id: arrow.id, type: "arrow" },
    ]);

    // drag the rect away — the bound start must travel with it
    UI.clickTool("selection");
    mouse.reset();
    // default rects are transparent — grab the stroke, not the interior
    mouse.downAt(150, 100);
    mouse.moveTo(150, 210);
    mouse.up();

    const movedRect = h.elements[0];
    expect(movedRect.y).toBeGreaterThan(180);
    expect(arrow.startBinding?.elementId).toBe(rect.id);
    // start point sits on/near the rect's outline, not back at the old spot
    expect(arrow.y).toBeGreaterThan(movedRect.y - 10);
    expect(arrow.y).toBeLessThan(movedRect.y + movedRect.height + 10);
    expect(arrow.x).toBeGreaterThan(movedRect.x - 10);
    expect(arrow.x).toBeLessThan(movedRect.x + movedRect.width + 30);
  });

  it("bind both ends when dropped onto another element", () => {
    const rect = drawRect();

    UI.clickTool("rectangle");
    mouse.reset();
    mouse.downAt(400, 100);
    mouse.moveTo(500, 200);
    mouse.up();
    const rect2 = h.elements[h.elements.length - 1];

    // rect2 is selected now, so rect's dots need a hover to appear: cross its
    // stroke, glide to the east dot, then press
    mouse.reset();
    mouse.moveTo(200, 150);
    mouse.moveTo(200 + AB_DOT_EDGE_OFFSET, 150);
    mouse.downAt(200 + AB_DOT_EDGE_OFFSET, 150);
    mouse.moveTo(450, 150);
    mouse.up();

    const arrow = h.elements[h.elements.length - 1] as ExcalidrawArrowElement;
    expect(arrow.type).toBe("arrow");
    expect(arrow.startBinding?.elementId).toBe(rect.id);
    expect(arrow.endBinding?.elementId).toBe(rect2.id);
  });
});

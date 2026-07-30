import {
  CURSOR_TYPE,
  SIDE_RESIZING_THRESHOLD,
  updateActiveTool,
  updateStable,
} from "@excalidraw/common";
import {
  bindOrUnbindBindingElement,
  getElementAbsoluteCoords,
  isBindableElement,
  isBindingElement,
  isBindingEnabled,
  isFrameLikeElement,
} from "@excalidraw/element";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { LocalPoint, Radians } from "@excalidraw/math";

import type { InteractiveCanvasRenderConfig } from "../scene/types";
import type {
  AppState,
  InteractiveCanvasAppState,
  PointerDownState,
} from "../types";

/**
 * ActionBoard connector dots — Miro-style anchors on the N/E/S/W side
 * midpoints of bindable elements. Hovering an element (or keeping one
 * selected) reveals the dots; pressing one hands the gesture to the stock
 * arrow tool, so the arrow starts bound to the source element and binds to
 * whatever element it is dragged (or clicked) onto, with all of upstream's
 * binding UX intact.
 *
 * Hover state rides in `appState.hoveredElementIds` — outside the
 * element-link-selector dialog nothing else reads it, and both canvases
 * already repaint when it changes. Upstream call sites hooking into this
 * module are listed in the divergence log (ACTIONBOARD.md).
 */

// the App instance — typed loosely on purpose: the hooks need a couple of
// its private members (handleCanvasPointerDown, getElementAtPosition)
type AppHandle = any;

export const AB_CONNECTOR_DOT_SIDES = ["n", "e", "s", "w"] as const;
export type ConnectorDotSide = typeof AB_CONNECTOR_DOT_SIDES[number];

export type ConnectorDot = {
  side: ConnectorDotSide;
  /** dot center, scene coords (rotated with the element) */
  cx: number;
  cy: number;
  /** arrow start anchor on the bounding-box edge, scene coords */
  anchorX: number;
  anchorY: number;
};

/** screen px */
export const AB_DOT_RADIUS = 6;
export const AB_DOT_HOVER_RADIUS = 10;
export const AB_DOT_HIT_RADIUS = 12;
/** gap between the bounding box and a dot's center — the dots float clear of
 * the selection frame so the border itself stays grabbable for resizing */
export const AB_DOT_EDGE_OFFSET = 16;
/** the border and its side-resizing reach always win over the dots */
export const AB_DOT_RESIZE_CLEARANCE = SIDE_RESIZING_THRESHOLD * 2;
/** hide dots when the element is smaller than this on screen */
export const AB_DOTS_MIN_SIZE = 24;

type Bounds6 = readonly [number, number, number, number, number, number];

export const abGetConnectorDots = (
  [x1, y1, x2, y2, cx, cy]: Bounds6,
  angle: Radians,
  zoomValue: number,
): ConnectorDot[] => {
  const offset = AB_DOT_EDGE_OFFSET / zoomValue;
  const flat: [ConnectorDotSide, number, number, number, number][] = [
    ["n", cx, y1 - offset, cx, y1],
    ["e", x2 + offset, cy, x2, cy],
    ["s", cx, y2 + offset, cx, y2],
    ["w", x1 - offset, cy, x1, cy],
  ];
  return flat.map(([side, dx, dy, ax, ay]) => {
    const [rdx, rdy] = pointRotateRads(
      pointFrom(dx, dy),
      pointFrom(cx, cy),
      angle,
    );
    const [rax, ray] = pointRotateRads(
      pointFrom(ax, ay),
      pointFrom(cx, cy),
      angle,
    );
    return { side, cx: rdx, cy: rdy, anchorX: rax, anchorY: ray };
  });
};

export const abHitConnectorDots = (
  dots: readonly ConnectorDot[],
  x: number,
  y: number,
  zoomValue: number,
): ConnectorDot | null => {
  const r = AB_DOT_HIT_RADIUS / zoomValue;
  return (
    dots.find((dot) => (x - dot.cx) ** 2 + (y - dot.cy) ** 2 <= r ** 2) ?? null
  );
};

export const abCanHostConnectorDots = (
  element: ExcalidrawElement | null | undefined,
): element is NonDeletedExcalidrawElement =>
  isBindableElement(element, false) && !isFrameLikeElement(element);

export const abDotsVisibleForBounds = (
  [x1, y1, x2, y2]: Bounds6,
  zoomValue: number,
): boolean =>
  Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * zoomValue >=
  AB_DOTS_MIN_SIZE;

const hitElementConnectorDot = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  x: number,
  y: number,
  zoomValue: number,
): ConnectorDot | null => {
  const bounds = getElementAbsoluteCoords(element, elementsMap, true);
  if (!abDotsVisibleForBounds(bounds, zoomValue)) {
    return null;
  }
  // a press inside the shape selects/drags it, and a press on the border or
  // within the side-resizing reach resizes it — a dot only owns the part of
  // its disc beyond that clearance
  const clearance = AB_DOT_RESIZE_CLEARANCE / zoomValue;
  const [x1, y1, x2, y2, cx, cy] = bounds;
  const [ux, uy] = pointRotateRads(
    pointFrom(x, y),
    pointFrom(cx, cy),
    -element.angle as Radians,
  );
  if (
    ux >= x1 - clearance &&
    ux <= x2 + clearance &&
    uy >= y1 - clearance &&
    uy <= y2 + clearance
  ) {
    return null;
  }
  return abHitConnectorDots(
    abGetConnectorDots(bounds, element.angle, zoomValue),
    x,
    y,
    zoomValue,
  );
};

/** hover persistence: the pointer traveling from an element to its dots
 * (just outside the bounds) must not drop the hover on the way */
const pointerNearElement = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  x: number,
  y: number,
  zoomValue: number,
): boolean => {
  const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap,
    true,
  );
  const reach = (AB_DOT_EDGE_OFFSET + AB_DOT_HIT_RADIUS) / zoomValue;
  const [ux, uy] = pointRotateRads(
    pointFrom(x, y),
    pointFrom(cx, cy),
    -element.angle as Radians,
  );
  return (
    ux >= x1 - reach && ux <= x2 + reach && uy >= y1 - reach && uy <= y2 + reach
  );
};

type DotsUiState = Pick<
  InteractiveCanvasAppState,
  | "activeTool"
  | "viewModeEnabled"
  | "openDialog"
  | "editingTextElement"
  | "croppingElementId"
  | "newElement"
  | "multiElement"
  | "selectionElement"
  | "isRotating"
  | "selectedLinearElement"
>;

const dotsUiActive = (appState: DotsUiState): boolean =>
  appState.activeTool.type === "selection" &&
  !appState.viewModeEnabled &&
  !appState.openDialog &&
  !appState.editingTextElement &&
  !appState.croppingElementId &&
  !appState.newElement &&
  !appState.multiElement &&
  !appState.selectionElement &&
  !appState.isRotating &&
  !appState.selectedLinearElement?.isEditing;

const NO_HOVER: AppState["hoveredElementIds"] = {};

/** StaticCanvas hook: the static scene reads hoveredElementIds only inside
 * the element-link selector — dot hover must not repaint it */
export const abStaticHoveredElementIds = (appState: {
  openDialog: AppState["openDialog"];
  hoveredElementIds: AppState["hoveredElementIds"];
}): AppState["hoveredElementIds"] =>
  appState.openDialog?.name === "elementLinkSelector"
    ? appState.hoveredElementIds
    : NO_HOVER;

type HoveredDot = { elementId: string; side: ConnectorDotSide };

let hoveredHostId: ExcalidrawElement["id"] | null = null;
let hoveredDot: HoveredDot | null = null;

const setHover = (
  app: AppHandle,
  hostId: ExcalidrawElement["id"] | null,
  dot: HoveredDot | null,
) => {
  const dotChanged =
    hoveredDot?.elementId !== dot?.elementId || hoveredDot?.side !== dot?.side;
  hoveredDot = dot;
  hoveredHostId = hostId;
  const prev: AppState["hoveredElementIds"] = app.state.hoveredElementIds;
  const next: { [id: string]: true } = hostId ? { [hostId]: true } : {};
  // a fresh object identity forces the canvases to repaint even when only
  // the hovered dot (module state) changed
  if (dotChanged || updateStable(prev, next) !== prev) {
    app.setState({ hoveredElementIds: next });
  }
};

const clearHover = (app: AppHandle) => {
  hoveredDot = null;
  hoveredHostId = null;
  // never fight the other writer of hoveredElementIds (elementLinkSelector)
  if (
    !app.state.openDialog &&
    Object.keys(app.state.hoveredElementIds).length
  ) {
    app.setState({ hoveredElementIds: {} });
  }
};

const dotHostCandidates = (app: AppHandle): NonDeletedExcalidrawElement[] => {
  const candidates: NonDeletedExcalidrawElement[] = [];
  const selected = app.scene.getSelectedElements(app.state);
  if (selected.length === 1 && abCanHostConnectorDots(selected[0])) {
    candidates.push(selected[0]);
  }
  if (hoveredHostId && hoveredHostId !== candidates[0]?.id) {
    const hovered = app.scene.getNonDeletedElementsMap().get(hoveredHostId);
    if (abCanHostConnectorDots(hovered)) {
      candidates.push(hovered);
    }
  }
  return candidates;
};

/**
 * Pointer-move hook: tracks which element's dots are visible and whether a
 * dot is hovered. Returns true when the pointer is on a dot (cursor set,
 * upstream resize-cursor logic must be skipped).
 */
export const abConnectorDotHover = (
  app: AppHandle,
  event: React.PointerEvent<HTMLElement>,
  scenePointerX: number,
  scenePointerY: number,
): boolean => {
  if (!dotsUiActive(app.state)) {
    clearHover(app);
    return false;
  }
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const zoomValue = app.state.zoom.value;

  const hitElement = app.getElementAtPosition(scenePointerX, scenePointerY);
  let nextHost: NonDeletedExcalidrawElement | null = abCanHostConnectorDots(
    hitElement,
  )
    ? hitElement
    : null;
  if (!nextHost && hoveredHostId) {
    const previous = elementsMap.get(hoveredHostId);
    if (
      abCanHostConnectorDots(previous) &&
      pointerNearElement(
        previous,
        elementsMap,
        scenePointerX,
        scenePointerY,
        zoomValue,
      )
    ) {
      nextHost = previous;
    }
  }

  let dot: ConnectorDot | null = null;
  let dotHost: NonDeletedExcalidrawElement | null = null;
  const selected = app.scene.getSelectedElements(app.state);
  const candidates: NonDeletedExcalidrawElement[] = [];
  if (selected.length === 1 && abCanHostConnectorDots(selected[0])) {
    candidates.push(selected[0]);
  }
  if (nextHost && nextHost.id !== candidates[0]?.id) {
    candidates.push(nextHost);
  }
  for (const candidate of candidates) {
    const candidateDot = hitElementConnectorDot(
      candidate,
      elementsMap,
      scenePointerX,
      scenePointerY,
      zoomValue,
    );
    if (candidateDot) {
      dot = candidateDot;
      dotHost = candidate;
      break;
    }
  }

  setHover(
    app,
    nextHost?.id ?? null,
    dot && dotHost ? { elementId: dotHost.id, side: dot.side } : null,
  );
  if (dot) {
    app.cursor.set(CURSOR_TYPE.POINTER);
    return true;
  }
  return false;
};

const ensureStartBinding = (
  app: AppHandle,
  event: React.PointerEvent<HTMLElement>,
  source: NonDeletedExcalidrawElement,
  dot: ConnectorDot,
) => {
  const arrow = app.state.newElement;
  if (
    !arrow ||
    !isBindingElement(arrow) ||
    !isBindingEnabled(app.state) ||
    arrow.startBinding?.elementId === source.id
  ) {
    return;
  }
  bindOrUnbindBindingElement(
    arrow,
    new Map([[0, { point: pointFrom<LocalPoint>(0, 0), isDragging: false }]]),
    dot.anchorX,
    dot.anchorY,
    app.scene,
    app.state,
    {
      newArrow: true,
      initialBinding: true,
      altKey: event.altKey,
      angleLocked: event.shiftKey,
    },
  );
};

/**
 * Pointer-down hook (top of `handleSelectionOnPointerDown`): a press on a
 * connector dot switches to the arrow tool and re-dispatches the pointer
 * event (the same pattern the eraser pointer button uses), so the stock
 * arrow flow runs — then makes sure the arrow's start is bound to the dot's
 * element. Returns true when the press was consumed.
 */
export const abConnectorDotPointerDown = (
  app: AppHandle,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): boolean => {
  if (!dotsUiActive(app.state)) {
    return false;
  }
  // parity with `allowOnPointerDown`: pen-mode touch input never draws
  if (app.state.penMode && event.pointerType === "touch") {
    return false;
  }
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const zoomValue = app.state.zoom.value;
  let source: NonDeletedExcalidrawElement | null = null;
  let dot: ConnectorDot | null = null;
  for (const candidate of dotHostCandidates(app)) {
    const candidateDot = hitElementConnectorDot(
      candidate,
      elementsMap,
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      zoomValue,
    );
    if (candidateDot) {
      source = candidate;
      dot = candidateDot;
      break;
    }
  }
  clearHover(app);
  if (!source || !dot) {
    return false;
  }

  const sourceElement = source;
  const sourceDot = dot;
  app.setState(
    {
      activeTool: updateActiveTool(app.state, { type: "arrow" }),
    },
    () => {
      app.handleCanvasPointerDown(event);
      ensureStartBinding(app, event, sourceElement, sourceDot);
    },
  );
  return true;
};

/** Interactive-scene hook: paints the dots for the hovered / single selected
 * element, above the transform handles. */
export const abRenderConnectorDots = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  elementsMap: ElementsMap,
  renderConfig: InteractiveCanvasRenderConfig,
) => {
  if (!dotsUiActive(appState)) {
    return;
  }
  const zoomValue = appState.zoom.value;
  const hosts: NonDeletedExcalidrawElement[] = [];
  const selectedIds = Object.keys(appState.selectedElementIds);
  if (selectedIds.length === 1) {
    const selected = elementsMap.get(selectedIds[0]);
    if (abCanHostConnectorDots(selected)) {
      hosts.push(selected);
    }
  }
  for (const id of Object.keys(appState.hoveredElementIds)) {
    const hovered = elementsMap.get(id);
    if (abCanHostConnectorDots(hovered) && hovered.id !== hosts[0]?.id) {
      hosts.push(hovered);
    }
  }
  if (!hosts.length) {
    return;
  }

  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  const color = renderConfig.selectionColor || "#6965db";

  for (const host of hosts) {
    const bounds = getElementAbsoluteCoords(host, elementsMap, true);
    if (!abDotsVisibleForBounds(bounds, zoomValue)) {
      continue;
    }
    for (const dot of abGetConnectorDots(bounds, host.angle, zoomValue)) {
      const isHovered =
        hoveredDot?.elementId === host.id && hoveredDot?.side === dot.side;
      const radius =
        (isHovered ? AB_DOT_HOVER_RADIUS : AB_DOT_RADIUS) / zoomValue;
      context.beginPath();
      context.arc(dot.cx, dot.cy, radius, 0, Math.PI * 2);
      context.fillStyle = isHovered ? color : "#fff";
      context.fill();
      context.lineWidth = 1 / zoomValue;
      context.strokeStyle = color;
      context.stroke();
      if (isHovered) {
        const arm = radius * 0.5;
        context.beginPath();
        context.moveTo(dot.cx - arm, dot.cy);
        context.lineTo(dot.cx + arm, dot.cy);
        context.moveTo(dot.cx, dot.cy - arm);
        context.lineTo(dot.cx, dot.cy + arm);
        context.strokeStyle = "#fff";
        context.lineWidth = 2 / zoomValue;
        context.stroke();
      }
    }
  }
  context.restore();
};

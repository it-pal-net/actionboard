import { abDotsVisibleForBounds } from "./connectorDots"; // actionboard sibling
import {
  AB_ROTATE_CURSOR,
  abCornerRotationBandHit,
  abSetCornerRotationSession,
  getCommonBounds,
  getElementAbsoluteCoords,
  getOmitSidesForEditorInterface,
  getTransformHandles,
  getTransformHandlesFromCoords,
  isElbowArrow,
  isFrameLikeElement,
  isLinearElement,
} from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  PointerType,
} from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math";

import type { CornerRotationSession } from "@excalidraw/element";
import type { PointerDownState } from "../types";

/**
 * ActionBoard corner rotation, App-side wiring: hit-tests the rotation ring
 * around the corner handles (single selection and multi-selection), shows the
 * rotate cursor on hover, and arms `pointerDownState.resize.handleType =
 * "rotation"` on pointer down — from there upstream's stock rotation gesture
 * takes over, with the relative-angle session (see
 * `@excalidraw/element` `actionboard/cornerRotation.ts`) preventing the jump
 * a corner-started absolute rotation would cause.
 *
 * Upstream call sites hooking into this module are listed in the divergence
 * log (ACTIONBOARD.md).
 */

// the App instance — typed loosely on purpose (private member access)
type AppHandle = any;

type CornerRotationHit = {
  element: NonDeletedExcalidrawElement | null;
  session: CornerRotationSession;
};

const testCornerRotation = (
  app: AppHandle,
  x: number,
  y: number,
  pointerType: PointerType,
): CornerRotationHit | null => {
  const state = app.state;
  if (
    // NB deliberately no editingTextElement gate: the pointer down that
    // submits a text editor may itself start a gesture, like upstream's
    // transform-handle detection
    state.activeTool.type !== "selection" ||
    state.viewModeEnabled ||
    state.openDialog ||
    state.croppingElementId
  ) {
    return null;
  }
  const selectedElements: NonDeletedExcalidrawElement[] =
    app.scene.getSelectedElements(state);
  const elementsMap = app.scene.getNonDeletedElementsMap();
  const zoomValue = state.zoom.value;
  const omitSides = getOmitSidesForEditorInterface(app.editorInterface);

  if (selectedElements.length === 1) {
    const element = selectedElements[0];
    if (
      // parity with the single-selection transform-handle gates in App
      state.selectedLinearElement?.isEditing ||
      (state.selectedLinearElement &&
        state.selectedLinearElement.hoverPointIndex !== -1) ||
      element.locked ||
      isElbowArrow(element) ||
      isFrameLikeElement(element) ||
      (isLinearElement(element) &&
        (app.editorInterface.userAgent.isMobileDevice ||
          element.points.length === 2))
    ) {
      return null;
    }
    const handles = getTransformHandles(
      element,
      state.zoom,
      elementsMap,
      pointerType,
      omitSides,
    );
    const handleBounds = getElementAbsoluteCoords(element, elementsMap, true);
    const [hx1, hy1, hx2, hy2] = handleBounds;
    if (
      // like the dots, the ring needs on-screen room — tiny elements rotate
      // after zooming in, and their surroundings stay clickable
      !abDotsVisibleForBounds(handleBounds, zoomValue) ||
      !abCornerRotationBandHit(
        handles,
        [hx1, hy1, hx2, hy2],
        element.angle,
        x,
        y,
        zoomValue,
      )
    ) {
      return null;
    }
    // the rotation formula pivots on the bounds without bound text — the
    // start angle must use the same center or the delta drifts
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    return {
      element,
      session: {
        baseAngle: element.angle,
        startPointerAngle: Math.atan2(y - (y1 + y2) / 2, x - (x1 + x2) / 2),
      },
    };
  }

  if (selectedElements.length > 1) {
    if (
      selectedElements.some(
        (element) => element.locked || isFrameLikeElement(element),
      )
    ) {
      return null;
    }
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
    if (
      !abDotsVisibleForBounds(
        [x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2],
        zoomValue,
      )
    ) {
      return null;
    }
    const handles = getTransformHandlesFromCoords(
      [x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2],
      0 as Radians,
      state.zoom,
      pointerType,
      omitSides,
    );
    if (
      !abCornerRotationBandHit(
        handles,
        [x1, y1, x2, y2],
        0 as Radians,
        x,
        y,
        zoomValue,
      )
    ) {
      return null;
    }
    return {
      element: null,
      session: {
        baseAngle: 0,
        startPointerAngle: Math.atan2(y - (y1 + y2) / 2, x - (x1 + x2) / 2),
      },
    };
  }
  return null;
};

/**
 * Pointer-move hook: rotate cursor while hovering a corner's rotation ring.
 * Returns true when the cursor was claimed.
 */
export const abCornerRotationHover = (
  app: AppHandle,
  event: React.PointerEvent<HTMLElement>,
  scenePointerX: number,
  scenePointerY: number,
): boolean => {
  if (
    !testCornerRotation(
      app,
      scenePointerX,
      scenePointerY,
      (event.pointerType || "mouse") as PointerType,
    )
  ) {
    return false;
  }
  app.cursor.set(AB_ROTATE_CURSOR);
  return true;
};

/**
 * Pointer-down hook (`handleSelectionOnPointerDown`, right before the
 * `resize.handleType` branch): arms the stock rotation gesture when the
 * press landed in a corner's rotation ring. The ring is disjoint from every
 * handle rect and from the side-resizing reach, so a real handle hit always
 * arrives here with `handleType` already set and wins.
 */
export const abMaybeStartCornerRotation = (
  app: AppHandle,
  event: React.PointerEvent<HTMLElement>,
  pointerDownState: PointerDownState,
): void => {
  if (pointerDownState.resize.handleType) {
    abSetCornerRotationSession(null);
    return;
  }
  const hit = testCornerRotation(
    app,
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    (event.pointerType || "mouse") as PointerType,
  );
  abSetCornerRotationSession(hit ? hit.session : null);
  if (!hit) {
    return;
  }
  pointerDownState.resize.handleType = "rotation";
  if (hit.element) {
    app.setState({ resizingElement: hit.element });
  }
};

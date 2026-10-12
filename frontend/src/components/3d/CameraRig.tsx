'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ComponentRef } from 'react';
import { Vector3 } from 'three';

/**
 * Camera presets exposed by the product viewer (`جلو` / `پشت` / `بالا`).
 *
 * The viewer is deliberately isolated behind this small interface: an AR launch
 * (WebXR / <model-viewer>) can reuse `preset` + `radius` without touching the
 * canvas, so no viewer internals leak into the page.
 */
export type ViewerPreset = 'front' | 'back' | 'top';

export type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

interface CameraRigProps {
  preset: ViewerPreset;
  /** Model radius from {@link ModelBounds}; drives the framing distance. */
  radius: number;
  controlsRef: RefObject<OrbitControlsRef | null>;
}

/**
 * Every camera distance the viewer needs, derived from one measured radius.
 *
 * This exists because the assets arrive in whatever units their author chose:
 * the ducks and cars in this catalogue measure between ~0.14 and ~3.1 units of
 * radius, while the `9 mm` pistol is authored at ~1045 units. The viewer used to
 * inherit react-three-fiber's default camera, which is
 * `PerspectiveCamera(75, 0, 0.1, 1000)` — a far plane of exactly `1000`. Framing
 * the pistol needs the camera ~3240 units out and leaves the model itself
 * 2195…4285 units away, i.e. entirely beyond that far plane, so the canvas
 * rendered nothing: no console error, a 200 for the `.glb`, and an empty box.
 *
 * Deriving the clip range from the same radius that drives the framing keeps the
 * whole model inside the frustum for any asset scale, and tightens the depth
 * range for the small models instead of leaving them in a 0.1–1000 window. The
 * bounds also cover the zoom range `OrbitControls` allows, so neither extreme of
 * the zoom clips.
 */
export interface ViewerFraming {
  /** Preset camera distance from the model centre. */
  distance: number;
  /** OrbitControls zoom bounds — also what the clip range has to contain. */
  minDistance: number;
  maxDistance: number;
  near: number;
  far: number;
}

export function viewerFraming(radius: number): ViewerFraming {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;

  const distance = Math.max(safeRadius, 0.25) * 3.1;
  const minDistance = Math.max(safeRadius * 1.3, 0.4);
  const maxDistance = Math.max(safeRadius * 9, 6);

  return {
    distance,
    minDistance,
    maxDistance,
    // Closest surface the user can zoom to, with margin; never zero (a near
    // plane of 0 is a singular projection matrix) and never closer than the
    // radius allows.
    near: Math.max(minDistance - safeRadius * 1.2, safeRadius * 0.01, 0.001),
    // Farthest surface at maximum zoom, plus the model's own far side.
    far: maxDistance + safeRadius * 2,
  };
}

/**
 * Drives smooth camera transitions between the quick-view presets.
 *
 * Only *during* a transition does this component touch the camera; once the
 * goal is reached it hands control back to OrbitControls, so a user drag is
 * never fought by a leftover animation. `useFrame` keeps calling
 * `controls.update()` because damping needs it.
 */
export default function CameraRig({
  preset,
  radius,
  controlsRef,
}: CameraRigProps) {
  const { camera } = useThree();

  const framing = useMemo(() => viewerFraming(radius), [radius]);

  const goalPosition = useMemo(() => new Vector3(0, 0, 5), []);
  const goalTarget = useMemo(() => new Vector3(0, 0, 0), []);
  const transitioning = useRef(false);

  // The clip range itself is not set here on purpose. `viewerFraming` is handed
  // to the viewer's `<PerspectiveCamera near far>`, which react-three-fiber
  // updates in place on the same camera object — assigning `camera.near` from an
  // effect would mutate a value owned by another component's hook, and the
  // camera element already refreshes the projection matrix every commit.
  useEffect(() => {
    // ~3.1× the radius frames a sphere comfortably at the viewer's 40° fov.
    if (preset === 'back') {
      goalPosition.set(0, 0, -framing.distance);
    } else if (preset === 'top') {
      goalPosition.set(0, framing.distance * 0.98, 0.001);
    } else {
      goalPosition.set(0, 0, framing.distance);
    }

    goalTarget.set(0, 0, 0);
    transitioning.current = true;
  }, [preset, framing, goalPosition, goalTarget]);

  useFrame(() => {
    const controls = controlsRef.current;

    if (controls) {
      // Damping requires an explicit update every frame.
      controls.update();
    }

    if (!transitioning.current) return;

    camera.position.lerp(goalPosition, 0.14);

    if (controls) {
      controls.target.lerp(goalTarget, 0.14);
    }

    if (camera.position.distanceTo(goalPosition) < 0.01) {
      transitioning.current = false;
    }
  });

  return null;
}

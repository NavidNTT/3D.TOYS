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

  const goalPosition = useMemo(() => new Vector3(0, 0, 5), []);
  const goalTarget = useMemo(() => new Vector3(0, 0, 0), []);
  const transitioning = useRef(false);

  useEffect(() => {
    // ~3.1× the radius frames a sphere comfortably at the viewer's 40° fov.
    const distance = Math.max(radius, 0.25) * 3.1;

    if (preset === 'back') {
      goalPosition.set(0, 0, -distance);
    } else if (preset === 'top') {
      goalPosition.set(0, distance * 0.98, 0.001);
    } else {
      goalPosition.set(0, 0, distance);
    }

    goalTarget.set(0, 0, 0);
    transitioning.current = true;
  }, [preset, radius, goalPosition, goalTarget]);

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

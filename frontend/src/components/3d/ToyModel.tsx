'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { Center, useGLTF } from '@react-three/drei';

/**
 * Local DRACOLoader path.
 *
 * `public/draco/` holds the official Draco decoders shipped with `three`. drei
 * defaults to Google's CDN, which we do not want: a blocked CDN would break
 * every Draco-compressed model. Serving from our own origin also avoids CORS.
 */
export const DRACO_PATH = '/draco/';

/**
 * `false` attaches no DRACOLoader at all — the recovery step when a model
 * cannot be decoded, and the correct setting for plain, uncompressed `.glb`.
 */
export type DracoDecoderPath = string | false;

useGLTF.setDecoderPath(DRACO_PATH);

export interface ModelBounds {
  /** Half of the largest bounding-box dimension, in model units. */
  radius: number;
}

interface ToyModelProps {
  modelUrl: string;
  dracoDecoderPath?: DracoDecoderPath;
  /** Reports the model's size so the camera can frame it. */
  onReady?: (bounds: ModelBounds) => void;
}

/**
 * Loads a .glb/.gltf and centers it.
 *
 * `Center` normalizes the origin so models with arbitrary offsets still sit
 * correctly in frame. The bounding box is measured after mounting and reported
 * through `onReady`, which is what lets the quick-view buttons and the initial
 * camera framing adapt to models of very different scale (a 1 cm bolt vs a
 * 1 m toy car) instead of assuming a fixed distance.
 */
export default function ToyModel({
  modelUrl,
  dracoDecoderPath = DRACO_PATH,
  onReady,
}: ToyModelProps) {
  const { scene } = useGLTF(
    modelUrl,
    dracoDecoderPath === false ? false : DRACO_PATH,
  );

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const radius = Math.max(size.x, size.y, size.z) / 2;

    onReady?.({ radius: Number.isFinite(radius) && radius > 0 ? radius : 1 });
  }, [scene, onReady]);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

/**
 * Warm the loader cache without rendering the model (hover / listing previews).
 * Uses the same decoder configuration as {@link ToyModel}, otherwise r3f — which
 * keys assets by `[loader, url]` — would cache a second, differently-decoded
 * entry for the same file.
 */
export function preloadToyModel(modelUrl: string): void {
  useGLTF.preload(modelUrl, DRACO_PATH);
}

/**
 * Forget the cached (possibly rejected) load for a URL.
 *
 * r3f keys assets by `[loader, url]` only, so a failed Draco decode stays cached
 * and re-throws instantly; a retry must clear the entry first.
 */
export function clearToyModelCache(modelUrl: string): void {
  useGLTF.clear(modelUrl);
}

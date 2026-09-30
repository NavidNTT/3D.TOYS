'use client';

import { Center, useGLTF } from '@react-three/drei';

/**
 * Local DRACOLoader path.
 *
 * `public/draco/` holds the official Draco decoders shipped with `three`
 * (copied from `node_modules/three/examples/jsm/libs/draco/`). drei defaults
 * to Google's CDN (`https://www.gstatic.com/draco/versioned/decoders/1.5.5/`),
 * which we do not want: a blocked CDN would break every Draco-compressed
 * model. Serving from our own origin also avoids CORS errors.
 */
export const DRACO_PATH = '/draco/';

/** Backwards-compatible alias (existing imports use this name). */
export const DRACO_DECODER_PATH = DRACO_PATH;

/**
 * `false` attaches no DRACOLoader at all — used as the recovery step when a
 * model cannot be decoded, and for deployments that only ever serve plain
 * (uncompressed) `.glb` / `.gltf` files.
 */
export type DracoDecoderPath = string | false;

/**
 * Make the local decoder the app-wide default, so any other `useGLTF(url)`
 * call (and every preload) resolves the decoder from our own origin too.
 */
useGLTF.setDecoderPath(DRACO_PATH);

function ToyModelWithDraco({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl, DRACO_PATH);

  return (
    <Center top>
      <primitive object={scene} />
    </Center>
  );
}

function ToyModelWithoutDraco({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl, false);

  return (
    <Center top>
      <primitive object={scene} />
    </Center>
  );
}

/**
 * Warm the loader cache for a model without rendering it (e.g. on hover or on
 * a product listing). Uses the same decoder path as `ToyModel`, otherwise the
 * preloaded entry — react-three-fiber caches by `[loader, url]` — would be
 * built with a different decoder configuration.
 */
export function preloadToyModel(
  modelUrl: string,
  dracoDecoderPath: DracoDecoderPath = DRACO_PATH,
): void {
  if (dracoDecoderPath === false) {
    useGLTF.preload(modelUrl, false);
    return;
  }
  useGLTF.preload(modelUrl, DRACO_PATH);
}

/**
 * Forget the cached (possibly rejected) load for a URL.
 *
 * r3f keys assets by `[loader, url]` only, so a failed Draco decode stays
 * cached and would re-throw instantly; a retry must clear the entry first.
 */
export function clearToyModelCache(modelUrl: string): void {
  useGLTF.clear(modelUrl);
}

interface ToyModelProps {
  modelUrl: string;
  /**
   * Local decoder path (default) or `false` to load without a DRACOLoader.
   * Plain, uncompressed `.glb` files never touch the decoder either way: the
   * GLTFLoader only invokes it for models that use
   * `KHR_draco_mesh_compression`, so both variants share this code path.
   */
  dracoDecoderPath?: DracoDecoderPath;
}

/**
 * Loads a .glb/.gltf model and centers it. `Center top` normalizes
 * position so models with arbitrary origins/offsets still sit
 * correctly on the Stage floor.
 *
 * Both the original (uncompressed `.glb`) and the Draco-compressed
 * `_opt.glb` variants load through `ProductViewer3D` from the local
 * `/draco/` decoders with no CDN or CORS errors.
 */
export default function ToyModel({
  modelUrl,
  dracoDecoderPath = DRACO_PATH,
}: ToyModelProps) {
  if (dracoDecoderPath === false) {
    return <ToyModelWithoutDraco modelUrl={modelUrl} />;
  }

  return <ToyModelWithDraco modelUrl={modelUrl} />;
}



'use client';

import { Center, useGLTF } from '@react-three/drei';

/**
 * Local DRACOLoader path.
 *
 * `public/draco/` holds the official Draco decoders shipped with `three`
 * (`npm run sync:draco` keeps them in sync). drei defaults to Google's CDN
 * (`https://www.gstatic.com/draco/versioned/decoders/1.5.5/`), which we do not
 * want: a blocked CDN would break every Draco-compressed model.
 */
export const DRACO_DECODER_PATH = '/draco/';

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
useGLTF.setDecoderPath(DRACO_DECODER_PATH);

/**
 * Warm the loader cache for a model without rendering it (e.g. on hover or on
 * a product listing). Uses the same decoder path as `ToyModel`, otherwise the
 * preloaded entry — react-three-fiber caches by `[loader, url]` — would be
 * built with a different decoder configuration.
 */
export function preloadToyModel(
  modelUrl: string,
  dracoDecoderPath: DracoDecoderPath = DRACO_DECODER_PATH,
): void {
  useGLTF.preload(modelUrl, dracoDecoderPath);
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
 */
export default function ToyModel({
  modelUrl,
  dracoDecoderPath = DRACO_DECODER_PATH,
}: ToyModelProps) {
  const { scene } = useGLTF(modelUrl, dracoDecoderPath);

  return (
    <Center top>
      <primitive object={scene} />
    </Center>
  );
}


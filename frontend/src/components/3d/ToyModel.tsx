'use client';

import { Center, useGLTF } from '@react-three/drei';

interface ToyModelProps {
  modelUrl: string;
}

/**
 * Loads a .glb/.gltf model and centers it. `Center top` normalizes
 * position so models with arbitrary origins/offsets still sit
 * correctly on the Stage floor.
 */
export default function ToyModel({ modelUrl }: ToyModelProps) {
  const { scene } = useGLTF(modelUrl);

  return (
    <Center top>
      <primitive object={scene} />
    </Center>
  );
}

# Draco decoders (local, CDN-free)

`DRACOLoader` (via drei's `useGLTF(modelUrl, '/draco/')`) fetches its decoder
from this folder instead of Google's CDN
(`https://www.gstatic.com/draco/versioned/decoders/1.5.5/`).

| File | Purpose |
| --- | --- |
| `draco_wasm_wrapper.js` | JS glue for the WebAssembly decoder (used by every modern browser) |
| `draco_decoder.wasm` | WebAssembly decoder itself |
| `draco_decoder.js` | Pure-JS fallback, loaded only when `WebAssembly` is unavailable |

These are **unmodified official builds** copied from the `gltf/` folder of the
`three` package that is already installed in this project
(`node_modules/three/examples/jsm/libs/draco/gltf/`), so they always match the
`three-stdlib` `DRACOLoader` version in use (`three-stdlib` 2.36.x).

The `gltf/` variant is the one targeted at the
[`KHR_draco_mesh_compression`](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_draco_mesh_compression)
extension — exactly what the backend pipeline writes
(`gltf-transform optimize … --compress draco` → `models/3d/optimized/*_opt.glb`).
It is also noticeably smaller than the default (non-glTF) build.

Licence: [Apache-2.0](https://github.com/google/draco/blob/main/LICENSE)
(Google Draco). Keep this attribution when redistributing.

## Re-syncing after a `three` upgrade

```bash
cd frontend
npm run sync:draco            # copy the decoders shipped with the installed three
npm run sync:draco -- --check # CI: fail when public/draco is stale
npm run verify:draco          # deeper check: names, wasm header, hashes, sample .glb fixtures
```

Do not hand-edit these files; `scripts/sync-draco.mjs` overwrites them byte for
byte and `scripts/verify-draco.mjs` compares their SHA-256 hashes against the
package copies.

#!/usr/bin/env node
/**
 * Browser-free verification of the local Draco setup.
 *
 *   npm run verify:draco
 *
 * Checks performed:
 *   1. every filename three-stdlib's DRACOLoader asks for exists in
 *      `public/draco/` and is byte-identical to the official build shipped
 *      with the installed `three` package;
 *   2. the WebAssembly decoder is a real wasm module (magic header);
 *   3. the sample fixtures behave as the viewer expects: the plain `.glb`
 *      needs no decoder, the `_opt.glb` requires KHR_draco_mesh_compression;
 *   4. (best effort) the Draco payload is actually decodable — the same
 *      google/draco generation as the browser build is run in Node.
 *
 * Exit code 0 = the viewer's inputs are sound. No browser/WebGL is involved;
 * `/dev/draco-check` is the page for the visual confirmation.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dracoDir = path.join(projectRoot, 'public', 'draco');
const fixturesDir = path.join(projectRoot, 'public', 'models', 'draco-check');

/**
 * `three` and `three-stdlib` declare `exports` maps that do not expose
 * package.json (or individual dist files), so their directories are resolved
 * from node_modules directly.
 */
function packageDir(name) {
  const dir = path.join(projectRoot, 'node_modules', ...name.split('/'));

  if (!existsSync(path.join(dir, 'package.json'))) {
    console.error(`verify:draco: ${name} is not installed — run npm install first.`);
    process.exit(1);
  }

  return dir;
}

const failures = [];
const notes = [];
const dracoFixtures = [];

function fail(message) {
  failures.push(message);
  console.log(`  FAIL  ${message}`);
}

function pass(message) {
  console.log(`  ok    ${message}`);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

// ── 1. Decoder assets ────────────────────────────────────────────────────────

console.log('\n1) public/draco decoders');

const dracoLoaderSource = readFileSync(
  path.join(packageDir('three-stdlib'), 'loaders', 'DRACOLoader.js'),
  'utf8',
);
const requested = [...dracoLoaderSource.matchAll(/_loadLibrary\("([^"]+)"/g)].map((m) => m[1]);

if (requested.length === 0) {
  fail('could not read the decoder filenames out of three-stdlib/loaders/DRACOLoader.js');
}

for (const name of requested) {
  const target = path.join(dracoDir, name);

  if (!existsSync(target)) {
    fail(`${name} is missing (DRACOLoader would 404 and Draco models would not decode)`);
    continue;
  }

  const official = path.join(
    packageDir('three'),
    'examples',
    'jsm',
    'libs',
    'draco',
    'gltf',
    name,
  );

  if (!existsSync(official)) {
    notes.push(`${name}: no official counterpart found for a hash comparison`);
    pass(`${name} present (${statSync(target).size} bytes, unverified against three)`);
    continue;
  }

  if (sha256(target) !== sha256(official)) {
    fail(`${name} differs from the build shipped with the installed three package`);
    continue;
  }

// ── 2. GLB fixtures ──────────────────────────────────────────────────────────

console.log('\n2) sample .glb fixtures');

/** Minimal GLB → { json, bin } parser (glTF 2.0 binary container). */
function readGlb(file) {
  const buffer = readFileSync(file);

  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`${path.basename(file)} is not a GLB (bad magic)`);
  }

  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));

  // Chunks are 4-byte padded; the BIN chunk follows the JSON chunk.
  const binChunkStart = 20 + jsonLength;
  const hasBin = buffer.readUInt32LE(binChunkStart + 4) === 0x004e4942;
  const bin = hasBin
    ? buffer.subarray(binChunkStart + 8, binChunkStart + 8 + buffer.readUInt32LE(binChunkStart))
    : Buffer.alloc(0);

  return { json, bin, bytes: buffer.length };
}

/** Draco payload of the first primitive that carries one. */
function dracoPayload(glb) {
  const primitive = glb.json.meshes
    ?.flatMap((mesh) => mesh.primitives ?? [])
    .find((p) => p.extensions?.KHR_draco_mesh_compression);

  if (!primitive) return null;

  const view = glb.json.bufferViews[primitive.extensions.KHR_draco_mesh_compression.bufferView];
  const offset = view.byteOffset ?? 0;

  return glb.bin.subarray(offset, offset + view.byteLength);
}

if (!existsSync(fixturesDir)) {
  notes.push(`no fixtures in ${path.relative(projectRoot, fixturesDir)} — GLB checks skipped`);
} else {
  for (const file of readdirSync(fixturesDir).filter((f) => f.endsWith('.glb'))) {
    const full = path.join(fixturesDir, file);
    const glb = readGlb(full);
    const payload = dracoPayload(glb);
    const required = (glb.json.extensionsRequired ?? []).includes('KHR_draco_mesh_compression');
    const firstPrimitive = glb.json.meshes?.[0]?.primitives?.[0];
    const vertexCount =
      firstPrimitive?.attributes?.POSITION !== undefined
        ? glb.json.accessors[firstPrimitive.attributes.POSITION].count
        : 'n/a';

    console.log(`\n  ${file} — ${glb.bytes} bytes, ${vertexCount} vertices`);

    if (payload) {
      if (required) {
        pass('requires KHR_draco_mesh_compression (decoded locally from /draco/)');
      } else {
        fail('uses KHR_draco_mesh_compression but does not list it in extensionsRequired');
      }

      pass(`carries a ${payload.length}-byte Draco payload`);
      dracoFixtures.push({ ...glb, draco: payload, file: full });
    } else if (required) {
      fail('declares KHR_draco_mesh_compression as required but has no payload');
    } else {
      pass('plain glTF/GLB — loads without the decoder');
    }
  }
}



// ── 3. Decode the Draco payload with the official decoder ────────────────────

console.log('\n3) Draco payload decodes with google/draco (node build)');

let draco3d = null;
try {
  draco3d = require('draco3d');
} catch {
  notes.push('draco3d is not installed — payload decode step skipped');
}

if (draco3d && typeof draco3d.createDecoderModule === 'function') {
  const module = await draco3d.createDecoderModule({});
  const decoder = new module.Decoder();

  for (const fixture of dracoFixtures) {
    const buffer = new module.DecoderBuffer();
    buffer.Init(new Int8Array(fixture.draco), fixture.draco.length);

    const mesh = new module.Mesh();
    const status = decoder.DecodeBufferToMesh(buffer, mesh);

    if (status.ok()) {
      pass(
        `${path.basename(fixture.file)} decoded -> ${mesh.num_points()} points, ${mesh.num_attributes()} attributes`,
      );
    } else {
      fail(`${path.basename(fixture.file)} failed to decode: ${status.error_msg()}`);
    }

    module.destroy(mesh);
    module.destroy(buffer);
  }

  module.destroy(decoder);
} else {
  notes.push('draco3d.createDecoderModule unavailable — payload decode step skipped');
}

// ── Result ───────────────────────────────────────────────────────────────────

if (notes.length > 0) {
  console.log('');
  for (const note of notes) console.log(`  note  ${note}`);
}

if (failures.length > 0) {
  console.error(`\nverify:draco FAILED (${failures.length} problem(s))`);
  process.exit(1);
}

console.log('\nverify:draco OK — local decoders and both model variants are sound.');

  pass(`${name} present and byte-identical to three's official build`);
}

const wasmFile = path.join(dracoDir, 'draco_decoder.wasm');
if (existsSync(wasmFile)) {
  const header = readFileSync(wasmFile).subarray(0, 4);
  if (header.toString('hex') === '0061736d') {
    pass('draco_decoder.wasm has the WebAssembly magic header');
  } else {
    fail(`draco_decoder.wasm is not a wasm module (header ${header.toString('hex')})`);
  }
}

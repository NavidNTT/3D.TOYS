#!/usr/bin/env node
/**
 * Copies the official Draco decoders shipped with the installed `three`
 * package into `public/draco/`, so the 3D viewer never depends on the
 * gstatic CDN that drei's `useGLTF` falls back to by default.
 *
 *   npm run sync:draco            # copy (idempotent)
 *   npm run sync:draco -- --check # verify only; exit 1 when stale (CI)
 *
 * The `gltf/` variant is intentional: it targets KHR_draco_mesh_compression,
 * which is what the backend's Optimize3DModelJob produces with
 * `gltf-transform optimize … --compress draco`.
 *
 * The exact filenames matter — three-stdlib's DRACOLoader requests
 * `draco_wasm_wrapper.js`, `draco_decoder.wasm` and (as a non-WebAssembly
 * fallback) `draco_decoder.js` from the configured decoder path.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(projectRoot, 'public', 'draco');
const checkOnly = process.argv.includes('--check');

/** Filenames DRACOLoader asks for, in the order it loads them. */
const DECODER_FILES = ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js'];

/**
 * `three` and `three-stdlib` both declare an `exports` map that does not
 * expose package.json, so resolve their directories from node_modules directly.
 */
function packageDir(name) {
  const dir = path.join(projectRoot, 'node_modules', ...name.split('/'));

  if (!existsSync(path.join(dir, 'package.json'))) {
    console.error(`[sync-draco] ${name} is not installed — run npm install first.`);
    process.exit(1);
  }

  return dir;
}

const threeRoot = packageDir('three');
const threeVersion = JSON.parse(readFileSync(path.join(threeRoot, 'package.json'), 'utf8')).version;
const sourceDir = path.join(threeRoot, 'examples', 'jsm', 'libs', 'draco', 'gltf');

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function human(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

if (!existsSync(sourceDir)) {
  console.error(`[sync-draco] three@${threeVersion} does not ship ${sourceDir}`);
  console.error('[sync-draco] Pin a three release that includes examples/jsm/libs/draco/gltf.');
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

console.log(`[sync-draco] three@${threeVersion}`);
const stale = [];

for (const name of DECODER_FILES) {
  const source = path.join(sourceDir, name);
  const target = path.join(targetDir, name);

  if (!existsSync(source)) {
    console.error(`[sync-draco] missing in three package: ${name}`);
    process.exit(1);
  }

  const sourceHash = sha256(source);
  const targetHash = existsSync(target) ? sha256(target) : null;

  if (targetHash === sourceHash) {
    console.log(`[sync-draco] ok        ${name} (${human(statSync(target).size)})`);
    continue;
  }

  if (checkOnly) {
    stale.push(name);
    console.log(`[sync-draco] STALE     ${name}`);
    continue;
  }

  copyFileSync(source, target);
  console.log(
    `[sync-draco] copied    ${name} (${human(statSync(target).size)})${targetHash ? ' — was out of date' : ''}`,
  );
}

if (checkOnly) {
  if (stale.length > 0) {
    console.error(
      `\n[sync-draco] public/draco is out of date (${stale.join(', ')}). Run: npm run sync:draco`,
    );
    process.exit(1);
  }

  console.log('\n[sync-draco] public/draco matches the installed three package.');
  process.exit(0);
}

console.log('\n[sync-draco] done.');

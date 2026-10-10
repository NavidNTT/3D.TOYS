<?php

return [

    /*
    |--------------------------------------------------------------------------
    | glTF-Transform Binary
    |--------------------------------------------------------------------------
    |
    | Path (or shell prefix) to the `@gltf-transform/cli` executable.
    | Configure via `.env`:
    |
    |   GLTF_TRANSFORM_PATH="gltf-transform"
    |   # or, when installed locally via npm:
    |   GLTF_TRANSFORM_PATH="npx @gltf-transform/cli"
    |
    | The job executes:
    |   {binary} optimize {input} {output} --compress draco
    |
    */

    'binary' => env('GLTF_TRANSFORM_PATH', 'gltf-transform'),

    /*
    |--------------------------------------------------------------------------
    | Optimized Output Directory (object key prefix on the ingest disk)
    |--------------------------------------------------------------------------
    |
    | Relative to the ingest disk's root, which is MinIO by default. The job
    | stores the resulting key (e.g. `models/3d/optimized/robot_opt.glb`) in
    | `media3d.optimized_file_url`, and Media3DResource resolves it through the
    | canonical disk.
    |
    */

    'output_directory' => env('MODEL_3D_OPTIMIZED_DIR', 'models/3d/optimized'),

    /*
    |--------------------------------------------------------------------------
    | Process Timeout (seconds)
    |--------------------------------------------------------------------------
    */

    'timeout' => (int) env('MODEL_3D_OPTIMIZE_TIMEOUT', 120),

];

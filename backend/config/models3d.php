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
    | Optimized Output Directory (public disk, relative)
    |--------------------------------------------------------------------------
    */

    'output_directory' => env('MODEL_3D_OPTIMIZED_DIR', 'models/3d/optimized'),

    /*
    |--------------------------------------------------------------------------
    | Process Timeout (seconds)
    |--------------------------------------------------------------------------
    */

    'timeout' => (int) env('MODEL_3D_OPTIMIZE_TIMEOUT', 120),

];

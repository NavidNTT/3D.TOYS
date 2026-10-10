<?php

/**
 * Fixture manifest for `php artisan toys:ingest-3d`.
 *
 * Data, not logic: the command that uploads these files and maps them to
 * products reads this table, so titles and object keys can be corrected without
 * touching the ingestion code (or re-reading a 200-line docblock for one word).
 *
 * Every `.glb` in the source directory must appear here. The command refuses to
 * run while a file is unaccounted for, because a fixture nobody lists is a
 * fixture nobody would notice was skipped.
 *
 * Entry shape:
 *
 *   'sources'   => [ 'local-file.glb' => 'models/object-key.glb' ]
 *       The first pair is the asset itself and becomes `original_file_url`.
 *       A further pair is the same asset stored under a second name; it must be
 *       byte-identical (verified at runtime, not assumed) and is preserved for
 *       that reason alone.
 *
 *   'optimized' => [ 'local-file_opt.glb' => 'models/object-key_opt.glb' ]
 *       Optional, and only when the file really is that product's
 *       Draco-compressed rendition — the viewer streams it in preference to the
 *       original (`Media3DResource::urlFor`).
 *
 * `sku` values are unique in the schema and namespaced `TOY-3D-` to stay clear
 * of the hand-written catalogue SKUs.
 *
 * Products created from this manifest are published but unpriced: `price` stays
 * NULL with currency `IRT`, so the storefront shows them and refuses to sell
 * them. No amount in this file may ever be invented — a toman price is a
 * business decision, and the six legacy USD rows stay quarantined until one is
 * made.
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Source directory
    |--------------------------------------------------------------------------
    |
    | Where the fixtures are read from when `--source` is not given. The Docker
    | layout mounts only `backend/` into the app container, so a container run
    | has to stage the files somewhere readable (e.g. `docker cp` into `/tmp`)
    | and pass `--source` explicitly.
    |
    */

    'source' => env('MODELS3D_INGEST_SOURCE'),

    'entries' => [

        [
            'slug' => '9mm-blaster-pistol',
            'title' => '9mm Blaster Pistol',
            'sku' => 'TOY-3D-9MM',
            'description' => 'Interactive 3D preview of the 9mm blaster pistol, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            'sources' => ['9_mm.glb' => 'models/9_mm.glb'],
        ],

        [
            'slug' => 'ak-47-blaster-rifle',
            'title' => 'AK-47 Blaster Rifle',
            'sku' => 'TOY-3D-AK47',
            'description' => 'Interactive 3D preview of the AK-47 blaster rifle, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            'sources' => ['ak-47.glb' => 'models/ak-47.glb'],
        ],

        [
            'slug' => 'classic-rubber-duck',
            'title' => 'Classic Rubber Duck',
            'sku' => 'TOY-3D-DUCK',
            'description' => 'The classic bath-time rubber duck, rendered in real time from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            // `duck_opt.glb` is the Draco-compressed rendition of `duck.glb`
            // (120 KB original, 42 KB `_opt`), so it is recorded as this
            // product's optimized asset rather than a product of its own.
            'sources' => ['duck.glb' => 'models/duck.glb'],
            'optimized' => ['duck_opt.glb' => 'models/duck_opt.glb'],
        ],

        [
            'slug' => 'ford-mustang-1965',
            'title' => 'Ford Mustang 1965 Model Car',
            'sku' => 'TOY-3D-MUSTANG',
            'description' => 'Interactive 3D preview of the 1965 Ford Mustang, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            'sources' => ['ford_mustang_1965.glb' => 'models/ford_mustang_1965.glb'],
        ],

        [
            'slug' => 'porsche-911-turbo-1975',
            'title' => 'Porsche 911 Turbo 1975 Model Car',
            'sku' => 'TOY-3D-911T',
            'description' => 'Interactive 3D preview of the 1975 Porsche 911 Turbo 930, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            'sources' => ['free_1975_porsche_911_930_turbo.glb' => 'models/free_1975_porsche_911_930_turbo.glb'],
        ],

        [
            'slug' => 'porsche-911-carrera-4s',
            'title' => 'Porsche 911 Carrera 4S Model Car',
            'sku' => 'TOY-3D-911C4S',
            'description' => 'Interactive 3D preview of the Porsche 911 Carrera 4S, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            'sources' => ['free_porsche_911_carrera_4s.glb' => 'models/free_porsche_911_carrera_4s.glb'],
        ],

        [
            'slug' => 'colt-python-revolver',
            'title' => 'Colt Python Revolver Model',
            'sku' => 'TOY-3D-COLT',
            'description' => 'Interactive 3D preview of the Colt Python revolver, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            // The tree carries this asset twice: `gameready_colt_python_revolver.glb`
            // and a `... (1).glb` copy. Both are preserved and uploaded under
            // distinct keys; the second is verified byte-identical, not assumed.
            'sources' => [
                'gameready_colt_python_revolver.glb' => 'models/gameready_colt_python_revolver.glb',
                'gameready_colt_python_revolver (1).glb' => 'models/gameready_colt_python_revolver_1.glb',
            ],
        ],

        [
            'slug' => 'halo-smg-blaster',
            'title' => 'Halo SMG Blaster',
            'sku' => 'TOY-3D-SMG',
            'description' => 'Interactive 3D preview of the Halo 2 anniversary SMG, streamed from the store\'s object storage. No toman price has been approved for it yet, so it cannot be purchased.',
            'sources' => ['halo_2_anniversary_-_smg.glb' => 'models/halo_2_anniversary_-_smg.glb'],
        ],

    ],

];

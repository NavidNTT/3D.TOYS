<?php

/**
 * Storefront taxonomy: the categories a product can belong to.
 *
 * One definition, three readers — `CatalogSeeder` (a fresh install), the
 * `toys:ingest-3d` command (which resolves the category each ingested product
 * belongs to out of `config/media_ingest.php`) and `toys:assign-categories`
 * (which backfills rows that predate the mapping). Keeping the list here means
 * the taxonomy cannot drift between the seed data and the backfill, and each
 * category keeps a stable English `slug`: the slug is the storefront's route
 * segment (`/categories/{slug}`) and the value the API filters on, so renaming
 * a display name never moves a URL that has already been shared.
 *
 * Adding a category is a merchandising decision, made by a human — nothing in
 * the ingestion or optimisation pipeline invents one.
 *
 * `theme_config` drives the palette the storefront paints a category with
 * (badges, buttons, container glows). The keys are the same free-form palette
 * the admin panel writes; the frontend falls back per key when one is missing
 * (see frontend/src/lib/theme.ts).
 */

return [

    'categories' => [

        [
            'name' => 'Bath Toys',
            'slug' => 'bath-toys',
            'description' => 'Floating, squeaking and endlessly splash-proof.',
            'theme_config' => [
                'primary_color' => '#38bdf8',
                'glow_color' => '#0ea5e9',
                'accent_color' => '#e0f2fe',
                'background_color' => '#0b1020',
            ],
        ],

        [
            'name' => 'Building Blocks',
            'slug' => 'building-blocks',
            'description' => 'Interlocking sets that scale from a tower to a city.',
            'theme_config' => [
                'primary_color' => '#f59e0b',
                'glow_color' => '#fbbf24',
                'accent_color' => '#fde68a',
                'background_color' => '#1a1206',
            ],
        ],

        [
            'name' => 'Collectible Figures',
            'slug' => 'collectible-figures',
            'description' => 'Hand-finished figures for the shelf, not the floor.',
            'theme_config' => [
                'primary_color' => '#a78bfa',
                'glow_color' => '#8b5cf6',
                'accent_color' => '#ddd6fe',
                'background_color' => '#120b24',
            ],
        ],

        [
            'name' => 'Remote Control',
            'slug' => 'remote-control',
            'description' => 'Motorised toys with real suspensions and real batteries.',
            'theme_config' => [
                'primary_color' => '#34d399',
                'glow_color' => '#10b981',
                'accent_color' => '#d1fae5',
                'background_color' => '#04170f',
            ],
        ],

        /*
        |----------------------------------------------------------------------
        | Model Cars
        |----------------------------------------------------------------------
        |
        | Added when the 3D fixture models were catalogued (P5). The four
        | original categories describe toys you play with; a static, accurately
        | modelled 1965 Mustang is not a remote-controlled car, so filing it
        | under `remote-control` would have mislabelled both the model and the
        | shelf it sits on. Three models share this category.
        |
        */

        [
            'name' => 'Model Cars',
            'slug' => 'model-cars',
            'description' => 'Detailed scale models of the cars people actually dream about.',
            'theme_config' => [
                'primary_color' => '#e11d48',
                'glow_color' => '#fb7185',
                'accent_color' => '#ffe4e6',
                'background_color' => '#1b0509',
            ],
        ],

        /*
        |----------------------------------------------------------------------
        | Blasters
        |----------------------------------------------------------------------
        |
        | Four of the fixture models are blasters (game and airsoft style
        | replicas). No existing category came close — `collectible-figures` is
        | for figures, not equipment — so this is the second and last category
        | this phase added. One category for four models, deliberately, rather
        | than a shelf per model.
        |
        */

        [
            'name' => 'Blasters',
            'slug' => 'blasters',
            'description' => 'Prop and game-style blasters, modelled to the last screw.',
            'theme_config' => [
                'primary_color' => '#475569',
                'glow_color' => '#94a3b8',
                'accent_color' => '#e2e8f0',
                'background_color' => '#0f172a',
            ],
        ],

    ],

];

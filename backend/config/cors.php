<?php

/*
|--------------------------------------------------------------------------
| Cross-Origin Resource Sharing (CORS)
|--------------------------------------------------------------------------
|
| The storefront runs on its own origin (http://localhost:3000) while the API
| is served by nginx on a different port, so every browser request is
| cross-origin. This file did not exist, and that is a silent failure mode:
| without it Laravel's HandleCors middleware finds an empty path list, skips
| the request entirely and emits no CORS headers. curl (which does not enforce
| CORS) still reports a healthy 200, while the browser blocks the response
| with an opaque "blocked by CORS policy" error.
|
| `supports_credentials` is true because Sanctum authenticates the SPA with a
| cookie/bearer pair. That is also why `allowed_origins` lists exact origins
| instead of `*` — the wildcard is invalid together with credentials, and
| Laravel would silently drop the header.
|
| Override the list per machine with CORS_ALLOWED_ORIGINS (comma separated),
| see .env.example / .env.docker.
|
*/

$configuredOrigins = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')),
)));

return [

    // `api/*` covers every versioned endpoint, `sanctum/csrf-cookie` the SPA
    // handshake, and `storage/*` the 3D assets served through the
    // public/storage symlink (a <model-viewer>/fetch target can be
    // cross-origin too).
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],

    'allowed_methods' => ['*'],

    // Defaults match the published frontend/API ports in .env.example. The
    // fallback is deliberate: an empty CORS_ALLOWED_ORIGINS must not silently
    // disable CORS again.
    'allowed_origins' => $configuredOrigins !== [] ? $configuredOrigins : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];

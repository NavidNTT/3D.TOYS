# syntax=docker/dockerfile:1.7
###############################################################################
#  Toy Store — PHP 8.3 FPM runtime
#
#  One image serves BOTH `laravel.app` (php-fpm) and `laravel.worker`
#  (php artisan queue:work). Build it once, reuse the tag everywhere.
#
#  Extensions: pdo_mysql, redis, gd, zip, pcntl, exif (+ opcache, bcmath)
#  Tooling:    composer 2, node 20/22, npm, git, fcgi (for healthchecks)
###############################################################################

# ARG must be declared before FROM to be usable in it, which lets
# docker-compose override the base tag via build args.
ARG PHP_BASE_IMAGE=php:8.3-fpm-alpine

# ── Stage 1: composer binary ────────────────────────────────────
# Copying from the official image avoids the curl/checksum dance and
# keeps the final image free of the installer's toolchain.
FROM composer:2 AS composer

# ── Stage 2: runtime ────────────────────────────────────────────
FROM ${PHP_BASE_IMAGE} AS runtime

# UID/GID for the runtime user. On Linux/macOS hosts set these to your
# own `id -u`/`id -g` so bind-mounted files are not root-owned:
#   APP_UID=$(id -u) APP_GID=$(id -g) docker compose build
ARG APP_UID=1000
ARG APP_GID=1000

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_MEMORY_LIMIT=-1 \
    COMPOSER_HOME=/composer \
    COMPOSER_NO_INTERACTION=1 \
    PATH="/composer/vendor/bin:$PATH" \
    TZ=UTC

# ---------------------------------------------------------------------------
# System packages + PHP extensions in a single layer.
# Build-only headers go into a virtual package and are removed afterwards,
# so the shipped image keeps only the shared libraries php links against.
# ---------------------------------------------------------------------------
RUN set -eux; \
    apk add --no-cache \
        bash \
        curl \
        fcgi \
        git \
        nodejs \
        npm \
        unzip \
        tzdata \
        shadow \
        libpng \
        libjpeg-turbo \
        freetype \
        libwebp \
        libzip \
        sqlite-libs; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        freetype-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libzip-dev \
        sqlite-dev; \
    \
    # GD with the image formats a toy store actually needs
    docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        opcache \
        pcntl \
        pdo_mysql \
        pdo_sqlite \
        zip; \
    \
    # phpredis: the C client Laravel uses for cache + queues
    pecl install redis; \
    docker-php-ext-enable redis; \
    (pecl clear-cache || true); \
    \
    apk del --no-network .build-deps; \
    rm -rf /tmp/pear /tmp/* /var/cache/apk/*

# ---------------------------------------------------------------------------
# Node.js (npm) + glTF-Transform CLI (Draco 3D optimizer)
# ---------------------------------------------------------------------------
# The Draco pipeline (`Optimize3DModelJob`) shells out to:
#   gltf-transform optimize {input} {output} --compress draco
# Install the CLI globally here — not via composer — so queue workers
# (laravel.worker runs `queue:work` from this same image) can execute it.
# Configure the binary path via GLTF_TRANSFORM_PATH in .env (default above).
RUN set -eux; \
    npm install -g @gltf-transform/cli; \
    gltf-transform --version; \
    npm cache clean --force

# ---------------------------------------------------------------------------
# Align the runtime user with the host user.
#
# Alpine's www-data is 82:82; on Linux/macOS hosts developers are 1000:1000,
# and files PHP writes into the bind mount should be theirs, not root's.
# Harmless on Windows (bind mount ownership is virtualised).
# ---------------------------------------------------------------------------
RUN set -eux; \
    if [ "${APP_GID}" != "82" ]; then groupmod -g "${APP_GID}" www-data; fi; \
    if [ "${APP_UID}" != "82" ]; then usermod -u "${APP_UID}" www-data; fi; \
    mkdir -p /var/www/html /composer/vendor/bin; \
    chown -R www-data:www-data /var/www /composer; \
    id www-data

# ---------------------------------------------------------------------------
# Configuration + tooling
# ---------------------------------------------------------------------------
COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY php.ini        /usr/local/etc/php/conf.d/zz-toy-store.ini
COPY fpm-pool.conf  /usr/local/etc/php-fpm.d/zz-toy-store.conf
COPY entrypoint.sh      /usr/local/bin/entrypoint.sh
COPY healthcheck.sh     /usr/local/bin/fpm-healthcheck.sh
COPY bootstrap-laravel.sh /usr/local/bin/bootstrap-laravel.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
             /usr/local/bin/fpm-healthcheck.sh \
             /usr/local/bin/bootstrap-laravel.sh

WORKDIR /var/www/html

# Reuse the built-in FPM health probe (FastCGI ping) inside the image,
# docker-compose tightens the timings.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD ["/usr/local/bin/fpm-healthcheck.sh"]

EXPOSE 9000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm", "--nodaemonize"]

#!/bin/sh
# ---------------------------------------------------------------------------
#  Toy Store — MinIO bucket bootstrap (runs in the `minio/mc` image as a
#  one-shot service after the server container starts).
#
#  Idempotent: safe to re-run after `docker compose up` recreates anything.
# ---------------------------------------------------------------------------
set -eu

ALIAS="${MINIO_ALIAS:-toystore}"
ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
BUCKET="${MINIO_BUCKET:-toy-store-assets}"
POLICY="${MINIO_BUCKET_POLICY:-download}"
MAX_WAIT="${MINIO_MAX_WAIT:-120}"

log() { printf '\033[1;35m[minio-init]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[minio-init] %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "${MINIO_ROOT_USER:-}" ]     || die "MINIO_ROOT_USER is not set"
[ -n "${MINIO_ROOT_PASSWORD:-}" ] || die "MINIO_ROOT_PASSWORD is not set"

# ── 1. Wait for the API to accept authenticated calls ─────────────────────
# The server image ships no curl/wget, so read progress is verified by
# actually performing the operation we need (health probe from outside).
log "waiting for MinIO at ${ENDPOINT} (max ${MAX_WAIT}s)"
waited=0
until mc alias set "$ALIAS" "$ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
    waited=$((waited + 2))
    [ "$waited" -ge "$MAX_WAIT" ] && die "MinIO not reachable after ${MAX_WAIT}s"
    sleep 2
done
log "alias '${ALIAS}' → ${ENDPOINT} ready"

# ── 2. Bucket ─────────────────────────────────────────────────────────────
mc mb --ignore-existing "${ALIAS}/${BUCKET}" >/dev/null
log "bucket '${BUCKET}' present"

# ── 3. Anonymous read so <model-viewer>/next/image can stream .glb assets ──
# Swap to `mc anonymous set none` once a signed-URL flow is in place.
mc anonymous set "$POLICY" "${ALIAS}/${BUCKET}" >/dev/null
log "anonymous policy: ${POLICY}"

# ── 4. Convenience prefixes (S3 "folders" are just key prefixes) ──────────
for prefix in models thumbnails textures avatars; do
    printf 'Toy Store asset namespace: %s/\n' "$prefix" \
        | mc pipe "${ALIAS}/${BUCKET}/${prefix}/.keep" >/dev/null 2>&1 || true
done
log "created prefixes: models/ thumbnails/ textures/ avatars/"

# ── 5. Keep old model revisions: versioning is cheap insurance ────────────
mc version enable "${ALIAS}/${BUCKET}" >/dev/null 2>&1 || true

log "done — contents:"
mc ls "${ALIAS}/${BUCKET}"

# Shortcut for the browser-facing URL (compose passes MINIO_PUBLIC_URL).
if [ -n "${MINIO_PUBLIC_URL:-}" ]; then
    log "public base URL: ${MINIO_PUBLIC_URL}/${BUCKET}"
fi

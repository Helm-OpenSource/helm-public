#!/usr/bin/env bash
set -euo pipefail

repo_url="${HELM_D2_SMOKE_REPO_URL:-$(git config --get remote.origin.url)}"
ref="${HELM_D2_SMOKE_REF:-HEAD}"
keep_workdir="${HELM_D2_SMOKE_KEEP_WORKDIR:-0}"
timeout_seconds="${HELM_D2_SMOKE_TIMEOUT_SECONDS:-240}"
workdir="${HELM_D2_SMOKE_WORKDIR:-$(mktemp -d "${TMPDIR:-/tmp}/helm-public-d2-smoke.XXXXXX")}"
mirror_dir="${HELM_D2_SMOKE_MIRROR_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/helm-public-d2-mirror.XXXXXX")}"
compose_dir=""

if ! command -v docker >/dev/null 2>&1; then
  echo "[d2-smoke] docker is required but was not found on PATH" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[d2-smoke] docker compose is required but is not available" >&2
  exit 1
fi

if [ -z "${repo_url}" ]; then
  echo "[d2-smoke] HELM_D2_SMOKE_REPO_URL or git remote.origin.url is required" >&2
  exit 1
fi

cleanup() {
  local status=$?

  if [ -n "$compose_dir" ] && [ -f "${compose_dir}/docker-compose.yml" ]; then
    if [ "$status" -ne 0 ]; then
      echo "[d2-smoke] docker compose ps" >&2
      (cd "$compose_dir" && docker compose ps) >&2 || true
      echo "[d2-smoke] docker compose logs" >&2
      (cd "$compose_dir" && docker compose logs --no-color --tail=300) >&2 || true
    fi

    (cd "$compose_dir" && docker compose down -v --remove-orphans) >/dev/null 2>&1 || true
  fi

  if [ "$keep_workdir" != "1" ]; then
    rm -rf "$workdir" "$mirror_dir"
  else
    echo "[d2-smoke] kept source workdir: $workdir" >&2
    echo "[d2-smoke] kept public mirror: $mirror_dir" >&2
  fi

  exit "$status"
}

trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local label="$2"
  local deadline=$((SECONDS + timeout_seconds))

  while [ "$SECONDS" -lt "$deadline" ]; do
    local code
    code="$(curl --silent --show-error --location --output /dev/null --write-out "%{http_code}" "$url" || true)"
    if [[ "$code" =~ ^[23] ]]; then
      echo "[d2-smoke] ${label}: HTTP ${code}"
      return 0
    fi
    sleep 2
  done

  echo "[d2-smoke] ${label}: timed out after ${timeout_seconds}s at ${url}" >&2
  curl --verbose --location "$url" >&2 || true
  return 1
}

echo "[d2-smoke] repo_url=${repo_url}"
echo "[d2-smoke] ref=${ref}"
echo "[d2-smoke] workdir=${workdir}"
docker --version
docker compose version

git clone --no-checkout "$repo_url" "$workdir"
git -C "$workdir" fetch --depth 1 origin "$ref"
git -C "$workdir" checkout --detach FETCH_HEAD

echo "[d2-smoke] checkout=$(git -C "$workdir" rev-parse HEAD)"

if ! command -v npm >/dev/null 2>&1; then
  echo "[d2-smoke] npm is required to prepare the public mirror" >&2
  exit 1
fi

npm --prefix "$workdir" ci --no-audit --no-fund
npm --prefix "$workdir" run public-mirror:build -- --source-root "$workdir" --mirror-root "$mirror_dir"

compose_dir="$mirror_dir"
cd "$compose_dir"
docker compose up --build -d

wait_for_url "http://localhost:3000/health" "/health"
wait_for_url "http://localhost:3000/demo" "/demo"
wait_for_url "http://localhost:3000/trial" "/trial"
wait_for_url "http://localhost:3000/operating" "/operating"

docker compose ps
echo "[d2-smoke] PASS"

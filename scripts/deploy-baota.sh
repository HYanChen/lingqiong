#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${DEPLOY_ROOT:-/www/wwwroot/pla.wiki}"
BACKUP_ROOT="${DEPLOY_BACKUP_ROOT:-/www/backup}"
REPOSITORY="${DEPLOY_REPOSITORY:-https://github.com/HYanChen/lingqiong.git}"
BRANCH="${DEPLOY_BRANCH:-codex/jeecgboot-full-rebuild}"
ARCHIVE_URL="${DEPLOY_ARCHIVE_URL:-https://codeload.github.com/HYanChen/lingqiong/tar.gz/refs/heads/codex/jeecgboot-full-rebuild}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE="/www/wwwroot/.pla.wiki-release-${STAMP}"
PREVIOUS="${BACKUP_ROOT}/pla.wiki-prev-${STAMP}"
DATABASE_BACKUP="${BACKUP_ROOT}/pla.wiki-databases-${STAMP}.sql.gz"
LOG_FILE="${BACKUP_ROOT}/lingqiong-deploy-current.log"
COMPOSE_FILE="docker-compose.baota.yml"
CUTOVER_STARTED=0
OLD_WEB_IMAGE=""

mkdir -p "$BACKUP_ROOT"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

stage() {
  printf '\n[%s] %s\n' "$(date '+%F %T')" "$1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "缺少部署命令：$1"
    exit 1
  }
}

ensure_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "$file"; then
    return
  fi
  printf '%s=%s\n' "$key" "$value" >> "$file"
}

compose_at() {
  local directory="$1"
  shift
  docker compose -p lingqiong \
    -f "${directory}/${COMPOSE_FILE}" \
    --env-file "${directory}/.env.baota" "$@"
}

restore_previous() {
  echo "开始自动回滚上一版本。"
  compose_at "$ROOT" down --remove-orphans >/dev/null 2>&1 || true
  rsync -a --delete --exclude data --exclude proxy_cache "$PREVIOUS/" "$ROOT/"
  if [[ -n "$OLD_WEB_IMAGE" ]]; then
    docker tag "$OLD_WEB_IMAGE" lingqiong_web:latest >/dev/null 2>&1 || true
  fi
  compose_at "$ROOT" up -d --no-build
  echo "上一版本已恢复。"
}

on_error() {
  local status=$?
  echo "部署失败，退出码：${status}"
  if [[ "$CUTOVER_STARTED" == "1" && -d "$PREVIOUS" ]]; then
    restore_previous || true
  fi
  exit "$status"
}

trap on_error ERR
trap 'rm -rf "$RELEASE"' EXIT

for command_name in curl docker git gzip openssl python3 rsync tar timeout; do
  require_command "$command_name"
done

[[ -d "$ROOT" ]] || { echo "生产目录不存在：$ROOT"; exit 1; }
[[ -f "$ROOT/.env.baota" ]] || { echo "缺少生产环境配置：$ROOT/.env.baota"; exit 1; }
[[ -n "${WECHAT_APP_ID:-}" ]] || { echo "缺少 WECHAT_APP_ID"; exit 1; }
[[ -n "${WECHAT_APP_SECRET:-}" ]] || { echo "缺少 WECHAT_APP_SECRET"; exit 1; }

stage "1/8 拉取已验证版本"
rm -rf "$RELEASE"
clone_ok=0
for clone_attempt in 1 2; do
  rm -rf "$RELEASE"
  if timeout 120 git -c http.version=HTTP/1.1 clone --depth 1 --single-branch \
    --branch "$BRANCH" "$REPOSITORY" "$RELEASE"; then
    clone_ok=1
    break
  fi
  echo "代码拉取失败，第 ${clone_attempt} 次重试。"
  sleep $((clone_attempt * 5))
done
if [[ "$clone_ok" != "1" ]]; then
  echo "Git 拉取不稳定，改用 GitHub 归档下载。"
  rm -rf "$RELEASE"
  mkdir -p "$RELEASE"
  curl --http1.1 -fL --retry 6 --retry-delay 5 --retry-all-errors \
    "$ARCHIVE_URL" | tar -xz --strip-components=1 -C "$RELEASE"
fi
cp "$ROOT/.env.baota" "$RELEASE/.env.baota"
if [[ -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env" "$RELEASE/.env"
else
  cp "$ROOT/.env.baota" "$RELEASE/.env"
fi
ensure_env_value "$RELEASE/.env.baota" JEECG_SIGNATURE_SECRET "$(openssl rand -hex 48)"
ensure_env_value "$RELEASE/.env.baota" JEECG_SERVICE_SECRET "$(openssl rand -hex 48)"
cp "$RELEASE/.env.baota" "$RELEASE/.env"
chmod 600 "$RELEASE/.env" "$RELEASE/.env.baota"

stage "2/8 校验生产编排"
compose_at "$RELEASE" config >/dev/null

stage "3/8 预构建官网与 JeecgBoot"
DOCKER_BUILDKIT=1 compose_at "$RELEASE" build web jeecg-system jeecg-admin

stage "4/8 备份代码、数据库和当前镜像"
mkdir -p "$PREVIOUS"
rsync -a --delete --exclude data --exclude proxy_cache "$ROOT/" "$PREVIOUS/"
OLD_WEB_IMAGE="$(docker inspect -f '{{.Image}}' lingqiong-web 2>/dev/null || true)"
docker exec lingqiong-mysql sh -lc \
  'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --events --all-databases' \
  | gzip -9 > "$DATABASE_BACKUP"
test -s "$DATABASE_BACKUP"

stage "5/8 切换生产代码并启动新架构"
CUTOVER_STARTED=1
compose_at "$ROOT" down --remove-orphans
rsync -a --delete --exclude .git --exclude data --exclude proxy_cache \
  --exclude .env --exclude .env.baota "$RELEASE/" "$ROOT/"
cp "$RELEASE/.env" "$ROOT/.env"
cp "$RELEASE/.env.baota" "$ROOT/.env.baota"
chmod 600 "$ROOT/.env" "$ROOT/.env.baota"
compose_at "$ROOT" up -d --no-build

stage "6/8 等待核心服务就绪"
ready=0
for attempt in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:18080/platform-api/v1/health >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:18080/ >/dev/null 2>&1 \
    && curl -fsS http://127.0.0.1:18080/admin/ >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:18080/jeecgboot/sys/randomImage/deploy-${STAMP}" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 5
done
[[ "$ready" == "1" ]] || { echo "核心服务未在限时内就绪"; exit 1; }

stage "7/8 写入微信登录配置并加固后台密码"
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.baota"
set +a

WECHAT_PAYLOAD="$(python3 - <<'PY'
import json
import os
print(json.dumps({
    "wechat": {
        "enabled": True,
        "mode": "official",
        "appId": os.environ["WECHAT_APP_ID"],
        "appSecret": os.environ["WECHAT_APP_SECRET"],
        "qrTitle": "微信扫码登录",
        "qrHint": "使用微信扫码登录战纪宇宙统一平台。",
        "defaultAccount": "微信创作者",
        "defaultContact": "wechat-user",
    }
}, ensure_ascii=False))
PY
)"
curl -fsS -X PUT \
  -H 'Content-Type: application/json' \
  -H "X-Lingqiong-Service-Secret: ${JEECG_SERVICE_SECRET}" \
  --data "$WECHAT_PAYLOAD" \
  http://127.0.0.1:18080/_wcu-api/admin/login-settings >/tmp/lingqiong-wechat-save.json
curl -fsS \
  -H "X-Lingqiong-Service-Secret: ${JEECG_SERVICE_SECRET}" \
  http://127.0.0.1:18080/_wcu-api/admin/login-settings >/tmp/lingqiong-wechat-check.json
python3 - <<'PY'
import json
import os
with open('/tmp/lingqiong-wechat-check.json', encoding='utf-8') as handle:
    data = json.load(handle)
wechat = data.get('wechat', {})
if wechat.get('appId') != os.environ['WECHAT_APP_ID'] or not wechat.get('appSecretConfigured'):
    raise SystemExit('微信登录配置验证失败')
PY

CHECK_KEY="deploy-admin-${STAMP}"
curl -fsS "http://127.0.0.1:18080/jeecgboot/sys/randomImage/${CHECK_KEY}" >/tmp/lingqiong-jeecg-captcha.json
REDIS_KEY="$(docker exec lingqiong-jeecg-redis redis-cli --raw KEYS '*' | awk 'length($0) == 36 {print; exit}')"
best_ttl=-1
for candidate in $(docker exec lingqiong-jeecg-redis redis-cli --raw KEYS '*' | awk 'length($0) == 36'); do
  candidate_ttl="$(docker exec lingqiong-jeecg-redis redis-cli --raw TTL "$candidate" | tr -d '\r')"
  if [[ "$candidate_ttl" =~ ^[0-9]+$ ]] && (( candidate_ttl > best_ttl )); then
    best_ttl="$candidate_ttl"
    REDIS_KEY="$candidate"
  fi
done
if [[ -n "$REDIS_KEY" && -n "${ADMIN_PASSWORD:-}" ]]; then
  CAPTCHA="$(docker exec lingqiong-jeecg-redis redis-cli --raw GET "$REDIS_KEY" | tr -d '"\r\n')"
  LOGIN_PAYLOAD="$(CAPTCHA="$CAPTCHA" CHECK_KEY="$CHECK_KEY" python3 - <<'PY'
import json
import os
print(json.dumps({
    'username': 'admin',
    'password': '123456',
    'captcha': os.environ['CAPTCHA'],
    'checkKey': os.environ['CHECK_KEY'],
}))
PY
)"
  curl -fsS -H 'Content-Type: application/json' --data "$LOGIN_PAYLOAD" \
    http://127.0.0.1:18080/jeecgboot/sys/login >/tmp/lingqiong-jeecg-login.json
  JEECG_TOKEN="$(python3 - <<'PY'
import json
try:
    with open('/tmp/lingqiong-jeecg-login.json', encoding='utf-8') as handle:
        print(json.load(handle).get('result', {}).get('token', ''))
except Exception:
    print('')
PY
)"
  if [[ -n "$JEECG_TOKEN" ]]; then
    PASSWORD_PAYLOAD="$(python3 - <<'PY'
import json
import os
print(json.dumps({'username': 'admin', 'password': os.environ['ADMIN_PASSWORD']}))
PY
)"
    curl -fsS -X PUT -H 'Content-Type: application/json' \
      -H "X-Access-Token: ${JEECG_TOKEN}" --data "$PASSWORD_PAYLOAD" \
      http://127.0.0.1:18080/jeecgboot/sys/user/changePassword >/tmp/lingqiong-jeecg-password.json
  fi
fi

stage "8/8 线上功能验收"
curl -fsS https://pla.wiki/ >/dev/null
curl -fsS https://pla.wiki/login >/dev/null
curl -fsS https://pla.wiki/admin/ >/dev/null
curl -fsS "https://pla.wiki/jeecgboot/sys/randomImage/final-${STAMP}" >/dev/null
compose_at "$ROOT" ps
echo "DEPLOYMENT_SUCCESS ${STAMP}"

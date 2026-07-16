#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${DEPLOY_ROOT:-/www/wwwroot/pla.wiki}"
BACKUP_ROOT="${DEPLOY_BACKUP_ROOT:-/www/backup}"
REPOSITORY="${DEPLOY_REPOSITORY:-https://github.com/HYanChen/lingqiong.git}"
BRANCH="${DEPLOY_BRANCH:-codex/jeecgboot-full-rebuild}"
ARCHIVE_URL="${DEPLOY_ARCHIVE_URL:-https://codeload.github.com/HYanChen/lingqiong/tar.gz/refs/heads/${BRANCH}}"
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
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.baota"
set +a
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
  curl -fL --retry 6 --retry-delay 5 \
    "$ARCHIVE_URL" | tar -xz --strip-components=1 -C "$RELEASE"
fi
cp "$ROOT/.env.baota" "$RELEASE/.env.baota"
if [[ -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env" "$RELEASE/.env"
else
  cp "$ROOT/.env.baota" "$RELEASE/.env"
fi
ensure_env_value "$RELEASE/.env.baota" WCU_INTERNAL_SERVICE_SECRET "$(openssl rand -hex 48)"
cp "$RELEASE/.env.baota" "$RELEASE/.env"
chmod 600 "$RELEASE/.env" "$RELEASE/.env.baota"

stage "2/8 校验生产编排"
compose_at "$RELEASE" config >/dev/null
RUNTIME_SERVICES="$(compose_at "$RELEASE" config --services)"
for required_service in proxy web platform-api new-api bookstack mysql; do
  grep -qx "$required_service" <<<"$RUNTIME_SERVICES" || {
    echo "生产编排缺少核心服务：$required_service"
    exit 1
  }
done
for retired_service in jeecg-admin jeecg-system jeecg-redis jeecg-db-init; do
  if grep -qx "$retired_service" <<<"$RUNTIME_SERVICES"; then
    echo "生产编排仍包含已停用服务：$retired_service"
    exit 1
  fi
done

stage "3/8 预构建战纪宇宙官网与原生后台"
if [[ "${SKIP_APP_BUILDS:-0}" == "1" ]]; then
  docker image inspect lingqiong_web:latest >/dev/null
  echo "使用已构建并验证的战纪宇宙应用镜像。"
else
  DOCKER_BUILDKIT=1 compose_at "$RELEASE" build web
fi

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
  if curl -fsS http://localhost:18080/platform-api/v1/health >/dev/null 2>&1 \
    && curl -fsS http://localhost:18080/ >/dev/null 2>&1 \
    && curl -fsS http://localhost:18080/admin >/dev/null 2>&1 \
    && curl -fsS http://localhost:18080/_wcu-api/admin/me >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 5
done
[[ "$ready" == "1" ]] || { echo "核心服务未在限时内就绪"; exit 1; }

stage "7/8 写入微信登录配置并验证原生后台"
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.baota"
set +a

docker exec -i \
  -e WX_APP_ID="$WECHAT_APP_ID" \
  -e WX_APP_SECRET="$WECHAT_APP_SECRET" \
  -e WCU_INTERNAL_SERVICE_SECRET="$WCU_INTERNAL_SERVICE_SECRET" \
  lingqiong-platform-api node <<'NODE'
const run = async () => {
  const url = 'http://127.0.0.1:3000/api/admin/login-settings';
  const headers = {
    'Content-Type': 'application/json',
    'X-WCU-Internal-Service-Secret': process.env.WCU_INTERNAL_SERVICE_SECRET,
  };
  const payload = {
    wechat: {
      enabled: true,
      mode: 'official',
      appId: process.env.WX_APP_ID,
      appSecret: process.env.WX_APP_SECRET,
      qrTitle: '微信扫码登录',
      qrHint: '使用微信扫码登录战纪宇宙统一平台。',
      defaultAccount: '微信创作者',
      defaultContact: 'wechat-user',
    },
  };
  const saved = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (!saved.ok) throw new Error(`微信配置保存失败：${saved.status}`);
  const checked = await fetch(url, { headers });
  if (!checked.ok) throw new Error(`微信配置读取失败：${checked.status}`);
  const data = await checked.json();
  if (data.wechat?.appId !== process.env.WX_APP_ID || !data.wechat?.appSecretConfigured) {
    throw new Error('微信登录配置验证失败');
  }
  console.log('WECHAT_CONFIG_OK');
};
run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE

ADMIN_SMOKE_COOKIE="/tmp/lingqiong-native-admin-${STAMP}.cookies"
ADMIN_SMOKE_LOGIN="/tmp/lingqiong-native-admin-${STAMP}.login.json"
ADMIN_SMOKE_ME="/tmp/lingqiong-native-admin-${STAMP}.me.json"
LOGIN_PAYLOAD="$(ADMIN_SMOKE_USERNAME="${ADMIN_USERNAME:-admin}" ADMIN_SMOKE_PASSWORD="$ADMIN_PASSWORD" python3 - <<'PY'
import json
import os
print(json.dumps({
    'username': os.environ['ADMIN_SMOKE_USERNAME'],
    'password': os.environ['ADMIN_SMOKE_PASSWORD'],
}))
PY
)"
curl -fsS -c "$ADMIN_SMOKE_COOKIE" -H 'Content-Type: application/json' \
  --data "$LOGIN_PAYLOAD" \
  http://localhost:18080/_wcu-api/admin/login > "$ADMIN_SMOKE_LOGIN"
curl -fsS -b "$ADMIN_SMOKE_COOKIE" \
  http://localhost:18080/_wcu-api/admin/me > "$ADMIN_SMOKE_ME"
ADMIN_SMOKE_LOGIN="$ADMIN_SMOKE_LOGIN" ADMIN_SMOKE_ME="$ADMIN_SMOKE_ME" python3 - <<'PY'
import json
import os

try:
    with open(os.environ['ADMIN_SMOKE_LOGIN'], encoding='utf-8') as handle:
        login = json.load(handle)
    with open(os.environ['ADMIN_SMOKE_ME'], encoding='utf-8') as handle:
        current = json.load(handle)
except (OSError, ValueError) as error:
    raise SystemExit(f'原生后台响应无效：{error}')

if login.get('ok') is not True or current.get('authenticated') is not True:
    raise SystemExit('原生后台登录会话验证失败')
PY
curl -fsS -b "$ADMIN_SMOKE_COOKIE" -X POST \
  http://localhost:18080/_wcu-api/admin/logout >/dev/null
rm -f "$ADMIN_SMOKE_COOKIE" "$ADMIN_SMOKE_LOGIN" "$ADMIN_SMOKE_ME"

stage "8/8 线上功能验收"
curl -fsS http://localhost:18080/ >/dev/null
curl -fsS http://localhost:18080/login >/dev/null
curl -fsS http://localhost:18080/admin >/dev/null
curl -fsS http://localhost:18080/_wcu-api/admin/me >/dev/null
docker exec \
  -e WCU_AUDIT_BASE_URL="http://proxy" \
  -e WCU_INTERNAL_SERVICE_SECRET="$WCU_INTERNAL_SERVICE_SECRET" \
  lingqiong-platform-api node scripts/skill-linkage-smoke.mjs

# 公网验收发生在切流之后。这里的任一请求或内容断言失败都会触发
# ERR trap，并由 on_error 恢复上一版本，不能降级为告警后继续发布。
PUBLIC_BASE_URL="${WCU_PUBLIC_BASE_URL%/}"
PUBLIC_SMOKE_DIR="$RELEASE/.public-smoke"
mkdir -p "$PUBLIC_SMOKE_DIR"

verify_public_html() {
  local route="$1"
  local label="$2"
  local marker="$3"
  local output="$4"
  local url="${PUBLIC_BASE_URL}${route}"

  echo "验收公网入口：${label} ${url}"
  curl -fL --silent --show-error \
    --retry 3 --retry-delay 2 --connect-timeout 10 --max-time 45 \
    "$url" -o "$output"

  if ! grep -Fq "$marker" "$output"; then
    echo "公网入口内容校验失败：${label} 缺少标记「${marker}」"
    return 1
  fi
}

verify_public_html "/" "官网首页" "战纪宇宙" "$PUBLIC_SMOKE_DIR/home.html"
verify_public_html "/login" "统一登录" "战纪宇宙统一登录" "$PUBLIC_SMOKE_DIR/login.html"
verify_public_html "/admin" "原生运营后台" "正在进入战纪宇宙运营后台" "$PUBLIC_SMOKE_DIR/admin.html"

if grep -Eqi 'JeecgBoot|Jeecg' "$PUBLIC_SMOKE_DIR/admin.html"; then
  echo "公网 /admin 错误返回 Jeecg 页面，拒绝完成部署。"
  false
fi

compose_at "$ROOT" ps
echo "DEPLOYMENT_SUCCESS ${STAMP}"

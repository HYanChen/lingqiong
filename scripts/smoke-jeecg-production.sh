#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${DEPLOY_ROOT:-/www/wwwroot/pla.wiki}"
BASE="${JEECG_SMOKE_BASE:-http://127.0.0.1:18080/jeecgboot}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

set -a
# shellcheck disable=SC1091
source "$ROOT/.env.baota"
set +a

CHECK_KEY="production-smoke-$(date +%s)-$RANDOM"
curl -fsS "$BASE/sys/randomImage/$CHECK_KEY" > "$WORK/captcha-response.json"

REDIS_KEY=""
best_ttl=-1
for candidate in $(docker exec lingqiong-jeecg-redis redis-cli --raw KEYS '*' | awk 'length($0) == 36'); do
  candidate_ttl="$(docker exec lingqiong-jeecg-redis redis-cli --raw TTL "$candidate" | tr -d '\r')"
  if [[ "$candidate_ttl" =~ ^[0-9]+$ ]] && (( candidate_ttl > best_ttl )); then
    best_ttl="$candidate_ttl"
    REDIS_KEY="$candidate"
  fi
done
[[ -n "$REDIS_KEY" ]] || { echo "未找到验证码缓存"; exit 1; }

CAPTCHA="$(docker exec lingqiong-jeecg-redis redis-cli --raw GET "$REDIS_KEY" | tr -d '"\r\n')"
LOGIN_PAYLOAD="$(CAPTCHA="$CAPTCHA" CHECK_KEY="$CHECK_KEY" python3 - <<'PY'
import json
import os
print(json.dumps({
    'username': 'admin',
    'password': os.environ['ADMIN_PASSWORD'],
    'captcha': os.environ['CAPTCHA'],
    'checkKey': os.environ['CHECK_KEY'],
}))
PY
)"
curl -fsS -H 'Content-Type: application/json' --data "$LOGIN_PAYLOAD" \
  "$BASE/sys/login" > "$WORK/login.json"

TOKEN="$(python3 - "$WORK/login.json" <<'PY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as handle:
    data = json.load(handle)
print(data.get('result', {}).get('token', ''))
PY
)"
[[ -n "$TOKEN" ]] || { echo "Jeecg 管理员登录失败"; exit 1; }

auth=(-H "X-Access-Token: $TOKEN")
curl -fsS "${auth[@]}" "$BASE/lingqiong/dashboard/summary" > "$WORK/summary.json"
curl -fsS "${auth[@]}" "$BASE/lingqiong/data/modules" > "$WORK/modules.json"
curl -fsS "${auth[@]}" "$BASE/lingqiong/projects/list?pageNo=1&pageSize=2" > "$WORK/projects.json"
curl -fsS "${auth[@]}" "$BASE/lingqiong/bridge/admin/content" > "$WORK/content.json"
curl -fsS "${auth[@]}" "$BASE/lingqiong/bridge/admin/login-settings" > "$WORK/login-settings.json"
curl -fsS "${auth[@]}" "$BASE/lingqiong/bridge/not-supported" > "$WORK/not-supported.json"

python3 - "$WORK" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
def load(name):
    with (root / name).open(encoding='utf-8') as handle:
        return json.load(handle)

summary = load('summary.json')
modules = load('modules.json')
projects = load('projects.json')
content = load('content.json')
login_settings = load('login-settings.json')
not_supported = load('not-supported.json')

assert summary.get('success') is True and isinstance(summary.get('result', {}).get('projects'), int)
assert modules.get('success') is True and len(modules.get('result', [])) == 40
assert projects.get('success') is True and isinstance(projects.get('result', {}).get('records'), list)
assert content.get('success') is True and isinstance(content.get('result', {}).get('brand'), dict)
assert login_settings.get('success') is True
wechat = login_settings.get('result', {}).get('wechat', {})
assert wechat.get('mode') == 'official' and wechat.get('appSecretConfigured') is True
assert not_supported.get('success') is False and not_supported.get('code') == 404
PY

echo "LIVE_JEECG_SMOKE_OK"

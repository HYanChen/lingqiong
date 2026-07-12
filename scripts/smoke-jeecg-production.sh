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

login_with_password() {
  local password="$1"
  local attempt="$2"
  local check_key="production-smoke-$(date +%s)-$RANDOM-$attempt"
  local before="$WORK/keys-before-$attempt"
  local after="$WORK/keys-after-$attempt"
  local redis_key
  local captcha
  local payload
  local response="$WORK/login-$attempt.json"

  docker exec lingqiong-jeecg-redis redis-cli --raw KEYS '*' | sort > "$before"
  curl -fsS "$BASE/sys/randomImage/$check_key" > "$WORK/captcha-$attempt.json"
  docker exec lingqiong-jeecg-redis redis-cli --raw KEYS '*' | sort > "$after"
  redis_key="$(comm -13 "$before" "$after" | head -1)"
  [[ -n "$redis_key" ]] || return 0
  captcha="$(docker exec lingqiong-jeecg-redis redis-cli --raw GET "$redis_key" | tr -d '"\r\n')"
  payload="$(CAPTCHA="$captcha" CHECK_KEY="$check_key" LOGIN_PASSWORD="$password" python3 - <<'PY'
import json
import os
print(json.dumps({
    'username': 'admin',
    'password': os.environ['LOGIN_PASSWORD'],
    'captcha': os.environ['CAPTCHA'],
    'checkKey': os.environ['CHECK_KEY'],
}))
PY
)"
  curl -fsS -H 'Content-Type: application/json' --data "$payload" \
    "$BASE/sys/login" > "$response"
  python3 - "$response" <<'PY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as handle:
    data = json.load(handle)
print(data.get('result', {}).get('token', ''))
PY
}

TOKEN="$(login_with_password "$ADMIN_PASSWORD" configured)"
if [[ -z "$TOKEN" ]]; then
  BOOTSTRAP_TOKEN="$(login_with_password 123456 bootstrap)"
  [[ -n "$BOOTSTRAP_TOKEN" ]] || { echo "Jeecg 管理员登录失败"; exit 1; }
  PASSWORD_PAYLOAD="$(TARGET_PASSWORD="$ADMIN_PASSWORD" python3 - <<'PY'
import json
import os
print(json.dumps({'username': 'admin', 'password': os.environ['TARGET_PASSWORD']}))
PY
)"
  curl -fsS -X PUT -H 'Content-Type: application/json' \
    -H "X-Access-Token: $BOOTSTRAP_TOKEN" --data "$PASSWORD_PAYLOAD" \
    "$BASE/sys/user/changePassword" > "$WORK/password-change.json"
  TOKEN="$(login_with_password "$ADMIN_PASSWORD" verified)"
fi
[[ -n "$TOKEN" ]] || { echo "Jeecg 管理员密码加固验证失败"; exit 1; }

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

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${DEPLOY_ROOT:-/www/wwwroot/pla.wiki}"
BASE="${JEECG_SMOKE_BASE:-http://localhost:18080/jeecgboot}"
PLATFORM_BASE="${JEECG_SMOKE_PLATFORM_BASE:-http://localhost:18080/_wcu-api}"
ENV_FILE="${JEECG_SMOKE_ENV_FILE:-$ROOT/.env.baota}"
REDIS_CONTAINER="${JEECG_SMOKE_REDIS_CONTAINER:-lingqiong-jeecg-redis}"
WORK="${JEECG_SMOKE_WORK_DIR:-$(mktemp -d)}"
PROJECT_RESTORE_ACTIVE=0
PROJECT_RESTORE_ID=""
SERVICE_SECRET=""
TOKEN=""
mkdir -p "$WORK"

cleanup() {
  local status=$?
  set +e
  if [[ "$PROJECT_RESTORE_ACTIVE" == "1" && -n "$PROJECT_RESTORE_ID" && -n "$TOKEN" ]]; then
    curl -fsS -X PUT -H 'Content-Type: application/json' \
      -H "X-Access-Token: $TOKEN" --data-binary @"$WORK/project-restore.json" \
      "$BASE/lingqiong/projects/edit" >/dev/null || \
      echo "警告：联动回归项目自动恢复失败：$PROJECT_RESTORE_ID" >&2
  fi
  if [[ "${JEECG_SMOKE_KEEP_WORK:-0}" != "1" ]]; then
    rm -rf "$WORK"
  fi
  return "$status"
}
trap cleanup EXIT

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a
SERVICE_SECRET="${JEECG_SMOKE_SERVICE_SECRET:-${JEECG_SERVICE_SECRET:-}}"

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

  docker exec "$REDIS_CONTAINER" redis-cli --raw KEYS '*' | sort > "$before"
  curl -fsS "$BASE/sys/randomImage/$check_key" > "$WORK/captcha-$attempt.json"
  docker exec "$REDIS_CONTAINER" redis-cli --raw KEYS '*' | sort > "$after"
  redis_key="$(comm -13 "$before" "$after" | head -1)"
  [[ -n "$redis_key" ]] || return 0
  captcha="$(docker exec "$REDIS_CONTAINER" redis-cli --raw GET "$redis_key" | tr -d '"\r\n')"
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
print((data.get('result') or {}).get('token', ''))
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

PROJECT_ID="$(python3 - "$WORK/projects.json" <<'PY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as handle:
    records = (json.load(handle).get('result') or {}).get('records') or []
print(records[0].get('id', '') if records else '')
PY
)"
if [[ -n "$PROJECT_ID" ]]; then
  curl -fsS "${auth[@]}" "$BASE/lingqiong/projects/$PROJECT_ID/flow" > "$WORK/project-flow.json"
  curl -fsS "${auth[@]}" "$BASE/lingqiong/data/episodes/list?pageNo=1&pageSize=100&projectId=$PROJECT_ID" > "$WORK/project-episodes.json"

  if [[ "${JEECG_SMOKE_WRITE_THROUGH:-1}" == "1" && -n "$SERVICE_SECRET" ]]; then
    curl -fsS -H "X-Lingqiong-Service-Secret: $SERVICE_SECRET" \
      "$PLATFORM_BASE/projects/$PROJECT_ID" > "$WORK/project-platform-before.json"
    python3 - "$WORK" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
with (root / 'project-platform-before.json').open(encoding='utf-8') as handle:
    project = json.load(handle)['project']

baseline = {
    'id': project['id'],
    'name': project['name'],
    'type': project['type'],
    'aspectRatio': project['aspectRatio'],
    'goal': project['goal'],
    'style': project['style'],
}
with (root / 'project-restore.json').open('w', encoding='utf-8') as handle:
    json.dump(baseline, handle, ensure_ascii=False)
changed = dict(baseline)
changed['style'] = f"{baseline['style']} [联动回归]"
with (root / 'project-edit.json').open('w', encoding='utf-8') as handle:
    json.dump(changed, handle, ensure_ascii=False)
PY

    curl -fsS -X PUT -H 'Content-Type: application/json' \
      -H "X-Access-Token: $TOKEN" --data-binary @"$WORK/project-edit.json" \
      "$BASE/lingqiong/projects/edit" > "$WORK/project-edit-result.json"
    python3 - "$WORK/project-edit-result.json" <<'PY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as handle:
    assert json.load(handle).get('success') is True
PY
    PROJECT_RESTORE_ID="$PROJECT_ID"
    PROJECT_RESTORE_ACTIVE=1

    curl -fsS -H "X-Lingqiong-Service-Secret: $SERVICE_SECRET" \
      "$PLATFORM_BASE/projects/$PROJECT_ID" > "$WORK/project-platform-edited.json"
    python3 - "$WORK/project-platform-edited.json" <<'PY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as handle:
    project = json.load(handle)['project']
assert project['style'].endswith(' [联动回归]')
PY

    curl -fsS -X PUT -H 'Content-Type: application/json' \
      -H "X-Access-Token: $TOKEN" --data-binary @"$WORK/project-restore.json" \
      "$BASE/lingqiong/projects/edit" > "$WORK/project-restore-result.json"
    python3 - "$WORK/project-restore-result.json" <<'PY'
import json
import sys
with open(sys.argv[1], encoding='utf-8') as handle:
    assert json.load(handle).get('success') is True
PY
    PROJECT_RESTORE_ACTIVE=0

    curl -fsS -H "X-Lingqiong-Service-Secret: $SERVICE_SECRET" \
      "$PLATFORM_BASE/projects/$PROJECT_ID" > "$WORK/project-platform-restored.json"
    python3 - "$WORK" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
with (root / 'project-restore.json').open(encoding='utf-8') as handle:
    baseline = json.load(handle)
with (root / 'project-platform-restored.json').open(encoding='utf-8') as handle:
    restored = json.load(handle)['project']
for key in ('id', 'name', 'type', 'aspectRatio', 'goal', 'style'):
    assert restored[key] == baseline[key]
PY
  fi
fi

PROJECT_ID="$PROJECT_ID" \
JEECG_SMOKE_REQUIRE_OFFICIAL_WECHAT="${JEECG_SMOKE_REQUIRE_OFFICIAL_WECHAT:-1}" \
python3 - "$WORK" <<'PY'
import json
import os
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
if os.environ.get('JEECG_SMOKE_REQUIRE_OFFICIAL_WECHAT', '1') == '1':
    assert wechat.get('mode') == 'official' and wechat.get('appSecretConfigured') is True
else:
    assert wechat.get('mode') in ('official', 'local-scan')
assert not_supported.get('success') is False and not_supported.get('code') == 404

project_id = os.environ.get('PROJECT_ID', '')
if project_id:
    project_flow = load('project-flow.json')
    project_episodes = load('project-episodes.json')
    assert project_flow.get('success') is True
    assert project_flow.get('result', {}).get('project', {}).get('id') == project_id
    counts = project_flow.get('result', {}).get('counts', {})
    assert all(isinstance(counts.get(key), int) for key in (
        'episodes', 'elements', 'storyboards', 'voiceovers',
        'compositions', 'uploads', 'generationJobs'
    ))
    assert project_episodes.get('success') is True
    episode_records = project_episodes.get('result', {}).get('records', [])
    assert all(record.get('project_id') == project_id for record in episode_records)
PY

echo "LIVE_JEECG_SMOKE_OK"

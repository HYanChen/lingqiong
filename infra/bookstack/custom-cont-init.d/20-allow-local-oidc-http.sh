#!/usr/bin/with-contenv bash
set -euo pipefail

settings_file="/app/www/app/Access/Oidc/OidcProviderSettings.php"

if grep -q "lingqiong-local-oidc-http" "$settings_file" && grep -q "web|platform-api|127" "$settings_file"; then
  echo "[bookstack-oidc] Local OIDC HTTP patch already applied"
  exit 0
fi

php <<'PHP'
<?php
$path = '/app/www/app/Access/Oidc/OidcProviderSettings.php';
$content = file_get_contents($path);

$issuerFrom = <<<'SRC'
        if (!str_starts_with($this->issuer, 'https://')) {
            throw new InvalidArgumentException('Issuer value must start with https://');
        }
SRC;

$issuerTo = <<<'SRC'
        // lingqiong-local-oidc-http: allow the localhost Docker OIDC provider used by 战纪宇宙.
        if (!preg_match('#^https://#', $this->issuer) && !preg_match('#^http://(web|platform-api|127\.0\.0\.1|localhost|zhanji-gateway)(:|/|$)#', $this->issuer)) {
            throw new InvalidArgumentException('Issuer value must start with https:// unless it is a trusted local OIDC endpoint');
        }
SRC;

$endpointFrom = <<<'SRC'
            if (is_string($this->$prop) && !str_starts_with($this->$prop, 'https://')) {
                throw new InvalidArgumentException("Endpoint value for \"{$prop}\" must start with https://");
            }
SRC;

$endpointTo = <<<'SRC'
            if (is_string($this->$prop) && !preg_match('#^https://#', $this->$prop) && !preg_match('#^http://(web|platform-api|127\.0\.0\.1|localhost|zhanji-gateway)(:|/|$)#', $this->$prop)) {
                throw new InvalidArgumentException("Endpoint value for \"{$prop}\" must start with https:// unless it is a trusted local OIDC endpoint");
            }
SRC;

$content = str_replace(
    '(web|127\\.0\\.0\\.1|localhost|zhanji-gateway)',
    '(web|platform-api|127\\.0\\.0\\.1|localhost|zhanji-gateway)',
    $content
);
$content = str_replace($issuerFrom, $issuerTo, $content);
$content = str_replace($endpointFrom, $endpointTo, $content);

if (!str_contains($content, 'lingqiong-local-oidc-http') || !str_contains($content, 'web|platform-api|127')) {
    fwrite(STDERR, "Unable to apply the trusted local OIDC endpoint patch\n");
    exit(1);
}

file_put_contents($path, $content);
PHP

echo "[bookstack-oidc] Enabled local OIDC HTTP issuer support"

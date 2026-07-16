#!/usr/bin/env node

import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const localComposePath = resolve(root, "docker-compose.yml");
const baotaComposePath = resolve(root, "docker-compose.baota.yml");
const checks = [];
const failures = [];

function record(name, passed, detail = "") {
  const item = { name, passed: Boolean(passed), detail };
  checks.push(item);
  if (!item.passed) failures.push(item);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function relativeToRoot(value) {
  if (!value) return value;
  const result = relative(root, value);
  return result === "" ? "." : result.split(sep).join("/");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options
  });

  if (result.status !== 0) {
    const output = (result.stderr || result.stdout || "unknown error").trim();
    throw new Error(`${command} ${args.join(" ")} failed: ${output}`);
  }

  return result.stdout.trim();
}

function loadCompose(file, projectName, environment = {}) {
  const output = run(
    "docker",
    [
      "compose",
      "-p",
      projectName,
      "-f",
      file,
      "config",
      "--format",
      "json"
    ],
    { env: { ...process.env, ...environment } }
  );
  return JSON.parse(output);
}

function buildIdentity(service) {
  if (!service?.build) return null;
  return {
    context: relativeToRoot(service.build.context),
    dockerfile: service.build.dockerfile || "Dockerfile",
    target: service.build.target || null,
    args: service.build.args || null
  };
}

function dependencyNames(service) {
  return sorted(Object.keys(service?.depends_on || {}));
}

function imageTag(image) {
  return String(image || "").split("@sha256:", 1)[0];
}

function hasImageDigest(image) {
  return /^.+@sha256:[a-f0-9]{64}$/u.test(String(image || ""));
}

function findMount(service, target) {
  return (service?.volumes || []).find((volume) => volume.target === target);
}

function normalizeArchiveEntry(entry) {
  return entry.replace(/^\.\//u, "").replace(/\/$/u, "");
}

function collectFiles(startPath) {
  const absoluteStart = resolve(root, startPath);
  const output = [];

  function visit(absolutePath) {
    const metadata = statSync(absolutePath);
    if (metadata.isDirectory()) {
      for (const entry of readdirSync(absolutePath)) {
        if (entry === ".DS_Store") continue;
        visit(resolve(absolutePath, entry));
      }
      return;
    }
    output.push(relativeToRoot(absolutePath));
  }

  visit(absoluteStart);
  return output;
}

function isForbiddenArchiveEntry(entry) {
  const parts = entry.split("/");
  const fileName = basename(entry);
  const forbiddenRoots = new Set([
    ".git",
    ".next",
    ".pnpm-store",
    ".vscode",
    "data",
    "dist",
    "node_modules",
    "out",
    "tmp",
    "vendor",
    "work_assets"
  ]);

  if (forbiddenRoots.has(parts[0])) return true;
  if (fileName === ".DS_Store" || fileName === "tsconfig.tsbuildinfo") return true;
  if (fileName.startsWith(".env") && !fileName.endsWith(".example")) return true;
  if (/\.(?:key|pem|p12|pfx|jks|keystore)$/iu.test(fileName)) return true;
  if (/^(?:credentials|secrets?|service-account)(?:\.|$)/iu.test(fileName)) return true;
  if (/(?:private[-_]?key|id_rsa)/iu.test(fileName)) return true;
  return false;
}

function inspectReleasePackage() {
  const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "lingqiong-parity-"));
  try {
    const output = run(process.execPath, ["scripts/package-baota-release.mjs"], {
      env: {
        ...process.env,
        BAOTA_RELEASE_OUTPUT_DIR: temporaryDirectory
      }
    });
    const archivePath = output.split(/\r?\n/u).at(-1)?.trim();
    record("宝塔发布脚本成功生成隔离审计包", Boolean(archivePath));
    if (!archivePath) return;

    const archiveEntries = new Set(
      run("tar", ["-tzf", archivePath])
        .split(/\r?\n/u)
        .map(normalizeArchiveEntry)
        .filter(Boolean)
    );

    const rootBuildInputs = [
      ".dockerignore",
      ".env.baota.example",
      "Dockerfile",
      "Dockerfile.baota-local-build",
      "docker-compose.baota.yml",
      "next-env.d.ts",
      "next.config.ts",
      "package-lock.json",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "postcss.config.mjs",
      "tsconfig.json"
    ];
    const runtimeFiles = sorted([
      ...rootBuildInputs,
      ...collectFiles("src"),
      ...collectFiles("public"),
      ...collectFiles("infra"),
      ...collectFiles("scripts")
    ]);
    const missingRuntimeFiles = runtimeFiles.filter(
      (entry) => !archiveEntries.has(entry)
    );
    record(
      "发布包包含全部应用源码、静态资源、基础设施配置和运行脚本",
      missingRuntimeFiles.length === 0,
      missingRuntimeFiles.length
        ? `missing: ${missingRuntimeFiles.slice(0, 12).join(", ")}`
        : `${runtimeFiles.length} runtime files verified`
    );

    const forbiddenEntries = [...archiveEntries].filter(isForbiddenArchiveEntry);
    record(
      "发布包不包含 data、真实 .env、依赖缓存或密钥文件",
      forbiddenEntries.length === 0,
      forbiddenEntries.length
        ? `forbidden: ${forbiddenEntries.slice(0, 12).join(", ")}`
        : `${archiveEntries.size} archive entries inspected`
    );

    const packageScript = readFileSync(
      resolve(root, "scripts/package-baota-release.mjs"),
      "utf8"
    );
    record(
      "发布脚本自身持续排除持久化数据与工作产物",
      ["data", "node_modules", "work_assets", ".env"].every((value) =>
        packageScript.includes(`\"${value}\"`)
      )
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function inspectApplicationImagePolicy() {
  const dockerfiles = ["Dockerfile", "Dockerfile.baota-local-build"].map(
    (file) => readFileSync(resolve(root, file), "utf8")
  );
  const dockerignore = readFileSync(resolve(root, ".dockerignore"), "utf8");
  const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");

  record(
    "应用镜像使用 Next standalone 精确运行产物",
    nextConfig.includes('output: "standalone"') &&
      dockerfiles.every(
        (content) =>
          content.includes("/app/.next/standalone") &&
          content.includes('CMD ["node", "server.js"]')
      )
  );
  record(
    "应用镜像不再整仓复制构建容器",
    dockerfiles.every(
      (content) => !content.includes("COPY --from=builder /app ./")
    )
  );
  record(
    "standalone 镜像保留 OIDC 初始化脚本的最小数据库依赖",
    dockerfiles.every(
      (content) =>
        content.includes("/app/node_modules/mysql2") &&
        content.includes("/app/node_modules/aws-ssl-profiles") &&
        content.includes("/app/node_modules/sql-escaper") &&
        !content.includes("COPY --from=builder /app/node_modules ./node_modules")
    )
  );
  record(
    "Docker 上下文排除 Jeecg、文档、数据和本地配置",
    ["vendor", "docs", "data", ".env*", ".next"].every((entry) =>
      dockerignore.split(/\r?\n/u).includes(entry)
    )
  );
  record(
    "发布基础设施不再包含 Jeecg 构建入口",
    collectFiles("infra").every((entry) => !entry.startsWith("infra/jeecg/"))
  );
}

function audit() {
  const placeholderEnvironment = {
    ADMIN_PASSWORD: "parity-placeholder-admin-password",
    ADMIN_SECRET: "parity-placeholder-admin-secret",
    BOOKSTACK_APP_KEY:
      "base64:cGFyaXR5LXBsYWNlaG9sZGVyLWJvb2tzdGFjay1rZXk=",
    MYSQL_DATABASE: "lingqiong_parity",
    MYSQL_PASSWORD: "parity-placeholder-mysql-password",
    MYSQL_ROOT_PASSWORD: "parity-placeholder-root-password",
    MYSQL_USER: "lingqiong_parity",
    NEW_API_ACCOUNT_BRIDGE_SECRET: "parity-placeholder-bridge-secret",
    NEW_API_SESSION_SECRET: "parity-placeholder-session-secret",
    PLATFORM_AUTH_SECRET: "parity-placeholder-platform-secret",
    WCU_INTERNAL_SERVICE_SECRET: "parity-placeholder-internal-service-secret",
    WCU_INVITE_CODES: "PARITY-PLACEHOLDER",
    WCU_OIDC_CLIENT_SECRET: "parity-placeholder-oidc-secret"
  };

  const local = loadCompose(
    localComposePath,
    "lingqiong-parity-local",
    placeholderEnvironment
  );
  const baota = loadCompose(
    baotaComposePath,
    "lingqiong-parity-baota",
    placeholderEnvironment
  );
  const localServices = sorted(Object.keys(local.services || {}));
  const baotaServices = sorted(Object.keys(baota.services || {}));

  record(
    "本地与宝塔服务集合完全一致",
    sameJson(localServices, baotaServices),
    `local=${localServices.join(",")} baota=${baotaServices.join(",")}`
  );
  const retiredServices = [
    "jeecg-admin",
    "jeecg-system",
    "jeecg-redis",
    "jeecg-db-init"
  ];
  record(
    "本地与宝塔均不再启动旧 Jeecg 运行时",
    retiredServices.every(
      (serviceName) =>
        !localServices.includes(serviceName) && !baotaServices.includes(serviceName)
    )
  );

  for (const serviceName of localServices) {
    record(
      `${serviceName} 依赖拓扑一致`,
      sameJson(
        dependencyNames(local.services[serviceName]),
        dependencyNames(baota.services[serviceName])
      )
    );
  }

  for (const serviceName of ["web", "platform-api"]) {
    const localBuild = buildIdentity(local.services[serviceName]);
    const baotaBuild = buildIdentity(baota.services[serviceName]);
    record(
      `${serviceName} 使用同一构建上下文与 Dockerfile`,
      localBuild !== null && sameJson(localBuild, baotaBuild),
      `local=${JSON.stringify(localBuild)} baota=${JSON.stringify(baotaBuild)}`
    );
  }
  record(
    "宝塔 Web 与 API 复用同一应用镜像",
    Boolean(baota.services.web.image) &&
      baota.services.web.image === baota.services["platform-api"].image,
    `image=${baota.services.web.image || "missing"}`
  );
  record(
    "Web 运行时不注入内部服务密钥",
    [local, baota].every(
      (compose) =>
        !("WCU_INTERNAL_SERVICE_SECRET" in
          (compose.services.web?.environment || {}))
    )
  );
  record(
    "API 运行时独占战纪宇宙内部服务密钥",
    [local, baota].every((compose) =>
      Boolean(
        compose.services["platform-api"]?.environment
          ?.WCU_INTERNAL_SERVICE_SECRET
      )
    )
  );

  const deploymentScript = readFileSync(
    resolve(root, "scripts/deploy-baota.sh"),
    "utf8"
  );
  record(
    "宝塔部署将公网首页、登录和后台设为强制发布门禁",
    [
      'verify_public_html "/"',
      'verify_public_html "/login"',
      'verify_public_html "/admin"'
    ].every((entry) => deploymentScript.includes(entry)) &&
      !deploymentScript.includes("公网回环检查告警")
  );
  record(
    "Git 失败后的归档回退跟随当前部署分支",
    deploymentScript.includes("refs/heads/${BRANCH}")
  );
  record(
    "公网后台门禁校验战纪宇宙原生标记并拒绝 Jeecg",
    deploymentScript.includes("正在进入战纪宇宙运营后台") &&
      /if grep -Eqi 'JeecgBoot\|Jeecg'[\s\S]*?\n\s+false\nfi/u.test(
        deploymentScript
      )
  );
  record(
    "公网门禁位于切流之后并由统一错误处理执行回滚",
    deploymentScript.indexOf('CUTOVER_STARTED=1') >= 0 &&
      deploymentScript.indexOf('verify_public_html "/"') >
        deploymentScript.indexOf('CUTOVER_STARTED=1') &&
      deploymentScript.includes("trap on_error ERR") &&
      /on_error\(\)[\s\S]*?restore_previous \|\| true[\s\S]*?exit "\$status"/u.test(
        deploymentScript
      )
  );

  const dependencyServices = [
    "proxy",
    "new-api",
    "bookstack-db-init",
    "bookstack",
    "mysql"
  ];
  for (const serviceName of dependencyServices) {
    const localImage = local.services[serviceName]?.image;
    const baotaImage = baota.services[serviceName]?.image;
    record(
      `${serviceName} 依赖镜像名称与版本一致`,
      Boolean(localImage) && imageTag(localImage) === imageTag(baotaImage),
      `local=${localImage || "missing"} baota=${baotaImage || "missing"}`
    );
  }
  record(
    "宝塔全部外部依赖镜像使用 SHA-256 摘要锁定",
    dependencyServices.every((serviceName) =>
      hasImageDigest(baota.services[serviceName]?.image)
    )
  );
  record(
    "New API 使用不可漂移的 SHA-256 镜像摘要",
    hasImageDigest(local.services["new-api"]?.image),
    `image=${local.services["new-api"]?.image || "missing"}`
  );
  record(
    "网关和数据库使用明确版本标签",
    local.services.proxy?.image === "nginx:1.27-alpine" &&
      local.services.mysql?.image === "mysql:8.4"
  );

  const localNginxMount = findMount(
    local.services.proxy,
    "/etc/nginx/conf.d/default.conf"
  );
  const baotaNginxMount = findMount(
    baota.services.proxy,
    "/etc/nginx/conf.d/default.conf"
  );
  record(
    "本地与宝塔共享同一份只读 Nginx 路由配置",
    Boolean(localNginxMount && baotaNginxMount) &&
      relativeToRoot(localNginxMount.source) === "infra/nginx/default.conf" &&
      relativeToRoot(baotaNginxMount.source) === "infra/nginx/default.conf" &&
      localNginxMount.read_only === true &&
      baotaNginxMount.read_only === true
  );
  const nginxConfig = readFileSync(
    resolve(root, "infra/nginx/default.conf"),
    "utf8"
  );
  const adminLoginGuard = readFileSync(
    resolve(root, "src/lib/admin-login-guard.ts"),
    "utf8"
  );
  record(
    "宝塔代理链为后台限流传递规范化客户端地址",
    nginxConfig.includes(
      "map $http_x_forwarded_for $wcu_client_ip"
    ) &&
      nginxConfig.includes(
        "proxy_set_header X-WCU-Client-IP $wcu_client_ip;"
      ) &&
      adminLoginGuard.indexOf('request.headers.get("x-wcu-client-ip")') >= 0 &&
      adminLoginGuard.indexOf('request.headers.get("x-wcu-client-ip")') <
        adminLoginGuard.indexOf('request.headers.get("x-real-ip")')
  );

  const exactRouteEnvironment = {
    web: {
      NODE_ENV: "production",
      PLATFORM_API_INTERNAL_URL: "http://platform-api:3000/api/v1",
      PLATFORM_RUNTIME_ROLE: "web"
    },
    "platform-api": {
      MYSQL_HOST: "mysql",
      MYSQL_PORT: "3306",
      NEW_API_INTERNAL_BASE_URL: "http://new-api:3000/v1",
      NEW_API_MYSQL_DATABASE: "new_api",
      NEW_API_SERVER_BASE_URL: "http://new-api:3000",
      NODE_ENV: "production",
      PLATFORM_RUNTIME_ROLE: "api",
      WCU_OIDC_CLIENT_ID: "zhanji-bookstack",
      WCU_OIDC_ISSUER: "http://platform-api:3000/api/oidc"
    },
    bookstack: {
      DB_HOST: "mysql",
      DB_PORT: "3306",
      OIDC_CLIENT_ID: "zhanji-bookstack",
      OIDC_ISSUER: "http://platform-api:3000/api/oidc"
    }
  };

  for (const [serviceName, expected] of Object.entries(exactRouteEnvironment)) {
    for (const [environmentName, expectedValue] of Object.entries(expected)) {
      const localValue = local.services[serviceName]?.environment?.[environmentName];
      const baotaValue = baota.services[serviceName]?.environment?.[environmentName];
      record(
        `${serviceName}.${environmentName} 路由配置一致`,
        localValue === expectedValue && baotaValue === expectedValue,
        `local=${localValue ?? "missing"} baota=${baotaValue ?? "missing"}`
      );
    }
  }

  const allowedProductionOnlyEnvironment = {
    "new-api": ["SESSION_COOKIE_SECURE", "SESSION_COOKIE_TRUSTED_URL"]
  };
  for (const serviceName of localServices) {
    const localKeys = Object.keys(local.services[serviceName]?.environment || {});
    const baotaKeys = Object.keys(baota.services[serviceName]?.environment || {});
    const localOnly = localKeys.filter((key) => !baotaKeys.includes(key));
    const baotaOnly = baotaKeys.filter((key) => !localKeys.includes(key));
    record(
      `${serviceName} 环境变量键集合无意外漂移`,
      localOnly.length === 0 &&
        sameJson(
          sorted(baotaOnly),
          sorted(allowedProductionOnlyEnvironment[serviceName] || [])
        ),
      `localOnly=${localOnly.join(",") || "none"} baotaOnly=${
        baotaOnly.join(",") || "none"
      }`
    );
  }

  for (const [name, compose] of [
    ["本地", local],
    ["宝塔", baota]
  ]) {
    const baseUrl = compose.services.web?.environment?.WCU_PUBLIC_BASE_URL;
    const platformEnvironment = compose.services["platform-api"]?.environment || {};
    const bookstackEnvironment = compose.services.bookstack?.environment || {};
    const redirectUris = String(platformEnvironment.WCU_OIDC_REDIRECT_URIS || "")
      .split(",")
      .map((value) => value.trim());

    record(
      `${name}公开域名在 Web 与 API 间一致`,
      Boolean(baseUrl) && platformEnvironment.WCU_PUBLIC_BASE_URL === baseUrl
    );
    record(
      `${name}New API 管理入口派生自公开域名`,
      platformEnvironment.NEW_API_ADMIN_PUBLIC_URL === `${baseUrl}/api`
    );
    record(
      `${name}BookStack 地址派生自公开域名`,
      bookstackEnvironment.APP_URL === `${baseUrl}/bookstack`
    );
    record(
      `${name}OIDC 回调覆盖知识库和 API 账户`,
      redirectUris.includes(`${baseUrl}/bookstack/oidc/callback`) &&
        redirectUris.includes(`${baseUrl}/oauth/oidc`)
    );
  }

  const baotaNewApiEnvironment = baota.services["new-api"]?.environment || {};
  record(
    "宝塔 New API Cookie 信任域名与官网一致",
    baotaNewApiEnvironment.SESSION_COOKIE_TRUSTED_URL ===
      baota.services.web?.environment?.WCU_PUBLIC_BASE_URL &&
      baotaNewApiEnvironment.SESSION_COOKIE_SECURE === "true"
  );
  record(
    "本地与宝塔 New API 数据库 DSN 均指向同一内部库",
    [local, baota].every((compose) => {
      const dsn = compose.services["new-api"]?.environment?.SQL_DSN || "";
      return dsn.includes("@tcp(mysql:3306)/new_api?");
    })
  );

  inspectApplicationImagePolicy();
  inspectReleasePackage();
}

try {
  audit();
} catch (error) {
  record(
    "审计脚本执行完整",
    false,
    error instanceof Error ? error.message : String(error)
  );
}

for (const check of checks) {
  const marker = check.passed ? "PASS" : "FAIL";
  console.log(`[${marker}] ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
}

if (failures.length > 0) {
  console.error(
    `\n宝塔/本地一致性审计失败：${failures.length}/${checks.length} 项未通过。`
  );
  process.exit(1);
}

console.log(`\n宝塔/本地一致性审计通过：${checks.length}/${checks.length} 项。`);

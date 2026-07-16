#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const appRoot = resolve(root, "src/app");
const defaultBaseUrl = "http://localhost";
const defaultTimeoutMs = 20_000;

// Every src/app/**/page.tsx must live in exactly one category. This makes a
// newly-added user route fail the audit until its shell policy is deliberate.
const rootShellRoutes = new Set([
  "/",
  "/about",
  "/about/team/[slug]",
  "/login",
  "/register",
  "/services",
  "/skills",
  "/skills/advanced",
  "/universe",
  "/workflow",
  "/works",
  "/works/[slug]"
]);

const nestedShellRoutes = new Set([
  "/account",
  "/account/billing",
  "/create",
  "/projects",
  "/projects/[id]"
]);

const excludedRoutes = new Map([
  ["/admin", "独立运营后台"],
  ["/admin/[...legacy]", "旧后台路径统一回收至原生 /admin"],
  ["/api", "外部 API 用户端协议跳转"],
  ["/canvas", "兼容跳转页"],
  ["/knowledge", "沉浸式知识库编辑器"],
  ["/wechat-login", "微信扫码协议确认页"]
]);

const publicHtmlRoutes = [
  "/",
  "/universe",
  "/works",
  "/workflow",
  "/services",
  "/about",
  "/login",
  "/register"
];

const results = [];

function source(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function check(label, condition, detail = "") {
  const passed = Boolean(condition);
  results.push({ detail, label, passed });
  console.log(`${passed ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
}

function collectPageFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectPageFiles(absolutePath));
    } else if (entry.name === "page.tsx") {
      files.push(absolutePath);
    }
  }

  return files;
}

function pageRoute(pageFile) {
  const directory = relative(appRoot, resolve(pageFile, ".."));

  if (!directory) {
    return "/";
  }

  return `/${directory.split(sep).join("/")}`;
}

function normalizeBaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("SITE_SHELL_BASE_URL/BASE_URL 必须是有效的 http(s) 地址");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("SITE_SHELL_BASE_URL/BASE_URL 只支持 http(s) 协议");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url;
}

function requestTimeoutMs() {
  const parsed = Number.parseInt(process.env.SITE_SHELL_TIMEOUT_MS || "", 10);
  return Number.isFinite(parsed) && parsed >= 1_000 ? parsed : defaultTimeoutMs;
}

async function requestHtml(baseUrl, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs());

  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: {
        Accept: "text/html",
        "User-Agent": "lingqiong-site-shell-smoke/1.0"
      },
      redirect: "manual",
      signal: controller.signal
    });
    return { html: await response.text(), response };
  } finally {
    clearTimeout(timer);
  }
}

function assertShellHtml(path, html, response) {
  const headerIndex = html.indexOf('aria-label="\u6218\u7eaa\u5b87\u5b99\u9996\u9875"');
  const navigationIndex = html.indexOf('aria-label="\u4e3b\u5bfc\u822a"');
  const mainIndex = html.indexOf("<main");
  const footerIndex = html.indexOf("<footer");
  const copyrightIndex = html.indexOf("Copyright \u00a9");

  check(`${path} 返回可渲染页面`, response.status === 200, `HTTP ${response.status}`);
  check(`${path} 包含官网品牌头部`, headerIndex >= 0);
  check(`${path} 包含官网主导航`, navigationIndex >= 0);
  check(`${path} 包含官网页脚`, footerIndex >= 0 && copyrightIndex >= 0);
  check(
    `${path} 壳层顺序为头部、主内容、页脚`,
    headerIndex >= 0 && mainIndex > headerIndex && footerIndex > mainIndex
  );
}

function firstInternalDetailPath(html, prefix) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = html.match(new RegExp(`href="(${escapedPrefix}[^"?#]+)`, "u"));
  return match?.[1] ? match[1].replaceAll("&amp;", "&") : "";
}

function auditStaticArchitecture() {
  const pageRoutes = collectPageFiles(appRoot).map(pageRoute).sort();
  const classifiedRoutes = new Set([
    ...rootShellRoutes,
    ...nestedShellRoutes,
    ...excludedRoutes.keys()
  ]);
  const unknownRoutes = pageRoutes.filter((route) => !classifiedRoutes.has(route));
  const staleClassifications = [...classifiedRoutes].filter(
    (route) => !pageRoutes.includes(route)
  );

  check(
    "src/app 全部用户可见页面已明确壳层政策",
    unknownRoutes.length === 0 && staleClassifications.length === 0,
    unknownRoutes.length
      ? `未分类: ${unknownRoutes.join(", ")}`
      : staleClassifications.length
        ? `分类已过期: ${staleClassifications.join(", ")}`
        : `${pageRoutes.length} 个页面路由`
  );

  const rootLayout = source("src/app/layout.tsx");
  const appShell = source("src/components/app-shell.tsx");
  const appShellBoundary = source("src/components/app-shell-boundary.tsx");
  const siteHeader = source("src/components/site-header.tsx");
  const siteFooter = source("src/components/site-footer.tsx");
  const proxy = source("src/proxy.ts");

  check(
    "RootLayout 的官网路由统一经由 AppShell 渲染",
    rootLayout.includes("const data = await getPlatformSiteData()") &&
      rootLayout.includes("<AppShell data={data}") &&
      appShell.includes("<SiteHeader") &&
      appShell.includes("<SiteFooter")
  );
  check(
    "AppShell 在客户端导航后依然使用当前 pathname 判定壳层",
    appShell.includes("<AppShellBoundary") &&
      appShellBoundary.includes('"use client"') &&
      appShellBoundary.includes("usePathname") &&
      appShellBoundary.includes("usesOwnOrStandaloneShell(pathname)")
  );
  check(
    "路由代理将真实 pathname 传入服务端元数据判定",
    proxy.includes('requestHeaders.set("x-wcu-pathname", pathname)') &&
      rootLayout.includes('headerStore.get("x-wcu-pathname")')
  );
  check(
    "官网头部固定在高层级并提供品牌主导航",
    siteHeader.includes('aria-label="\u6218\u7eaa\u5b87\u5b99\u9996\u9875"') &&
      siteHeader.includes('aria-label="\u4e3b\u5bfc\u822a"') &&
      siteHeader.includes("fixed left-0 right-0 top-0 z-50") &&
      siteHeader.includes('data-site-shell="header"')
  );
  check(
    "官网页脚保留语义化 footer 和品牌版权信息",
    siteFooter.includes("<footer") &&
      siteFooter.includes("Copyright \u00a9") &&
      siteFooter.includes('data-site-shell="footer"')
  );

  const nestedLayouts = [
    ["account", "src/app/account/layout.tsx"],
    ["create", "src/app/create/layout.tsx"],
    ["projects", "src/app/projects/layout.tsx"]
  ];

  for (const [prefix, layoutPath] of nestedLayouts) {
    const nestedLayout = source(layoutPath);
    check(
      `/${prefix} 独立布局同时包含官网头部与页脚`,
      appShellBoundary.includes(`"/${prefix}"`) &&
        nestedLayout.includes("<SiteHeader") &&
        nestedLayout.includes("<SiteFooter")
    );
  }

  check(
    "运营后台、知识库、微信协议页和 API 入口不会重复渲染官网壳层",
    ["/admin", "/knowledge", "/wechat-login"].every((prefix) =>
      appShellBoundary.includes(`"${prefix}"`)
    ) && appShellBoundary.includes('"/api"')
  );

  check(
    "仅独立协议入口、后台、跳转页与沉浸式编辑器允许无官网壳层",
    [...excludedRoutes].every(([route, reason]) => route && reason),
    [...excludedRoutes].map(([route, reason]) => `${route}=${reason}`).join("; ")
  );
}

async function auditRuntimeHtml() {
  const baseUrl = normalizeBaseUrl(
    process.env.SITE_SHELL_BASE_URL || process.env.BASE_URL || defaultBaseUrl
  );
  const htmlByPath = new Map();

  for (const path of publicHtmlRoutes) {
    try {
      const result = await requestHtml(baseUrl, path);
      htmlByPath.set(path, result.html);
      assertShellHtml(path, result.html, result.response);
    } catch (error) {
      check(
        `${path} 官网壳层请求成功`,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const detailCandidates = [
    ["/works", "/works/"],
    ["/about", "/about/team/"]
  ];

  for (const [listingPath, detailPrefix] of detailCandidates) {
    const listingHtml = htmlByPath.get(listingPath) || "";
    const detailPath = firstInternalDetailPath(listingHtml, detailPrefix);

    check(
      `${listingPath} 至少提供一个 ${detailPrefix} 详情入口`,
      Boolean(detailPath)
    );

    if (!detailPath) {
      continue;
    }

    try {
      const result = await requestHtml(baseUrl, detailPath);
      assertShellHtml(detailPath, result.html, result.response);
    } catch (error) {
      check(
        `${detailPath} 官网壳层请求成功`,
        false,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

async function main() {
  auditStaticArchitecture();
  await auditRuntimeHtml();

  const failed = results.filter((item) => !item.passed);

  if (failed.length) {
    console.error(`SITE_SHELL_AUDIT_FAILED ${results.length - failed.length}/${results.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(`SITE_SHELL_AUDIT_OK ${results.length}/${results.length}`);
}

await main();

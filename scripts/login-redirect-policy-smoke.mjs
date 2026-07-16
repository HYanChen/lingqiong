#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { frontAccountPath, frontLoginDestination, safeFrontRedirectPath } =
  require("../src/lib/safe-redirect.ts");

const cases = [
  {
    actual: frontLoginDestination(null),
    expected: frontAccountPath,
    name: "空 next 默认进入用户中心"
  },
  {
    actual: frontLoginDestination("/projects"),
    expected: frontAccountPath,
    name: "普通受保护页登录后进入用户中心"
  },
  {
    actual: frontLoginDestination("/_wcu-api/oidc/authorize?client_id=bookstack"),
    expected: "/_wcu-api/oidc/authorize?client_id=bookstack",
    name: "OIDC 协议交接保留"
  },
  {
    actual: frontLoginDestination("/bookstack/oidc/login"),
    expected: "/bookstack/oidc/login",
    name: "BookStack 协议交接保留"
  },
  {
    actual: safeFrontRedirectPath("/admin"),
    expected: frontAccountPath,
    name: "前台登录拒绝后台目标"
  },
  {
    actual: frontLoginDestination("//evil.example/account"),
    expected: frontAccountPath,
    name: "拒绝跨域目标"
  }
];

for (const testCase of cases) {
  assert.equal(testCase.actual, testCase.expected, testCase.name);
}

console.log(`LOGIN_REDIRECT_POLICY_SUCCESS ${cases.length}/${cases.length}`);

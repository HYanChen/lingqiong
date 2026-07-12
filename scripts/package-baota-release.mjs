#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outputDir = process.env.BAOTA_RELEASE_OUTPUT_DIR
  ? resolve(root, process.env.BAOTA_RELEASE_OUTPUT_DIR)
  : resolve(root, "work_assets");
const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
const output = resolve(outputDir, `lingqiong-baota-release-${timestamp}.tar.gz`);

mkdirSync(outputDir, { recursive: true });

const exclusions = [
  ".git",
  ".next",
  ".pnpm-store",
  ".vscode",
  "data",
  "node_modules",
  "out",
  "dist",
  "vendor",
  "work_assets",
  ".env",
  ".env.local",
  ".env.baota",
  ".env.production",
  ".DS_Store",
  "*/.DS_Store",
  "tmp",
  "tsconfig.tsbuildinfo"
];

const result = spawnSync(
  "tar",
  [
    "--no-xattrs",
    "-czf",
    output,
    ...exclusions.flatMap((value) => ["--exclude", value]),
    "."
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1"
    }
  }
);

if (result.status !== 0) {
  console.error(result.stderr || "宝塔发布包生成失败。");
  process.exit(result.status || 1);
}

console.log(output);

#!/usr/bin/env node

// Sync check: asserts the @opencode-ai/sdk version pin in
// <chisl-root>/opencode-sdk-version.json matches the devDependency in
// AionUi/package.json. Both sides must agree; if they drift, CI fails.
//
// Usage:
//   node scripts/sync-opencode-types.js          # print ok
//   node scripts/sync-opencode-types.js --check   # exit 0 on match, exit 2 on drift

const fs = require("fs");
const path = require("path");

// ── Paths ────────────────────────────────────────────────────────────────────
// This script lives at AionUi/scripts/sync-opencode-types.js.
// chisl-root is one level above AionUi.
const scriptDir = path.dirname(__filename);
const aionUiDir = path.resolve(scriptDir, "..");
const chislRoot = path.resolve(aionUiDir, "..");

const versionJsonPath = path.join(chislRoot, "opencode-sdk-version.json");
const packageJsonPath = path.join(aionUiDir, "package.json");

// ── Read & parse ─────────────────────────────────────────────────────────────
if (!fs.existsSync(versionJsonPath)) {
  console.error(`Missing ${versionJsonPath} — create it per PROTOCOL.md`);
  process.exit(2);
}

const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const pinnedPackage = versionJson.package;
const pinnedVersion = versionJson.version;

if (!pinnedPackage || !pinnedVersion) {
  console.error(`${versionJsonPath} must contain "package" and "version" fields`);
  process.exit(2);
}

const devDeps = packageJson.devDependencies || {};
const installedVersion = devDeps[pinnedPackage];

// ── Check ────────────────────────────────────────────────────────────────────
const isCheck = process.argv.includes("--check");

if (!installedVersion) {
  const msg = `AionUi/package.json devDependencies missing "${pinnedPackage}" — add it at version "${pinnedVersion}"`;
  if (isCheck) {
    console.error(msg);
    process.exit(2);
  }
  console.error(`WARNING: ${msg}`);
  process.exit(0);
}

if (installedVersion !== pinnedVersion) {
  const msg = `Version drift: ${pinnedPackage} is "${installedVersion}" in package.json but "${pinnedVersion}" in opencode-sdk-version.json`;
  if (isCheck) {
    console.error(msg);
    process.exit(2);
  }
  console.error(`WARNING: ${msg}`);
  process.exit(0);
}

// Versions match.
if (isCheck) {
  console.log(`ok: ${pinnedPackage}@${pinnedVersion} pin matches`);
} else {
  console.log(`ok: ${pinnedPackage}@${pinnedVersion}`);
}
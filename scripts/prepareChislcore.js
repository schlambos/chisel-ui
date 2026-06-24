/**
 * CLI wrapper for prepare-chislcore.
 *
 * Reads environment variables and invokes the shared module.
 *
 * Version resolution order:
 *  1. AIONUI_BACKEND_VERSION env (for ad-hoc overrides)
 *  2. "chislcoreVersion" field in repo-root package.json (the pin)
 *  3. 'latest' (fallback; not recommended for reproducible builds)
 *
 * Environment variables:
 *  - AIONUI_BACKEND_VERSION: override the pinned version
 *  - AIONUI_BACKEND_ARCH: target architecture (default: process.arch)
 *  - GH_TOKEN / GITHUB_TOKEN: GitHub API token (for rate limiting)
 */

const path = require('path');
const { prepareChislcore } = require('../packages/shared-scripts/src/prepare-chislcore.js');
const { resolveChislcoreVersion } = require('./resolveChislcoreVersion.js');

const projectRoot = path.resolve(__dirname, '..');
const platform = process.platform;
// Support cross-compilation: AIONUI_BACKEND_ARCH > npm_config_target_arch > process.arch
const arch = process.env.AIONUI_BACKEND_ARCH || process.env.npm_config_target_arch || process.arch;
const version = resolveChislcoreVersion(projectRoot);

try {
  prepareChislcore({ projectRoot, platform, arch, version });
} catch (error) {
  console.error('❌ prepareChislcore failed:', error.message);
  process.exit(1);
}

module.exports = function () {
  try {
    return prepareChislcore({ projectRoot, platform, arch, version });
  } catch (error) {
    console.error('❌ prepareChislcore failed:', error.message);
    throw error;
  }
};
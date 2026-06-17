/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as os from 'node:os';

export const PROTECTED_PATH_GLOBS: readonly string[] = [
  '~/.ssh/**',
  '**/.env',
  '**/.env.*',
  '**/credentials*',
  '**/*.pem',
  '**/id_rsa',
  '**/id_ed25519',
];

const DOUBLE_STAR_SLASH = '\x00DSS\x00';
const DOUBLE_STAR = '\x00DS\x00';

function globToRegExp(pattern: string): RegExp {
  const homeDir = os.homedir();
  const hasTilde = pattern.startsWith('~/');

  let src = hasTilde ? `${homeDir}/${pattern.slice(2)}` : pattern;

  src = src.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  src = src.replace(/\*\*\//g, DOUBLE_STAR_SLASH);
  src = src.replace(/\*\*/g, DOUBLE_STAR);
  src = src.replace(/\*/g, '[^/]*');
  src = src.replace(/\?/g, '.');
  src = src.replace(new RegExp(DOUBLE_STAR_SLASH, 'g'), '(?:.*\\/)?');
  src = src.replace(new RegExp(DOUBLE_STAR, 'g'), '.*');

  if (hasTilde) {
    const homeEsc = homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedHomePrefix = homeEsc + '/';
    if (src.startsWith(escapedHomePrefix)) {
      const rest = src.slice(escapedHomePrefix.length - 1);
      src = `(?:~|${homeEsc})${rest}`;
    }
  }

  return new RegExp(`^${src}$`);
}

const PROTECTED_REGEXES: readonly RegExp[] = PROTECTED_PATH_GLOBS.map(globToRegExp);

export function isPatternProtected(pattern: string): boolean {
  return PROTECTED_REGEXES.some((re) => re.test(pattern));
}

export function requestTouchesProtectedPath(patterns: string[]): boolean {
  return patterns.some((p) => PROTECTED_REGEXES.some((re) => re.test(p)));
}

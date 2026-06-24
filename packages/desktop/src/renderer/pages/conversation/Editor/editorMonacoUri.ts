/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as monaco from '@chisl/editor-monaco';
import type { OpenBuffer } from './types';

const PATH_SEPARATOR_RE = /[\\:]/g;

/**
 * Normalize a file path for identity comparison only.
 * On macOS (case-insensitive filesystem), lowercases the path so that
 * `Foo.ts` and `foo.ts` resolve to the same buffer/tab. On other
 * platforms the path is returned unchanged.
 *
 * CRITICAL: Never use this for filesystem IO (read, write, save) or
 * display — only for buffer-key dedup, tab matching, and URI matching.
 */
export const fileIdentityKey = (filePath: string): string => {
  if (typeof process !== 'undefined' && process.platform === 'darwin') {
    return filePath.toLowerCase();
  }
  return filePath;
};

export const uriForBuffer = (buffer: OpenBuffer): monaco.Uri => {
  if (buffer.filePath) {
    const normalized = buffer.filePath.replace(/\\/g, '/').replace(/^([a-zA-Z]):/, '/$1:');
    return monaco.Uri.parse(`file://${normalized.startsWith('/') ? '' : '/'}${normalized}`);
  }
  return monaco.Uri.parse(`inmemory://untitled/${buffer.key.replace(PATH_SEPARATOR_RE, '_')}`);
};

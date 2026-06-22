/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import styles from './PendingEditsPanel.module.css';

type HunkRowProps = {
  /** Zero-based hunk index within the file's patch */
  hunkIndex: number;
  /** The raw hunk text (the @@ ... @@ header line + body lines) */
  hunkText: string;
  /** Whether a revert is in flight for this hunk */
  reverting: boolean;
  /** Invoked when the user clicks revert for this hunk */
  onRevert: (hunkIndex: number) => void;
};

/** Classify a diff line by its leading character. */
function diffLineKind(line: string): 'added' | 'removed' | 'context' {
  if (line.startsWith('+')) return 'added';
  if (line.startsWith('-')) return 'removed';
  return 'context';
}

const HunkRow: React.FC<HunkRowProps> = ({ hunkIndex, hunkText, reverting, onRevert }) => {
  const { headerLine, bodyLines } = useMemo(() => {
    const lines = hunkText.split('\n');
    // First line starting with @@ is the header; everything after is body.
    const header = lines[0] ?? '';
    const body = lines.slice(1).filter((l) => l.length > 0);
    return { headerLine: header, bodyLines: body };
  }, [hunkText]);

  return (
    <div className={styles.hunkRow}>
      <div className={styles.hunkHeader}>{headerLine}</div>
      <div className='flex items-start gap-8px'>
        <pre className={`${styles.diffBody} flex-1 min-w-0`}>
          {bodyLines.map((line, i) => {
            const kind = diffLineKind(line);
            const className =
              kind === 'added'
                ? styles.lineAdded
                : kind === 'removed'
                  ? styles.lineRemoved
                  : styles.lineContext;
            return (
              <div key={i} className={className}>
                {line}
              </div>
            );
          })}
        </pre>
        <Button
          size='mini'
          type='text'
          status='danger'
          loading={reverting}
          disabled={reverting}
          onClick={() => onRevert(hunkIndex)}
        >
          Revert hunk
        </Button>
      </div>
    </div>
  );
};

export default HunkRow;

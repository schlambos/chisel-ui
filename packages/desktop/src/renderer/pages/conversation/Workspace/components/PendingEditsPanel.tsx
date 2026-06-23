/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import { Undo } from '@icon-park/react';
import type { EditInverse } from '@/common/types/agent/editInverseTypes';
import React, { useCallback, useMemo, useState } from 'react';
import HunkRow from './HunkRow';
import styles from './PendingEditsPanel.module.css';

type PendingEditsPanelProps = {
  pendingEdits: EditInverse[];
  revertFile: (toolCallId: string) => void | Promise<void>;
  revertHunk: (toolCallId: string, hunkIndex: number) => void | Promise<void>;
};

/** Split a unified diff patch into individual hunks.
 *  Each hunk starts at an `@@` line and includes everything
 *  up to the next `@@` line. Leading `---`/`+++` headers are ignored. */
function splitPatchIntoHunks(patch: string): Array<{ index: number; text: string }> {
  const lines = patch.split('\n');
  const hunks: Array<{ index: number; text: string }> = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (current) hunks.push({ index: hunks.length, text: current.join('\n') });
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) hunks.push({ index: hunks.length, text: current.join('\n') });
  return hunks;
}

/** Minimal relative-time formatter — no date library required. */
function formatRelativeTime(createdAtMs: number): string {
  const diffMs = Date.now() - createdAtMs;
  if (diffMs < 60_000) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Extract the basename and directory from a file path. */
function splitFilePath(filePath: string): { basename: string; dir: string } {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) return { basename: filePath, dir: '' };
  return { basename: filePath.slice(lastSlash + 1), dir: filePath.slice(0, lastSlash + 1) };
}

const PendingEditsPanel: React.FC<PendingEditsPanelProps> = ({ pendingEdits, revertFile, revertHunk }) => {
  // Track in-flight revert operations by composite key.
  // Hunk key: `${toolCallId}:${hunkIndex}`, file key: `${toolCallId}:file`
  const [revertingKeys, setRevertingKeys] = useState<Set<string>>(() => new Set());

  const handleRevertFile = useCallback(
    async (toolCallId: string) => {
      const key = `${toolCallId}:file`;
      setRevertingKeys((prev) => new Set(prev).add(key));
      try {
        await revertFile(toolCallId);
      } finally {
        setRevertingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [revertFile]
  );

  const handleRevertHunk = useCallback(
    async (toolCallId: string, hunkIndex: number) => {
      const key = `${toolCallId}:${hunkIndex}`;
      setRevertingKeys((prev) => new Set(prev).add(key));
      try {
        await revertHunk(toolCallId, hunkIndex);
      } finally {
        setRevertingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [revertHunk]
  );

  if (pendingEdits.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-t-tertiary text-12px px-16px text-center gap-8px'>
        <Undo theme='outline' size='28' />
        <span>No pending edits to revert.</span>
        <span className='text-t-tertiary text-11px'>
          Edits made by the agent will appear here so you can undo them hunk by hunk.
        </span>
      </div>
    );
  }

  return (
    <div className='h-full overflow-y-auto px-12px py-8px'>
      {pendingEdits.map((edit) => (
        <FileEditCard
          key={edit.tool_call_id}
          edit={edit}
          revertingKeys={revertingKeys}
          onRevertFile={handleRevertFile}
          onRevertHunk={handleRevertHunk}
        />
      ))}
    </div>
  );
};

type FileEditCardProps = {
  edit: EditInverse;
  revertingKeys: Set<string>;
  onRevertFile: (toolCallId: string) => Promise<void>;
  onRevertHunk: (toolCallId: string, hunkIndex: number) => Promise<void>;
};

const FileEditCard: React.FC<FileEditCardProps> = ({ edit, revertingKeys, onRevertFile, onRevertHunk }) => {
  const hunks = useMemo(() => splitPatchIntoHunks(edit.patch), [edit.patch]);
  const { basename, dir } = splitFilePath(edit.file_path);
  const fileReverting = revertingKeys.has(`${edit.tool_call_id}:file`);

  return (
    <div className={styles.fileCard}>
      <div className='flex items-center justify-between gap-8px mb-4px'>
        <div className='flex-1 min-w-0 text-13px font-medium truncate'>
          {dir && <span className='text-t-tertiary'>{dir}</span>}
          <span className='text-t-primary'>{basename}</span>
          <span className='text-t-tertiary text-11px ml-8px'>{formatRelativeTime(edit.created_at)}</span>
        </div>
        <Button
          size='small'
          type='text'
          status='danger'
          loading={fileReverting}
          disabled={fileReverting}
          onClick={() => void onRevertFile(edit.tool_call_id)}
          icon={<Undo theme='outline' size='14' />}
        >
          Revert file
        </Button>
      </div>
      {hunks.map((hunk) => (
        <HunkRow
          key={hunk.index}
          hunkIndex={hunk.index}
          hunkText={hunk.text}
          reverting={revertingKeys.has(`${edit.tool_call_id}:${hunk.index}`)}
          onRevert={(idx) => void onRevertHunk(edit.tool_call_id, idx)}
        />
      ))}
    </div>
  );
};

export default PendingEditsPanel;

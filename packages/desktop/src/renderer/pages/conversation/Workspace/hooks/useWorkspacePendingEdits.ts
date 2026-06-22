/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { EditInverse, RevertHunkResponse } from '@/common/types/agent/editInverseTypes';
import { useCallback, useEffect, useState } from 'react';

export type UseWorkspacePendingEditsReturn = {
  pendingEdits: EditInverse[];
  hasPendingEdits: boolean;
  revertHunk: (tool_call_id: string, hunk_index: number) => Promise<void>;
  revertFile: (tool_call_id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useWorkspacePendingEdits(conversation_id: string | undefined): UseWorkspacePendingEditsReturn {
  const [pendingEdits, setPendingEdits] = useState<EditInverse[]>([]);

  const refresh = useCallback(async () => {
    if (!conversation_id) {
      setPendingEdits([]);
      return;
    }
    try {
      const list = await ipcBridge.conversation.editInverses.list.invoke({ conversation_id });
      setPendingEdits(list ?? []);
    } catch (error) {
      console.error('[useWorkspacePendingEdits] Failed to list edit inverses:', error);
    }
  }, [conversation_id]);

  // Seed initial data on mount / conversation_id change.
  useEffect(() => {
    if (!conversation_id) {
      setPendingEdits([]);
      return;
    }
    let cancelled = false;
    void ipcBridge.conversation.editInverses.list
      .invoke({ conversation_id })
      .then((list) => {
        if (cancelled) return;
        setPendingEdits(list ?? []);
      })
      .catch((error) => {
        console.error('[useWorkspacePendingEdits] Failed to list edit inverses:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation_id]);

  const revertFile = useCallback(
    async (tool_call_id: string) => {
      if (!conversation_id) return;
      await ipcBridge.conversation.editInverses.revertFile.invoke({ conversation_id, tool_call_id });
      setPendingEdits((prev) => prev.filter((edit) => edit.tool_call_id !== tool_call_id));
    },
    [conversation_id]
  );

  const revertHunk = useCallback(
    async (tool_call_id: string, hunk_index: number) => {
      if (!conversation_id) return;
      const response: RevertHunkResponse = await ipcBridge.conversation.editInverses.revertHunk.invoke({
        conversation_id,
        tool_call_id,
        hunk_index,
      });
      if (response.remaining_hunks === 0) {
        setPendingEdits((prev) => prev.filter((edit) => edit.tool_call_id !== tool_call_id));
      } else {
        await refresh();
      }
    },
    [conversation_id, refresh]
  );

  const hasPendingEdits = pendingEdits.length > 0;

  // NOTE: No `dispatchWorkspaceHasPendingEditsEvent` helper exists in
  // workspaceEvents.ts yet. When one is added, wire a useEffect here with a
  // prevHasPendingEditsRef that dispatches on hasPendingEdits changes —
  // mirroring the pattern in useWorkspaceApprovals.

  return { pendingEdits, hasPendingEdits, revertHunk, revertFile, refresh };
}

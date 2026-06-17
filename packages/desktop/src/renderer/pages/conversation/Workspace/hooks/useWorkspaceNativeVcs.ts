/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { GitFileChange } from '@/common/types/git/gitTypes';
import { useCallback, useState, useRef, useEffect } from 'react';

export type WorkspaceVcsPatch = {
  relative_path: string;
  patch: string;
  additions: number;
  deletions: number;
  operation: string;
};

export type WorkspaceVcsResponse = {
  mode: string;
  is_tracked: boolean;
  summary: { files_changed: number; additions: number; deletions: number };
  patches: WorkspaceVcsPatch[];
};

type UseWorkspaceNativeVcsResult = {
  data: WorkspaceVcsResponse | null;
  loading: boolean;
  error: string | null;
  refresh: (conversation_id: string) => Promise<void>;
  initRepo: (conversation_id: string) => Promise<void>;
  mapPatchesToGitChanges: (patches: WorkspaceVcsPatch[]) => GitFileChange[];
};

/**
 * Hook for T18.1 native workspace VCS (snapshot baseline).
 * Fetches /workspace/vcs and maps patches to GitFileChange[] for GitChangeList.
 */
export const useWorkspaceNativeVcs = (): UseWorkspaceNativeVcsResult => {
  const [data, setData] = useState<WorkspaceVcsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);

  const refresh = useCallback(async (conversation_id: string) => {
    conversationIdRef.current = conversation_id;
    setLoading(true);
    setError(null);
    try {
      const res = await ipcBridge.conversation.getWorkspaceVcs.invoke({ conversation_id });
      if (conversationIdRef.current !== conversation_id) return;
      setData(res);
    } catch (err: any) {
      if (conversationIdRef.current !== conversation_id) return;
      setError(err.message || 'Failed to fetch workspace VCS');
      setData(null);
    } finally {
      if (conversationIdRef.current === conversation_id) setLoading(false);
    }
  }, []);

  const initRepo = useCallback(
    async (conversation_id: string) => {
      conversationIdRef.current = conversation_id;
      setLoading(true);
      setError(null);
      try {
        await ipcBridge.conversation.initWorkspaceVcs.invoke({ conversation_id });
        // Refresh after init to get the new git state
        await refresh(conversation_id);
      } catch (err: any) {
        if (conversationIdRef.current === conversation_id) {
          setError(err.message || 'Failed to initialize workspace VCS');
        }
      } finally {
        if (conversationIdRef.current === conversation_id) setLoading(false);
      }
    },
    [refresh]
  );

  /**
   * Map backend FileDiffEntryResponse to GitFileChange for GitChangeList.
   * operation: Create->added, Modify->modified, Delete->deleted.
   */
  const mapPatchesToGitChanges = useCallback((patches: WorkspaceVcsPatch[]): GitFileChange[] => {
    const statusMap: Record<string, 'added' | 'modified' | 'deleted'> = {
      Create: 'added',
      Modify: 'modified',
      Delete: 'deleted',
    };

    return patches.map((p) => ({
      path: p.relative_path,
      relativePath: p.relative_path,
      status: statusMap[p.operation] || 'modified',
      additions: p.additions,
      deletions: p.deletions,
      binary: false,
    }));
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    initRepo,
    mapPatchesToGitChanges,
  };
};

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useConversationContextSafe } from '@/renderer/hooks/context/ConversationContext';
import type { ApprovalRule } from '@process/services/approval/types';
import { useCallback, useEffect, useState } from 'react';

type UseApprovalRulesForSessionReturn = {
  rules: ApprovalRule[];
  hasRules: boolean;
  hasSession: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteRule: (id: string) => Promise<boolean>;
};

export function useApprovalRulesForSession(): UseApprovalRulesForSessionReturn {
  const context = useConversationContextSafe();
  const sessionId = typeof context?.extra?.sessionKey === 'string' ? context.extra.sessionKey : undefined;

  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sessionId) {
      setRules([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await ipcBridge.approvalRules.listForSession.invoke({ sessionId });
      if (result.success && Array.isArray(result.data)) {
        setRules(result.data);
      } else {
        setError(result.msg || 'Failed to load rules');
        setRules([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const deleteRule = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        if (!sessionId) return false;
        const result = await ipcBridge.approvalRules.delete.invoke({ id, sessionId });
        if (result.success && result.data?.deleted) {
          await refetch();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [refetch, sessionId]
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const hasRules = rules.length > 0;
  const hasSession = Boolean(sessionId);

  return { rules, hasRules, hasSession, loading, error, refetch, deleteRule };
}

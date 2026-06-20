/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IConfirmation } from '@/common/chat/chatLib';
import { useConversationContextSafe } from '@/renderer/hooks/context/ConversationContext';
import { dispatchWorkspaceHasApprovalsEvent } from '@/renderer/utils/workspace/workspaceEvents';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A pending approval normalized for the workspace Approvals tab.
 *
 * IMPORTANT (verified against the backend): remote/OpenCode permission prompts
 * — including the local-fs `run_shell` approvals — are emitted as
 * `AgentStreamEvent::AcpPermission(Confirmation)`. Because that enum is
 * `#[serde(untagged)]`, the wire payload is a bare `Confirmation`/IConfirmation
 * object: `{ call_id, description, options: [{ label, value, params? }], ... }`
 * — NOT the ACP `{ tool_call, options:[{option_id}] }` shape. The wire `type`
 * is still `"acp_permission"` (the enum variant name), which the chat reducer
 * rewrites to `"permission"` for inline display.
 *
 * So the tab listens for BOTH `acp_permission` and `permission` stream events,
 * treats `data` as `IConfirmation`, and answers via `confirmation.confirm`
 * (call_id + `{ value }`) — the same path the old inline card used.
 *
 * The tab surfaces ALL pending confirmations (permission approvals, OpenCode
 * questions with action === 'question', and other confirmation types) EXCEPT MCP
 * elicitations, which stay inline in the message list because they require
 * schema-driven forms that parse `options[0].params.schema` and submit
 * `{ value: 'submit', payload }`.
 */
export type WorkspaceApproval = IConfirmation<unknown>;

type ResponseStreamMessage = {
  type: string;
  conversation_id: string;
  msg_id?: string;
  id?: string;
  data?: unknown;
};

type UseWorkspaceApprovalsReturn = {
  approvals: WorkspaceApproval[];
  hasApprovals: boolean;
  /** Answer a pending approval; removes it from the list on success. */
  respond: (approval: WorkspaceApproval, value: string, params?: Record<string, string>) => Promise<void>;
};

function isTabEligible(c: WorkspaceApproval | undefined): c is WorkspaceApproval {
  return Boolean(c && c.call_id && c.command_type !== 'mcp_elicitation');
}

/**
 * Permission prompts (action !== 'question') are eligible for auto-accept /
 * auto-deny via the JS approval evaluator. Question prompts and other
 * confirmation types must always be shown to the user.
 */
function isAutoEvaluatable(c: WorkspaceApproval): boolean {
  return c.action !== 'question' && c.command_type !== 'mcp_elicitation';
}

/**
 * Extract the structured `patterns` array from the confirmation's description
 * meta marker (P1.2a `[[chisl-meta:{...}]]` tail). The evaluator expects a
 * `patterns` array; when no marker is present we fall back to an empty array
 * and let the evaluator match on `permission` / `metadata` alone.
 */
const META_MARKER_RE = /\[\[chisl-meta:(\{[\s\S]*?\})\]\]$/;

function extractPatterns(description: string | undefined): string[] {
  if (!description) return [];
  const m = META_MARKER_RE.exec(description);
  if (!m || !m[1]) return [];
  try {
    const parsed = JSON.parse(m[1]) as Record<string, unknown>;
    if (Array.isArray(parsed['patterns'])) {
      return parsed['patterns'].filter((p): p is string => typeof p === 'string');
    }
  } catch {
    // Malformed marker — fall through to empty patterns.
  }
  return [];
}

export function useWorkspaceApprovals(conversation_id: string | undefined): UseWorkspaceApprovalsReturn {
  const context = useConversationContextSafe();
  const sessionId = typeof context?.extra?.sessionKey === 'string' ? context.extra.sessionKey : undefined;
  const workspaceRef = context?.workspace;

  const [approvals, setApprovals] = useState<WorkspaceApproval[]>([]);
  const prevHasRef = useRef(false);
  /** call_ids we've already auto-evaluated, to avoid double-evaluating re-broadcasts. */
  const evaluatedRef = useRef<Set<string>>(new Set());

  // Seed + reconcile from the backend-authoritative confirmation list, and
  // reset whenever the conversation changes.
  useEffect(() => {
    if (!conversation_id) {
      setApprovals([]);
      return;
    }
    let cancelled = false;
    void ipcBridge.conversation.confirmation.list
      .invoke({ conversation_id })
      .then((list) => {
        if (cancelled) return;
        setApprovals((list ?? []).filter(isTabEligible));
      })
      .catch((error) => {
        console.error('[useWorkspaceApprovals] Failed to list confirmations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation_id]);

  // New permission requests arrive on the response stream. Remote emits them
  // under `acp_permission`; some paths use `permission`. Both carry an
  // IConfirmation-shaped payload here.
  useEffect(() => {
    return ipcBridge.conversation.responseStream.on((raw) => {
      const message = raw as ResponseStreamMessage;
      if (conversation_id && message.conversation_id !== conversation_id) return;

      if (message.type === 'acp_permission' || message.type === 'permission') {
        const conf = message.data as WorkspaceApproval | undefined;
        if (!isTabEligible(conf)) return;
        setApprovals((prev) => {
          const idx = prev.findIndex((a) => a.call_id === conf.call_id);
          if (idx === -1) return [...prev, conf];
          const copy = prev.slice();
          copy[idx] = conf;
          return copy;
        });
        return;
      }

      // Turn boundary: the backend auto-rejects pending approvals on turn end.
      if (message.type === 'finish' || message.type === 'error') {
        setApprovals([]);
        evaluatedRef.current.clear();
      }
    });
  }, [conversation_id]);

  // Server-side removal (answered elsewhere / auto-resolved).
  useEffect(() => {
    return ipcBridge.conversation.confirmation.remove.on((payload) => {
      if (conversation_id && payload.conversation_id !== conversation_id) return;
      setApprovals((prev) => prev.filter((a) => a.id !== payload.id && a.call_id !== payload.id));
    });
  }, [conversation_id]);

  const respond = useCallback(
    async (approval: WorkspaceApproval, value: string, params?: Record<string, string>) => {
      const data: Record<string, unknown> = { value };
      if (params) data.params = params;
      const convId = (approval as { conversation_id?: string }).conversation_id ?? conversation_id ?? '';
      await ipcBridge.conversation.confirmation.confirm.invoke({
        conversation_id: convId,
        call_id: approval.call_id,
        msg_id: approval.id || '',
        data,
        always_allow: value === 'proceed_always',
      });
      setApprovals((prev) => prev.filter((a) => a.call_id !== approval.call_id));
    },
    [conversation_id]
  );

  // Auto-evaluate new permission prompts against the JS approval evaluator.
  // For each newly-arrived, auto-evaluatable approval that we haven't seen
  // yet, ask the process to run `evaluateApprovalRules`. On `allow` we
  // immediately confirm with `once`; on `deny` we immediately confirm with
  // `reject`; on `manual`/`fallback` we leave it for the user.
  useEffect(() => {
    if (!sessionId) return;
    const candidates = approvals.filter((a) => isAutoEvaluatable(a) && !evaluatedRef.current.has(a.call_id));
    if (candidates.length === 0) return;

    let cancelled = false;
    for (const candidate of candidates) {
      evaluatedRef.current.add(candidate.call_id);
      void (async () => {
        const result = await ipcBridge.approvalEvaluator.check.invoke({
          callId: candidate.call_id,
          sessionId,
          permission: candidate.action ?? candidate.command_type ?? '',
          patterns: extractPatterns(candidate.description),
          commandType: candidate.command_type,
          workspaceRef,
          metadata: undefined,
        });
        if (cancelled || !result.success || !result.data) return;

        const { decision, action } = result.data;
        if (decision === 'allow' && action === 'once') {
          await respond(candidate, 'once');
        } else if (decision === 'deny' && action === 'reject') {
          await respond(candidate, 'reject');
        }
        // manual / fallback → leave for the user
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [approvals, sessionId, workspaceRef, respond]);

  const hasApprovals = approvals.length > 0;

  useEffect(() => {
    if (hasApprovals !== prevHasRef.current) {
      prevHasRef.current = hasApprovals;
      dispatchWorkspaceHasApprovalsEvent(hasApprovals, conversation_id);
    }
  }, [hasApprovals, conversation_id]);

  return { approvals, hasApprovals, respond };
}

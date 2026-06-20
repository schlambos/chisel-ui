/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { buildApprovalAudit } from '@process/services/approval/audit';
import { evaluateApprovalRules } from '@process/services/approval/evaluator';
import { resolveChislApprovalDbPath } from '@process/services/approval/paths';
import {
  appendApprovalAudit,
  createApprovalRule,
  deleteApprovalRule,
  getApprovalRule,
  listApprovalAudits,
  listApprovalRules,
  listApprovalRulesForSession,
  openChislApprovalStore,
  updateApprovalRule,
} from '@process/services/approval/repository';
import type { ApprovalMatcher, ApprovalRuleScope, ChislPermissionRequest } from '@process/services/approval/types';
import type { ChislApprovalStore } from '@process/services/approval/repository';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function initApprovalBridge(): void {
  ipcBridge.approvalRules.listForSession.provider(async (req) => {
    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const rules = listApprovalRulesForSession(store, req.sessionId);
      return { success: true, data: rules };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });

  ipcBridge.approvalRules.delete.provider(async (req) => {
    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const rule = getApprovalRule(store, req.id);

      if (!rule) {
        return { success: false, msg: 'Rule not found' };
      }

      if (rule.scope !== 'session' || rule.scopeRef !== req.sessionId) {
        return { success: false, msg: 'Rule does not belong to this session' };
      }

      const deleted = deleteApprovalRule(store, req.id);
      return { success: true, data: { deleted } };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });

  ipcBridge.approvalRules.create.provider(async (req) => {
    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const rule = createApprovalRule(store, req.input);
      return { success: true, data: rule };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });

  ipcBridge.approvalRules.update.provider(async (req) => {
    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const rule = updateApprovalRule(store, req.id, req.update);
      if (!rule) {
        return { success: false, msg: 'Rule not found' };
      }
      return { success: true, data: rule };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });

  ipcBridge.approvalRules.list.provider(async (req) => {
    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const allRules = listApprovalRules(store);
      const filtered = req.scope ? allRules.filter((rule) => rule.scope === req.scope) : allRules;
      return { success: true, data: filtered };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });

  ipcBridge.approvalRules.listAudits.provider(async (req) => {
    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const audits = listApprovalAudits(store);
      const limited = req.limit ? audits.toReversed().slice(0, req.limit) : audits;
      return { success: true, data: limited };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });

  ipcBridge.approvalEvaluator.check.provider(async (req) => {
    if (!req.callId || !req.sessionId) {
      return { success: false, msg: 'Missing callId or sessionId' };
    }

    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const rules = listApprovalRules(store);
      const request: ChislPermissionRequest = {
        id: req.callId,
        sessionID: req.sessionId,
        permission: req.permission,
        patterns: req.patterns,
        metadata: req.metadata,
        tool: req.commandType,
      };
      const result = evaluateApprovalRules(rules, request, {
        sessionID: req.sessionId,
        workspaceRef: req.workspaceRef,
      });

      try {
        appendApprovalAudit(
          store,
          buildApprovalAudit(request, { sessionID: req.sessionId, workspaceRef: req.workspaceRef }, result)
        );
      } catch (auditError) {
        console.warn('[approvalEvaluator.check] Failed to append audit:', auditError);
      }

      const action = result.decision === 'allow' ? 'once' : result.decision === 'deny' ? 'reject' : null;
      return {
        success: true,
        data: {
          decision: result.decision,
          action,
          ruleId: result.rule?.id,
          reason: result.reason,
        },
      };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });

  ipcBridge.approvalRules.exportForOpenCode.provider(async () => {
    let store: ChislApprovalStore | null = null;
    try {
      store = openChislApprovalStore(resolveChislApprovalDbPath());
      const rules = listApprovalRules(store);

      const permissions: Record<string, string[]> = { allow: [], deny: [] };
      for (const rule of rules) {
        if (!rule.enabled) continue;
        const action = rule.action === 'allow' ? 'allow' : 'deny';
        const tool = rule.tool || 'Bash';
        const patterns = rule.matcher.type === 'composite' ? [] : rule.matcher.patterns || [];

        for (const pattern of patterns) {
          const formatted = `${tool}(${pattern})`;
          if (!permissions[action].includes(formatted)) {
            permissions[action].push(formatted);
          }
        }
      }

      return { success: true, data: permissions };
    } catch (error) {
      return { success: false, msg: errorMessage(error) };
    } finally {
      store?.close();
    }
  });
}

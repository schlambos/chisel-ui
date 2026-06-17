/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { resolveChislApprovalDbPath } from '@process/services/approval/paths';
import {
  deleteApprovalRule,
  getApprovalRule,
  listApprovalRulesForSession,
  openChislApprovalStore,
} from '@process/services/approval/repository';
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
}

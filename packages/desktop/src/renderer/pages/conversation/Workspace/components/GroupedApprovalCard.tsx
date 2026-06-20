/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Card, Tag, Typography } from '@arco-design/web-react';
import { CheckOne, CloseOne, Shield, Terminal } from '@icon-park/react';
import type { TFunction } from 'i18next';
import React, { useCallback, useState } from 'react';
import type { WorkspaceApproval } from '../hooks/useWorkspaceApprovals';
import styles from '@renderer/components/approval/ApprovalCardBase.module.css';

const { Text } = Typography;

/** Maximum number of approvals in a single batch group. */
const MAX_BATCH_SIZE = 50;

/** Minimum approvals sharing a matcher signature to form a group. */
const MIN_GROUP_SIZE = 3;

/** Meta marker regex — mirrors ApprovalsList's copy. */
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
    // Malformed marker — fall through.
  }
  return [];
}

export type ApprovalGroup = {
  key: string;
  items: WorkspaceApproval[];
  tool: string;
  patterns: string[];
  action: string;
  count: number;
};

export type GroupedApprovals = {
  groups: ApprovalGroup[];
  ungrouped: WorkspaceApproval[];
};

/**
 * Group pending approvals by matcher signature: (command_type || action) +
 * sorted patterns. Only groups with ≥ 3 items are returned; smaller
 * clusters fall into `ungrouped`. Each group is capped at MAX_BATCH_SIZE.
 */
export function groupPendingApprovals(approvals: WorkspaceApproval[]): GroupedApprovals {
  if (approvals.length < MIN_GROUP_SIZE) return { groups: [], ungrouped: approvals };

  const buckets = new Map<string, WorkspaceApproval[]>();
  const questions: WorkspaceApproval[] = [];

  for (const approval of approvals) {
    if (approval.action === 'question') {
      questions.push(approval);
      continue;
    }
    const tool = approval.command_type ?? approval.action ?? 'unknown';
    const patterns = extractPatterns(approval.description);
    const signature = `${tool}::${[...patterns].toSorted().join(',')}`;
    const existing = buckets.get(signature);
    if (existing) {
      existing.push(approval);
    } else {
      buckets.set(signature, [approval]);
    }
  }

  const groups: ApprovalGroup[] = [];
  const ungrouped: WorkspaceApproval[] = [];

  for (const [key, items] of buckets) {
    if (items.length < MIN_GROUP_SIZE) {
      ungrouped.push(...items);
      continue;
    }
    const capped = items.slice(0, MAX_BATCH_SIZE);
    const overflow = items.slice(MAX_BATCH_SIZE);
    const first = capped[0];
    const tool = first.command_type ?? first.action ?? 'unknown';
    const patterns = extractPatterns(first.description);
    groups.push({
      key,
      items: capped,
      tool,
      patterns,
      action: first.action ?? 'permission',
      count: capped.length,
    });
    ungrouped.push(...overflow);
  }

  return { groups, ungrouped: [...questions, ...ungrouped] };
}

type GroupedApprovalCardProps = {
  group: ApprovalGroup;
  t: TFunction;
  respond: (approval: WorkspaceApproval, value: string, params?: Record<string, string>) => Promise<void>;
};

const GroupedApprovalCard: React.FC<GroupedApprovalCardProps> = ({ group, t, respond }) => {
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(false);

  const handleApproveAll = useCallback(async () => {
    if (busy || resolved) return;
    setBusy(true);
    for (const item of group.items) {
      try {
        await respond(item, 'once');
      } catch {
        // Individual failure does not abort the batch — mirrors
        // PendingApprovalsBanner's tolerance for transient errors.
      }
    }
    setResolved(true);
    setBusy(false);
  }, [busy, resolved, group.items, respond]);

  const handleRejectAll = useCallback(async () => {
    if (busy || resolved) return;
    setBusy(true);
    for (const item of group.items) {
      try {
        await respond(item, 'reject');
      } catch {
        // Same tolerance as approve-all.
      }
    }
    setResolved(true);
    setBusy(false);
  }, [busy, resolved, group.items, respond]);

  const Icon = group.tool === 'run_shell' || group.action === 'exec' ? Terminal : Shield;

  if (resolved) {
    return (
      <Card bordered={false} className={styles.card}>
        <div className={styles.responded} data-testid='grouped-approval-responded'>
          <CheckOne theme='outline' size='14' />
          <Text className={styles.respondedLabel}>
            {t('conversation.approval.batchResolved', { defaultValue: `Resolved ${group.count} approvals` })}
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <Card bordered={false} className={styles.card} data-testid='grouped-approval-card'>
      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden>
            <Icon theme='outline' size='20' />
          </span>
          <Text className={styles.title}>
            {t('conversation.approval.batchTitle', {
              defaultValue: `${group.tool} permissions`,
            })}
          </Text>
          <Tag color='orange' size='small' bordered data-testid='grouped-approval-count'>
            ×{group.count}
          </Tag>
        </div>

        {group.patterns.length > 0 && (
          <div className={styles.block}>
            <Text className={styles.blockLabel}>
              {t('conversation.approval.patterns', { defaultValue: 'Patterns' })}
            </Text>
            <div className={styles.patterns} data-testid='grouped-approval-patterns'>
              {group.patterns.map((p, i) => (
                <code key={i} className={styles.codeInline}>
                  {p}
                </code>
              ))}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Button
            type='primary'
            size='mini'
            loading={busy}
            disabled={busy}
            onClick={handleApproveAll}
            icon={<CheckOne theme='outline' size='14' />}
            data-testid='grouped-approval-approve-all'
          >
            {t('conversation.approval.approveAllN', {
              count: group.count,
              defaultValue: `Approve all ${group.count}`,
            })}
          </Button>
          <Button
            type='secondary'
            size='mini'
            disabled={busy}
            onClick={handleRejectAll}
            icon={<CloseOne theme='outline' size='14' />}
            data-testid='grouped-approval-reject-all'
          >
            {t('conversation.approval.rejectAllN', {
              count: group.count,
              defaultValue: `Reject all ${group.count}`,
            })}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default GroupedApprovalCard;

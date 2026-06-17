/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Card, Modal, Tag } from '@arco-design/web-react';
import type { TFunction } from 'i18next';
import React, { useCallback, useState } from 'react';
import type { ApprovalRule } from '@process/services/approval/types';

type ApprovalRulesListProps = {
  t: TFunction;
  rules: ApprovalRule[];
  hasSession: boolean;
  loading: boolean;
  error: string | null;
  onDelete: (id: string) => Promise<boolean>;
  onRefetch: () => Promise<void>;
};

const ACTION_COLORS: Record<string, string> = {
  allow: 'orange',
  deny: 'red',
  ask: 'gray',
};

function formatMatcherSummary(matcher: ApprovalRule['matcher']): string {
  if (matcher.type === 'composite') {
    return matcher.children.map(formatMatcherSummary).join(' + ');
  }
  if (matcher.patterns && matcher.patterns.length > 0) {
    return matcher.patterns.join(', ');
  }
  return matcher.type;
}

function formatTime(ms: number, t: TFunction): string {
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('conversation.approvalRules.justNow');
  if (diffMins < 60) return t('conversation.approvalRules.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('conversation.approvalRules.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('conversation.approvalRules.daysAgo', { count: diffDays });
  return date.toLocaleDateString();
}

const ApprovalRulesList: React.FC<ApprovalRulesListProps> = ({
  t,
  rules,
  hasSession,
  loading,
  error,
  onDelete,
  onRefetch,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmId) return;
    setDeleteConfirmVisible(false);
    setDeletingId(deleteConfirmId);
    const success = await onDelete(deleteConfirmId);
    setDeletingId(null);
    setDeleteConfirmId(null);
    if (!success) {
      await onRefetch();
    }
  }, [deleteConfirmId, onDelete, onRefetch]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmVisible(false);
    setDeleteConfirmId(null);
  }, []);

  if (!hasSession) {
    return (
      <div className='flex items-center justify-center h-full text-xs text-[var(--color-text-3)] text-center px-16px'>
        {t('conversation.approvalRules.emptyNoSession')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-full text-xs text-[var(--color-text-3)]'>
        {t('conversation.approvalRules.loading')}
      </div>
    );
  }

  if (error) {
    return <div className='flex items-center justify-center h-full text-xs text-[var(--color-text-3)]'>{error}</div>;
  }

  if (rules.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-xs text-[var(--color-text-3)] text-center gap-8px px-16px'>
        <span>{t('conversation.approvalRules.empty')}</span>
      </div>
    );
  }

  return (
    <>
      <div className='h-full overflow-y-auto px-12px py-8px'>
        {rules.map((rule) => (
          <Card key={rule.id} className='mb-8px' bodyStyle={{ padding: '8px 12px' }}>
            <div className='flex items-start justify-between gap-8px'>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-6px mb-4px'>
                  <Tag color={ACTION_COLORS[rule.action] || 'gray'} size='small'>
                    {t(
                      `conversation.approvalRules.action${rule.action.charAt(0).toUpperCase() + rule.action.slice(1)}`
                    )}
                  </Tag>
                  {rule.tool && (
                    <Tag color='arcoblue' size='small'>
                      {rule.tool}
                    </Tag>
                  )}
                </div>
                <div className='text-xs text-[var(--color-text-2)] truncate'>{formatMatcherSummary(rule.matcher)}</div>
                <div className='text-xs text-[var(--color-text-3)] mt-4px'>{formatTime(rule.createdAt, t)}</div>
              </div>
              <Button
                type='text'
                size='mini'
                status='danger'
                loading={deletingId === rule.id}
                onClick={() => handleDeleteClick(rule.id)}
                disabled={deletingId !== null}
              >
                {t('conversation.approvalRules.delete')}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        title={t('conversation.approvalRules.deleteConfirm')}
        visible={deleteConfirmVisible}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        okText={t('conversation.approvalRules.deleteConfirmOk')}
        cancelText={t('conversation.approvalRules.deleteConfirmCancel')}
      >
        {t('conversation.approvalRules.deleteConfirmMessage')}
      </Modal>
    </>
  );
};

export default ApprovalRulesList;

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tabs } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ApprovalsList from '@/renderer/pages/conversation/Workspace/components/ApprovalsList';
import ApprovalRulesList from '@/renderer/pages/conversation/Workspace/components/ApprovalRulesList';
import { useWorkspaceApprovals } from '@/renderer/pages/conversation/Workspace/hooks/useWorkspaceApprovals';
import { useApprovalRulesForSession } from '@/renderer/pages/conversation/Workspace/hooks/useApprovalRulesForSession';

type BottomTab = 'approvals' | 'history';

interface ConversationPaneBottomPanelProps {
  conversationId: string;
}

/**
 * Bottom slice of the right-hand conversation pane. Hosts a 2-tab strip:
 *   - Approvals: live `useWorkspaceApprovals` data via the existing
 *     `ApprovalsList` chrome. Shows all pending confirmations including
 *     permission approvals, OpenCode questions, and MCP elicitations.
 *   - History: session-scoped remembered approval rules.
 */
const ConversationPaneBottomPanel: React.FC<ConversationPaneBottomPanelProps> = ({ conversationId }) => {
  const [activeTab, setActiveTab] = useState<BottomTab>('approvals');
  const { t } = useTranslation();
  const approvalsHook = useWorkspaceApprovals(conversationId || undefined);
  const rulesHook = useApprovalRulesForSession();

  useEffect(() => {
    if (activeTab === 'history') void rulesHook.refetch();
  }, [activeTab, rulesHook.refetch]);

  return (
    <div className='flex flex-col size-full min-h-0' data-testid='conversation-pane-bottom-panel'>
      <Tabs
        activeTab={activeTab}
        onChange={(key) => setActiveTab(key as BottomTab)}
        type='line'
        size='small'
        className='px-12px [&_.arco-tabs-nav]:border-b-0 [&_.arco-tabs-header-title]:!mr-8px flex flex-col flex-1 min-h-0'
      >
        <Tabs.TabPane key='approvals' title={t('conversation.workspace.approvals.tab')}>
          {approvalsHook.hasApprovals ? (
            <ApprovalsList t={t} approvals={approvalsHook.approvals} respond={approvalsHook.respond} />
          ) : (
            <div className='flex items-center justify-center h-full text-xs text-[var(--color-text-3)]'>
              {t('conversation.workspace.approvals.empty')}
            </div>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane key='history' title={t('conversation.approvalRules.tabTitle')}>
          <ApprovalRulesList
            t={t}
            rules={rulesHook.rules}
            hasSession={rulesHook.hasSession}
            loading={rulesHook.loading}
            error={rulesHook.error}
            onDelete={rulesHook.deleteRule}
            onRefetch={rulesHook.refetch}
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default ConversationPaneBottomPanel;

import { ipcBridge } from '@/common';
import type {
  ApprovalAudit,
  ApprovalMatcher,
  ApprovalRule,
  ApprovalRuleAction,
  ApprovalRuleCreate,
  ApprovalRuleScope,
  ApprovalRuleUpdate,
} from '@process/services/approval/types';
import { Button, Card, Empty, Modal, Select, Spin, Switch, Table, Tag, Tooltip } from '@arco-design/web-react';
import { Delete, Edit, Plus, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import RuleFormModal from './RuleFormModal';

const ACTION_COLORS: Record<ApprovalRuleAction, string> = {
  allow: 'orange',
  deny: 'red',
  ask: 'gray',
};

const SCOPE_COLORS: Record<ApprovalRuleScope, string> = {
  global: 'purple',
  workspace: 'blue',
  session: 'cyan',
};

function formatMatcherSummary(matcher: ApprovalMatcher): string {
  if (matcher.type === 'composite') {
    return `composite (${matcher.children.length} children)`;
  }
  const parts = [`${matcher.field}/${matcher.type}`];
  if (matcher.patterns && matcher.patterns.length > 0) {
    parts.push(matcher.patterns.join(', '));
  }
  if (matcher.path) {
    parts.push(`path=${matcher.path}`);
  }
  return parts.join(' → ');
}

function formatTime(ms: number): string {
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const SCOPE_OPTIONS: { label: string; value: ApprovalRuleScope | 'all' }[] = [
  { label: 'All scopes', value: 'all' },
  { label: 'Global', value: 'global' },
  { label: 'Workspace', value: 'workspace' },
  { label: 'Session', value: 'session' },
];

const PermissionsSettings: React.FC = () => {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [audits, setAudits] = useState<ApprovalAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ApprovalRuleScope | 'all'>('all');
  const [formVisible, setFormVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'audits'>('rules');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scopeArg = scopeFilter === 'all' ? {} : { scope: scopeFilter };
      const result = await ipcBridge.approvalRules.list.invoke(scopeArg);
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
  }, [scopeFilter]);

  const fetchAudits = useCallback(async () => {
    try {
      const result = await ipcBridge.approvalRules.listAudits.invoke({ limit: 25 });
      if (result.success && Array.isArray(result.data)) {
        setAudits(result.data);
      }
    } catch {
      // audits are optional — silently ignore
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (activeTab === 'audits') {
      void fetchAudits();
    }
  }, [activeTab, fetchAudits]);

  const handleCreate = () => {
    setEditingRule(null);
    setFormVisible(true);
  };

  const handleEdit = (rule: ApprovalRule) => {
    setEditingRule(rule);
    setFormVisible(true);
  };

  const handleDelete = async (rule: ApprovalRule) => {
    if (rule.scope !== 'session') return;
    Modal.confirm({
      title: 'Delete rule',
      content: `Delete "${rule.name}"? This cannot be undone.`,
      okText: 'Delete',
      cancelText: 'Cancel',
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        setDeletingId(rule.id);
        try {
          const result = await ipcBridge.approvalRules.delete.invoke({
            id: rule.id,
            sessionId: rule.scopeRef || '',
          });
          if (result.success && result.data?.deleted) {
            await fetchRules();
          }
        } catch {
          // error handled by refetch
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleFormSubmit = async (values: ApprovalRuleCreate | { id: string; update: ApprovalRuleUpdate }) => {
    if ('id' in values && 'update' in values) {
      const result = await ipcBridge.approvalRules.update.invoke({
        id: values.id,
        update: values.update,
      });
      if (!result.success) {
        throw new Error(result.msg || 'Update failed');
      }
    } else {
      const result = await ipcBridge.approvalRules.create.invoke({ input: values });
      if (!result.success) {
        throw new Error(result.msg || 'Create failed');
      }
    }
    setFormVisible(false);
    setEditingRule(null);
    await fetchRules();
  };

  const filteredRules = useMemo(() => {
    if (scopeFilter === 'all') return rules;
    return rules.filter((r) => r.scope === scopeFilter);
  }, [rules, scopeFilter]);

  const ruleColumns = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        width: 180,
        render: (name: string, rule: ApprovalRule) => (
          <div className='flex items-center gap-6px'>
            <Switch
              size='small'
              checked={rule.enabled}
              onChange={async (checked: boolean) => {
                await ipcBridge.approvalRules.update.invoke({ id: rule.id, update: { enabled: checked } });
                await fetchRules();
              }}
            />
            <span className={`text-13px ${rule.enabled ? 'text-t-primary' : 'text-t-tertiary line-through'}`}>
              {name}
            </span>
          </div>
        ),
      },
      {
        title: 'Action',
        dataIndex: 'action',
        width: 80,
        render: (action: ApprovalRuleAction) => (
          <Tag color={ACTION_COLORS[action]} size='small'>
            {action}
          </Tag>
        ),
      },
      {
        title: 'Scope',
        dataIndex: 'scope',
        width: 100,
        render: (scope: ApprovalRuleScope, rule: ApprovalRule) => (
          <div className='flex items-center gap-4px'>
            <Tag color={SCOPE_COLORS[scope]} size='small'>
              {scope}
            </Tag>
            {rule.scopeRef && <span className='text-11px text-t-tertiary truncate max-w-80px'>{rule.scopeRef}</span>}
          </div>
        ),
      },
      {
        title: 'Priority',
        dataIndex: 'priority',
        width: 70,
        render: (priority: number) => <span className='text-12px text-t-secondary'>{priority}</span>,
      },
      {
        title: 'Matcher',
        dataIndex: 'matcher',
        render: (matcher: ApprovalMatcher) => (
          <span className='text-12px text-t-secondary truncate max-w-200px block'>{formatMatcherSummary(matcher)}</span>
        ),
      },
      {
        title: 'Tool',
        dataIndex: 'tool',
        width: 100,
        render: (tool: string | undefined) =>
          tool ? (
            <Tag color='arcoblue' size='small'>
              {tool}
            </Tag>
          ) : (
            <span className='text-t-tertiary'>—</span>
          ),
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        width: 90,
        render: (ts: number) => <span className='text-11px text-t-tertiary'>{formatTime(ts)}</span>,
      },
      {
        title: '',
        width: 90,
        render: (_: unknown, rule: ApprovalRule) => (
          <div className='flex items-center gap-4px'>
            <Button
              type='text'
              size='mini'
              icon={<Edit theme='outline' size='14' />}
              onClick={() => handleEdit(rule)}
            />
            {rule.scope === 'session' ? (
              <Button
                type='text'
                size='mini'
                status='danger'
                loading={deletingId === rule.id}
                icon={<Delete theme='outline' size='14' />}
                onClick={() => void handleDelete(rule)}
              />
            ) : (
              <Tooltip content='Only session-scoped rules can be deleted from Settings'>
                <Button type='text' size='mini' status='danger' disabled icon={<Delete theme='outline' size='14' />} />
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [deletingId, fetchRules]
  );

  const auditColumns = useMemo(
    () => [
      {
        title: 'Time',
        dataIndex: 'evaluatedAt',
        width: 90,
        render: (ts: number) => <span className='text-11px text-t-tertiary'>{formatTime(ts)}</span>,
      },
      {
        title: 'Permission',
        dataIndex: 'permission',
        width: 140,
        render: (p: string) => <span className='text-12px font-mono'>{p}</span>,
      },
      {
        title: 'Decision',
        dataIndex: 'decision',
        width: 80,
        render: (d: string) => <Tag size='small'>{d}</Tag>,
      },
      {
        title: 'Rule',
        dataIndex: 'ruleName',
        width: 140,
        render: (name: string | undefined) => name || <span className='text-t-tertiary'>—</span>,
      },
      {
        title: 'Session',
        dataIndex: 'sessionId',
        width: 120,
        render: (id: string) => (
          <span className='text-11px text-t-tertiary font-mono truncate max-w-120px block'>{id}</span>
        ),
      },
      {
        title: 'Reason',
        dataIndex: 'reason',
        render: (r: string) => <span className='text-11px text-t-secondary truncate max-w-200px block'>{r}</span>,
      },
    ],
    []
  );

  return (
    <SettingsPageWrapper>
      <div className='flex items-center justify-between mb-16px'>
        <h2 className='text-18px font-semibold text-t-primary m-0'>Permissions</h2>
        <div className='flex items-center gap-8px'>
          <Select value={scopeFilter} onChange={setScopeFilter} style={{ width: 140 }} options={SCOPE_OPTIONS} />
          <Button type='primary' size='small' icon={<Plus theme='outline' size='14' />} onClick={handleCreate}>
            Add Rule
          </Button>
          <Button
            type='text'
            size='small'
            icon={<Refresh theme='outline' size='14' />}
            onClick={() => void fetchRules()}
          />
        </div>
      </div>

      <div className='flex gap-16px mb-12px'>
        <button
          type='button'
          className={`text-13px font-medium pb-4px border-b-2 cursor-pointer bg-transparent ${
            activeTab === 'rules'
              ? 'text-t-primary border-[var(--color-primary-6)]'
              : 'text-t-tertiary border-transparent'
          }`}
          onClick={() => setActiveTab('rules')}
        >
          Rules
        </button>
        <button
          type='button'
          className={`text-13px font-medium pb-4px border-b-2 cursor-pointer bg-transparent ${
            activeTab === 'audits'
              ? 'text-t-primary border-[var(--color-primary-6)]'
              : 'text-t-tertiary border-transparent'
          }`}
          onClick={() => setActiveTab('audits')}
        >
          Recent Audits
        </button>
      </div>

      {activeTab === 'rules' && (
        <>
          {loading ? (
            <div className='flex items-center justify-center py-48px'>
              <Spin />
            </div>
          ) : error ? (
            <Card>
              <div className='text-center text-t-tertiary py-24px'>{error}</div>
            </Card>
          ) : filteredRules.length === 0 ? (
            <Empty description='No approval rules found' />
          ) : (
            <Table
              columns={ruleColumns}
              data={filteredRules}
              rowKey='id'
              size='small'
              pagination={false}
              border={{
                wrapper: true,
                cell: true,
              }}
            />
          )}
        </>
      )}

      {activeTab === 'audits' && (
        <>
          {audits.length === 0 ? (
            <Empty description='No recent audit entries' />
          ) : (
            <Table
              columns={auditColumns}
              data={audits}
              rowKey={(row: ApprovalAudit) => row.id || row.requestId}
              size='small'
              pagination={false}
              border={{
                wrapper: true,
                cell: true,
              }}
            />
          )}
        </>
      )}

      <RuleFormModal
        visible={formVisible}
        rule={editingRule}
        onClose={() => {
          setFormVisible(false);
          setEditingRule(null);
        }}
        onSubmit={handleFormSubmit}
      />
    </SettingsPageWrapper>
  );
};

export default PermissionsSettings;

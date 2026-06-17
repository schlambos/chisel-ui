import type {
  ApprovalMatchMode,
  ApprovalMatcher,
  ApprovalMatcherField,
  ApprovalMatcherType,
  ApprovalRule,
  ApprovalRuleAction,
  ApprovalRuleCreate,
  ApprovalRuleScope,
  ApprovalRuleUpdate,
} from '@process/services/approval/types';
import { Form, Input, InputNumber, Modal, Select, Switch } from '@arco-design/web-react';
import React, { useCallback, useEffect } from 'react';

type LeafMatcherType = Exclude<ApprovalMatcherType, 'composite'>;

const LEAF_MATCHER_TYPES: { label: string; value: LeafMatcherType }[] = [
  { label: 'Exact', value: 'exact' },
  { label: 'Glob', value: 'glob' },
  { label: 'Regex', value: 'regex' },
  { label: 'Prefix', value: 'prefix' },
  { label: 'JSONPath', value: 'jsonpath' },
];

const MATCHER_FIELDS: { label: string; value: ApprovalMatcherField }[] = [
  { label: 'Permission', value: 'permission' },
  { label: 'Patterns', value: 'patterns' },
  { label: 'Session ID', value: 'sessionID' },
  { label: 'ID', value: 'id' },
  { label: 'Metadata', value: 'metadata' },
];

const ACTIONS: { label: string; value: ApprovalRuleAction }[] = [
  { label: 'Allow', value: 'allow' },
  { label: 'Deny', value: 'deny' },
  { label: 'Ask', value: 'ask' },
];

const SCOPES: { label: string; value: ApprovalRuleScope }[] = [
  { label: 'Global', value: 'global' },
  { label: 'Workspace', value: 'workspace' },
  { label: 'Session', value: 'session' },
];

const MATCH_MODES: { label: string; value: ApprovalMatchMode }[] = [
  { label: 'Any', value: 'any' },
  { label: 'All', value: 'all' },
];

type FormValues = {
  name: string;
  action: ApprovalRuleAction;
  scope: ApprovalRuleScope;
  scopeRef: string;
  tool: string;
  matcherField: ApprovalMatcherField;
  matcherType: LeafMatcherType;
  patterns: string;
  matchMode: ApprovalMatchMode;
  metadataPath: string;
  priority: number;
  enabled: boolean;
  reason: string;
  tags: string;
};

type RuleFormModalProps = {
  visible: boolean;
  rule: ApprovalRule | null;
  onClose: () => void;
  onSubmit: (values: ApprovalRuleCreate | { id: string; update: ApprovalRuleUpdate }) => Promise<void>;
};

function matcherToFormValues(matcher: ApprovalMatcher): {
  matcherField: ApprovalMatcherField;
  matcherType: LeafMatcherType;
  patterns: string;
  matchMode: ApprovalMatchMode;
  metadataPath: string;
} {
  if (matcher.type === 'composite') {
    return { matcherField: 'permission', matcherType: 'exact', patterns: '', matchMode: 'any', metadataPath: '' };
  }
  return {
    matcherField: matcher.field,
    matcherType: matcher.type,
    patterns: matcher.patterns?.join('\n') || '',
    matchMode: matcher.matchMode || 'any',
    metadataPath: matcher.path || '',
  };
}

const RuleFormModal: React.FC<RuleFormModalProps> = ({ visible, rule, onClose, onSubmit }) => {
  const [form] = Form.useForm<FormValues>();
  const isEditing = rule !== null;
  const isComposite = rule?.matcher.type === 'composite';

  useEffect(() => {
    if (!visible) return;
    if (rule) {
      const mv = matcherToFormValues(rule.matcher);
      form.setFieldsValue({
        name: rule.name,
        action: rule.action,
        scope: rule.scope,
        scopeRef: rule.scopeRef || '',
        tool: rule.tool || '',
        matcherField: mv.matcherField,
        matcherType: mv.matcherType,
        patterns: mv.patterns,
        matchMode: mv.matchMode,
        metadataPath: mv.metadataPath,
        priority: rule.priority,
        enabled: rule.enabled,
        reason: rule.reason || '',
        tags: rule.tags?.join(', ') || '',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        action: 'ask',
        scope: 'global',
        matcherField: 'permission',
        matcherType: 'glob',
        matchMode: 'any',
        priority: 100,
        enabled: true,
      });
    }
  }, [visible, rule, form]);

  const scopeValue = Form.useWatch('scope', form);

  const handleSubmit = useCallback(async () => {
    const values = await form.validate();
    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (isEditing && rule) {
      const update: ApprovalRuleUpdate = {
        name: values.name,
        action: values.action,
        scope: values.scope,
        scopeRef: values.scopeRef || undefined,
        tool: values.tool || undefined,
        priority: values.priority,
        enabled: values.enabled,
        reason: values.reason || undefined,
        tags,
      };
      if (!isComposite) {
        const patternLines = values.patterns
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        update.matcher = {
          type: values.matcherType,
          field: values.matcherField,
          patterns: patternLines.length > 0 ? patternLines : undefined,
          matchMode: values.matchMode,
          path: values.metadataPath || undefined,
        };
      }
      await onSubmit({ id: rule.id, update });
    } else {
      const patternLines = values.patterns
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const input: ApprovalRuleCreate = {
        name: values.name,
        action: values.action,
        scope: values.scope,
        scopeRef: values.scopeRef || undefined,
        tool: values.tool || undefined,
        matcher: {
          type: values.matcherType,
          field: values.matcherField,
          patterns: patternLines.length > 0 ? patternLines : undefined,
          matchMode: values.matchMode,
          path: values.metadataPath || undefined,
        },
        priority: values.priority,
        enabled: values.enabled,
        createdBy: 'settings',
        reason: values.reason || undefined,
        tags,
      };
      await onSubmit(input);
    }
  }, [form, isEditing, isComposite, rule, onSubmit]);

  return (
    <Modal
      title={isEditing ? 'Edit Rule' : 'Add Rule'}
      visible={visible}
      onOk={() => void handleSubmit()}
      onCancel={onClose}
      okText={isEditing ? 'Save' : 'Create'}
      style={{ width: 560 }}
      unmountOnExit
    >
      {isComposite && (
        <div className='mb-12px p-8px bg-[var(--color-fill-2)] rd-4px text-12px text-t-secondary'>
          This rule uses a composite matcher. Only the rule properties can be edited; the matcher structure is
          read-only.
        </div>
      )}
      <Form form={form} layout='vertical' size='small'>
        <Form.Item label='Name' field='name' rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder='Rule name' />
        </Form.Item>

        <div className='flex gap-12px'>
          <Form.Item label='Action' field='action' className='flex-1'>
            <Select options={ACTIONS} />
          </Form.Item>
          <Form.Item label='Scope' field='scope' className='flex-1'>
            <Select options={SCOPES} />
          </Form.Item>
        </div>

        {scopeValue !== 'global' && (
          <Form.Item
            label='Scope Ref'
            field='scopeRef'
            rules={scopeValue === 'session' ? [{ required: true, message: 'Session ID is required' }] : undefined}
          >
            <Input placeholder={scopeValue === 'session' ? 'Session ID' : 'Workspace ref'} />
          </Form.Item>
        )}

        <Form.Item label='Tool' field='tool'>
          <Input placeholder='Optional tool name' />
        </Form.Item>

        {isComposite ? (
          <div className='mb-12px p-8px bg-[var(--color-fill-2)] rd-4px text-12px text-t-tertiary'>
            Composite matcher — not editable in this view
          </div>
        ) : (
          <>
            <div className='flex gap-12px'>
              <Form.Item label='Matcher Field' field='matcherField' className='flex-1'>
                <Select options={MATCHER_FIELDS} />
              </Form.Item>
              <Form.Item label='Matcher Type' field='matcherType' className='flex-1'>
                <Select options={LEAF_MATCHER_TYPES} />
              </Form.Item>
            </div>

            <Form.Item label='Patterns (one per line)' field='patterns'>
              <Input.TextArea rows={3} placeholder='Enter patterns, one per line' />
            </Form.Item>

            <div className='flex gap-12px'>
              <Form.Item label='Match Mode' field='matchMode' className='flex-1'>
                <Select options={MATCH_MODES} />
              </Form.Item>
              <Form.Item label='Metadata Path' field='metadataPath' className='flex-1'>
                <Input placeholder='For jsonpath type' />
              </Form.Item>
            </div>
          </>
        )}

        <div className='flex gap-12px items-end'>
          <Form.Item label='Priority' field='priority' className='flex-1'>
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label='Enabled' field='enabled' triggerPropName='checked' className='flex-1'>
            <Switch />
          </Form.Item>
        </div>

        <Form.Item label='Reason' field='reason'>
          <Input.TextArea rows={2} placeholder='Optional reason for this rule' />
        </Form.Item>

        <Form.Item label='Tags (comma-separated)' field='tags'>
          <Input placeholder='tag1, tag2, tag3' />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RuleFormModal;

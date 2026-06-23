/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Undo Tool Call — reverts the file changes made by a single tool call.
 *
 * Renders an icon button (sibling to RestorePlanPreview) that opens a
 * confirmation dialog. On confirm, calls
 * `ipcBridge.conversation.revertToolCall.invoke` which undoes the file
 * changes the tool made. OpenCode session state is NOT changed.
 *
 * The component mirrors RestorePlanPreview's button/modal structure so the
 * two sit side-by-side with consistent visual weight.
 */

import { ipcBridge } from '@/common';
import { Button, Message, Tooltip } from '@arco-design/web-react';
import { Undo } from '@icon-park/react';
import React, { useCallback, useState } from 'react';
import AionModal from '@/renderer/components/base/AionModal';
import { iconColors } from '@/renderer/styles/colors';

export type UndoToolCallProps = {
  conversationId: string;
  toolCallId: string;
  disabled?: boolean;
  messageApi?: ReturnType<typeof Message.useMessage>[0];
};

const UndoToolCall: React.FC<UndoToolCallProps> = ({ conversationId, toolCallId, disabled, messageApi }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      setOpen(true);
    },
    [disabled]
  );

  const handleCancel = useCallback(() => {
    if (loading) return;
    setOpen(false);
  }, [loading]);

  const handleConfirm = useCallback(async () => {
    if (loading || !conversationId || !toolCallId) return;

    setLoading(true);
    try {
      const result = await ipcBridge.conversation.revertToolCall.invoke({
        conversation_id: conversationId,
        tool_call_id: toolCallId,
      });

      const toast = messageApi ?? Message;
      if (typeof result.files_reverted === 'number') {
        toast.success(`Tool call reverted — ${result.files_reverted} file(s) restored`);
      } else {
        toast.success('Tool call reverted');
      }

      setOpen(false);
    } catch (error) {
      const toast = messageApi ?? Message;
      toast.error('Failed to revert tool call');
      console.error('[UndoToolCall] revert failed:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, conversationId, toolCallId, messageApi]);

  return (
    <>
      <Tooltip content='Revert this tool call'>
        <button
          type='button'
          className='p-4px rd-4px cursor-pointer hover:bg-3 transition-colors shrink-0'
          onClick={handleOpen}
          disabled={disabled}
          aria-label='Revert this tool call'
          style={{ lineHeight: 0 }}
        >
          <Undo size={14} fill={disabled ? iconColors.disabled : iconColors.secondary} />
        </button>
      </Tooltip>
      <AionModal
        visible={open}
        size='small'
        style={{ width: 440, height: 'auto' }}
        header={{
          title: 'Revert this tool call?',
          showClose: true,
        }}
        contentStyle={{ padding: '16px 20px 0' }}
        onCancel={handleCancel}
        footer={{
          render: () => (
            <div className='flex justify-end gap-10px pt-16px'>
              <Button
                className='px-16px min-w-80px'
                style={{ borderRadius: 'var(--radius-control)' }}
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type='primary'
                status='danger'
                className='px-16px min-w-80px'
                style={{ borderRadius: 'var(--radius-control)' }}
                onClick={handleConfirm}
                loading={loading}
              >
                Revert
              </Button>
            </div>
          ),
        }}
      >
        <div className='text-13px text-t-secondary leading-18px'>
          Reverting this call will undo the file changes this tool made. The OpenCode session state is NOT changed.
        </div>
      </AionModal>
    </>
  );
};

export default UndoToolCall;

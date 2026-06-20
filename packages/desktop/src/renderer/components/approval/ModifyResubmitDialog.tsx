/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Input, Modal } from '@arco-design/web-react';
import React, { useCallback, useState } from 'react';

export type ModifyResubmitDialogProps = {
  visible: boolean;
  command: string;
  onCancel: () => void;
  onResubmit: (modifiedCommand: string) => void;
};

const ModifyResubmitDialog: React.FC<ModifyResubmitDialogProps> = ({ visible, command, onCancel, onResubmit }) => {
  const [modifiedCommand, setModifiedCommand] = useState(command);

  React.useEffect(() => {
    if (visible) setModifiedCommand(command);
  }, [visible, command]);

  const handleResubmit = useCallback(() => {
    const trimmed = modifiedCommand.trim();
    if (!trimmed) return;
    onResubmit(trimmed);
  }, [modifiedCommand, onResubmit]);

  return (
    <Modal title='Edit & Resend' visible={visible} onCancel={onCancel} footer={null} unmountOnExit autoFocus>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input.TextArea
          value={modifiedCommand}
          onChange={setModifiedCommand}
          autoSize={{ minRows: 3, maxRows: 12 }}
          style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)', fontSize: 13 }}
          data-testid='modify-resubmit-textarea'
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button size='small' onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type='primary'
            size='small'
            disabled={!modifiedCommand.trim()}
            onClick={handleResubmit}
            data-testid='modify-resubmit-submit'
          >
            Resend
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ModifyResubmitDialog;

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chat/chatLib';
import {
  computeCompactionRegion,
  isCompactionSummaryTranscriptMessage,
} from '@/renderer/pages/conversation/Messages/hooks';
import { describe, expect, it } from 'vitest';

function makeTextMessage(opts: { id: string; msgId: string; opencodeMessageId?: string }): TMessage {
  return {
    id: opts.id,
    msg_id: opts.msgId,
    conversation_id: 'conv-1',
    type: 'text',
    position: 'left',
    content: {
      content: 'hello',
      ...(opts.opencodeMessageId ? { _opencode: { message_id: opts.opencodeMessageId } } : {}),
    },
    created_at: 1,
  };
}

describe('computeCompactionRegion', () => {
  it('resolves OpenCode messageID via content._opencode when msg_id differs', () => {
    const list = [
      makeTextMessage({ id: 'm-1', msgId: 'a1b2c3d4', opencodeMessageId: 'msg_opencode_start' }),
      makeTextMessage({ id: 'm-2', msgId: 'e5f6g7h8', opencodeMessageId: 'msg_opencode_end' }),
    ];
    expect(
      computeCompactionRegion(list, {
        compaction_start_message_id: 'msg_opencode_start',
      })
    ).toBe(0);
  });

  it('anchors on the boundary (compaction_end_message_id) when present', () => {
    const list = [
      makeTextMessage({ id: 'm-1', msgId: 'a1b2c3d4', opencodeMessageId: 'msg_opencode_start' }),
      makeTextMessage({ id: 'm-2', msgId: 'e5f6g7h8', opencodeMessageId: 'msg_opencode_end' }),
    ];
    expect(
      computeCompactionRegion(list, {
        compaction_start_message_id: 'msg_opencode_start',
        compaction_end_message_id: 'msg_opencode_end',
      })
    ).toBe(1);
  });

  it('returns null when anchor missing from list', () => {
    const list = [makeTextMessage({ id: 'm-1', msgId: 'local-only' })];
    expect(computeCompactionRegion(list, { compaction_start_message_id: 'unknown' })).toBeNull();
  });

  it('resolves a local row boundary fallback', () => {
    const list = [makeTextMessage({ id: 'm-1', msgId: 'local-boundary' })];
    expect(computeCompactionRegion(list, { compaction_end_message_id: 'local-boundary' })).toBe(0);
  });

  it('identifies summary transcript row so extra summary does not duplicate it', () => {
    const message = makeTextMessage({
      id: 'm-summary',
      msgId: 'local-summary',
      opencodeMessageId: 'msg_summary',
    });

    expect(
      isCompactionSummaryTranscriptMessage(message, {
        compaction_summary_message_id: 'msg_summary',
        compaction_summary: '# Goal\nSummarized context',
      })
    ).toBe(true);
  });

  it('does not hide summary transcript row when extra summary is absent', () => {
    const message = makeTextMessage({
      id: 'm-summary',
      msgId: 'local-summary',
      opencodeMessageId: 'msg_summary',
    });

    expect(
      isCompactionSummaryTranscriptMessage(message, {
        compaction_summary_message_id: 'msg_summary',
        compaction_summary: null,
      })
    ).toBe(false);
  });
});

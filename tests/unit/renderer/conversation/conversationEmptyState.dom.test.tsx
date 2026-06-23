/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * ConversationEmptyState unit tests. Verifies the message-list empty state
 * renders via the shared EmptyState primitive and keeps the Chisl dot-grid
 * backdrop element so the message surface stays visually anchored when there
 * are no messages.
 */

import ConversationEmptyState from '@/renderer/pages/conversation/Messages/ConversationEmptyState';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
  }),
}));

describe('ConversationEmptyState', () => {
  it('renders the start-a-conversation prompt via the shared EmptyState primitive', () => {
    const { container } = render(<ConversationEmptyState />);

    expect(screen.getByText('Start a conversation...')).toBeTruthy();
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
    expect(container.querySelector('[data-empty-state-title]')).not.toBeNull();
  });

  it('renders the Chisl dot-grid backdrop element', () => {
    render(<ConversationEmptyState />);
    expect(screen.getByTestId('conversation-empty-state-backdrop')).toBeTruthy();
  });
});

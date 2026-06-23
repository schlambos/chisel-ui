/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * EmptyState unit tests. Verifies the shared empty-state primitive renders
 * the required title, omits optional slots (description, action, icon) when
 * not provided, and surfaces them faithfully when callers pass them in.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import EmptyState from '@/renderer/components/base/feedback/EmptyState';

describe('EmptyState', () => {
  it('renders the title text', () => {
    render(<EmptyState title='No conversations yet' />);
    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });

  it('renders the description when provided', () => {
    render(<EmptyState title='Nothing here' description='Start a new chat to begin.' />);
    expect(screen.getByText('Start a new chat to begin.')).toBeTruthy();
  });

  it('does not render a description when none is provided', () => {
    const { container } = render(<EmptyState title='Nothing here' />);
    expect(container.querySelector('[data-empty-state-description]')).toBeNull();
  });

  it('renders the action element when provided', () => {
    render(
      <EmptyState
        title='Empty'
        action={
          <button type='button' data-testid='empty-state-action'>
            Create
          </button>
        }
      />
    );
    expect(screen.getByTestId('empty-state-action')).toBeTruthy();
  });

  it('does not render an action slot when none is provided', () => {
    const { container } = render(<EmptyState title='Empty' />);
    expect(container.querySelector('[data-empty-state-action]')).toBeNull();
  });

  it('renders the icon when provided', () => {
    render(<EmptyState icon={<svg data-testid='empty-state-icon' aria-hidden='true' />} title='Empty' />);
    expect(screen.getByTestId('empty-state-icon')).toBeTruthy();
  });
});

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * ErrorBanner unit tests. Verifies the shared inline error/warning banner
 * renders its title, optionally surfaces a message and Retry action, exposes
 * `role="alert"` for screen readers, and applies the correct severity marker.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBanner from '@/renderer/components/base/feedback/ErrorBanner';

describe('ErrorBanner', () => {
  it('renders the title text', () => {
    render(<ErrorBanner title='Could not load conversations' />);
    expect(screen.getByText('Could not load conversations')).toBeTruthy();
  });

  it('renders the message when provided', () => {
    render(<ErrorBanner title='Sync failed' message='The server returned a 502 response.' />);
    expect(screen.getByText('The server returned a 502 response.')).toBeTruthy();
  });

  it('does not render a message when none is provided', () => {
    const { container } = render(<ErrorBanner title='Sync failed' />);
    expect(container.querySelector('[data-error-banner-message]')).toBeNull();
  });

  it('exposes role="alert" on the root for assistive tech', () => {
    render(<ErrorBanner title='Heads up' />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders a Retry button when onRetry is provided', () => {
    render(<ErrorBanner title='Sync failed' onRetry={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('invokes onRetry when the Retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner title='Sync failed' onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render a Retry button when onRetry is not provided', () => {
    render(<ErrorBanner title='Sync failed' />);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('applies the error severity by default', () => {
    render(<ErrorBanner title='Sync failed' />);
    expect(screen.getByRole('alert').getAttribute('data-severity')).toBe('error');
  });

  it('applies the warning severity when requested', () => {
    render(<ErrorBanner title='Heads up' severity='warning' />);
    expect(screen.getByRole('alert').getAttribute('data-severity')).toBe('warning');
  });
});

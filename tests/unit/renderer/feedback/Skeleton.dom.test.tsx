/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Skeleton primitive unit tests. Locks the public surface used by feature
 * screens: placeholder count, variant routing, inline sizing, and the
 * reduced-motion contract that suppresses the shimmer animation.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Skeleton from '@/renderer/components/base/feedback/Skeleton';

type MediaQueryListener = (event: MediaQueryListEvent) => void;

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(reducedMotion: boolean): void {
  const listeners = new Set<MediaQueryListener>();
  const stub = (query: string): MediaQueryList => {
    const matches = query.includes('prefers-reduced-motion: reduce') ? reducedMotion : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_event: string, listener: MediaQueryListener) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: MediaQueryListener) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    } as MediaQueryList;
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn(stub),
  });
}

describe('Skeleton', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it('renders N placeholders when count=N', () => {
    render(<Skeleton count={3} />);
    expect(screen.getAllByTestId('skeleton').length).toBe(3);
  });

  it('renders a single placeholder by default', () => {
    render(<Skeleton />);
    expect(screen.getAllByTestId('skeleton').length).toBe(1);
  });

  it.each([
    ['block' as const],
    ['pill' as const],
    ['circle' as const],
  ])('applies variant data attribute for %s', (variant) => {
    render(<Skeleton variant={variant} />);
    const node = screen.getByTestId('skeleton');
    expect(node.getAttribute('data-variant')).toBe(variant);
  });

  it('defaults to the block variant', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton').getAttribute('data-variant')).toBe('block');
  });

  it('forwards width and height to inline style', () => {
    render(<Skeleton width='120px' height={24} />);
    const node = screen.getByTestId('skeleton');
    expect(node.style.width).toBe('120px');
    expect(node.style.height).toBe('24px');
  });

  it('marks elements as decorative for assistive tech', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton').getAttribute('aria-hidden')).toBe('true');
  });

  it('flags reduced-motion when the user prefers reduced motion', () => {
    mockMatchMedia(true);
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton').getAttribute('data-reduced')).toBe('true');
  });

  it('does not flag reduced-motion when the user has no preference', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton').getAttribute('data-reduced')).toBe('false');
  });
});

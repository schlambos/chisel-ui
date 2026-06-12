/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for `useMobileViewport`.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
}));

import { useMobileViewport } from '@/renderer/hooks/system/useMobileViewport';

describe('useMobileViewport', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it('reports the current viewport width on mount', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
    const { result } = renderHook(() => useMobileViewport());
    expect(result.current.viewportWidth).toBe(1280);
  });

  it('reports isMobile=false for a wide viewport on Electron', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true, configurable: true });
    const { result } = renderHook(() => useMobileViewport());
    expect(result.current.isMobile).toBe(false);
  });

  it('reports isMobile=true for a narrow viewport on Electron', () => {
    Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });
    const { result } = renderHook(() => useMobileViewport());
    expect(result.current.isMobile).toBe(true);
  });

  it('updates viewportWidth on resize', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
    const { result } = renderHook(() => useMobileViewport());
    expect(result.current.viewportWidth).toBe(1024);

    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.viewportWidth).toBe(800);
  });

  it('registers and removes the resize listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useMobileViewport());
    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});

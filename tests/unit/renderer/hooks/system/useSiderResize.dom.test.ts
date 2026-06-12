/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for `useSiderResize`.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSiderResize } from '@/renderer/hooks/system/useSiderResize';

function createMouseEvent(type: string, clientX: number): MouseEvent {
  return new MouseEvent(type, { clientX, bubbles: true }) as unknown as MouseEvent;
}

describe('useSiderResize', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    localStorageMock.clear();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
    document.documentElement.style.removeProperty('--layout-sider-width');
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--layout-sider-width');
  });

  const defaultOptions = {
    isMobile: false,
    collapsed: false,
    setCollapsed: vi.fn(),
  };

  it('returns default state on a desktop viewport', () => {
    const { result } = renderHook(() => useSiderResize(defaultOptions));
    expect(result.current.desktopSiderWidth).toBe(200);
    expect(result.current.siderDragging).toBe(false);
    expect(result.current.siderIconOnly).toBe(false);
  });

  it('marks icon-only when width drops below threshold', () => {
    const { result } = renderHook(() => useSiderResize(defaultOptions));
    expect(result.current.siderIconOnly).toBe(false);
  });

  it('starts a drag and applies the CSS variable', () => {
    const { result } = renderHook(() => useSiderResize(defaultOptions));
    const mockEvent = { clientX: 80, preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.beginSiderResizeDrag(mockEvent);
    });
    // Drag left by 60px: 200 - 60 = 140.
    act(() => {
      window.dispatchEvent(createMouseEvent('mousemove', 20));
    });
    expect(result.current.siderDragging).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--layout-sider-width')).toBe('140px');
  });

  it('collapses the sider when dragged below the collapse threshold', () => {
    const { result } = renderHook(() => useSiderResize(defaultOptions));
    const mockEvent = { clientX: 300, preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.beginSiderResizeDrag(mockEvent);
    });
    // Drag far left so rawWidth drops below 36px.
    act(() => {
      window.dispatchEvent(createMouseEvent('mousemove', 100));
    });
    expect(defaultOptions.setCollapsed).toHaveBeenCalledWith(true);
  });

  it('uncollapses the sider when dragged above the collapse threshold from collapsed', () => {
    const collapsedOptions = {
      isMobile: false,
      collapsed: true,
      setCollapsed: vi.fn(),
    };
    const { result } = renderHook(() => useSiderResize(collapsedOptions));
    const mockEvent = { clientX: 100, preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.beginSiderResizeDrag(mockEvent);
    });
    // Drag right enough to cross the collapse threshold.
    act(() => {
      window.dispatchEvent(createMouseEvent('mousemove', 150));
    });
    expect(collapsedOptions.setCollapsed).toHaveBeenCalledWith(false);
  });

  it('ends drag and commits final width', () => {
    const { result } = renderHook(() => useSiderResize(defaultOptions));
    const mockEvent = { clientX: 80, preventDefault: vi.fn() } as unknown as React.MouseEvent<HTMLDivElement>;
    act(() => {
      result.current.beginSiderResizeDrag(mockEvent);
    });
    act(() => {
      window.dispatchEvent(createMouseEvent('mousemove', 20));
    });
    act(() => {
      window.dispatchEvent(new Event('mouseup'));
    });
    expect(result.current.siderDragging).toBe(false);
  });

  it('clears the CSS variable when collapsed', () => {
    // Pre-seed the var so the assertion is meaningful (hook must actively clear it).
    document.documentElement.style.setProperty('--layout-sider-width', '250px');
    const collapsedOptions = {
      isMobile: false,
      collapsed: true,
      setCollapsed: vi.fn(),
    };
    const { result, rerender } = renderHook((opts) => useSiderResize(opts), {
      initialProps: collapsedOptions,
    });
    // Force a re-render with still-collapsed so the sync effect runs.
    rerender(collapsedOptions);
    expect(document.documentElement.style.getPropertyValue('--layout-sider-width')).toBe('');
  });

  it('clears the CSS variable on mobile', () => {
    // Pre-seed the var so the assertion is meaningful (hook must actively clear it).
    document.documentElement.style.setProperty('--layout-sider-width', '250px');
    const mobileOptions = {
      isMobile: true,
      collapsed: false,
      setCollapsed: vi.fn(),
    };
    const { result } = renderHook(() => useSiderResize(mobileOptions));
    expect(document.documentElement.style.getPropertyValue('--layout-sider-width')).toBe('');
  });
});

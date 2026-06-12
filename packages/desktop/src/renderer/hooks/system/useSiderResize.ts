/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Sider resize constants                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_SIDER_WIDTH = 200;
export const SIDER_MIN_WIDTH = 56;
export const SIDER_MAX_WIDTH = 380;
export const SIDER_ICON_ONLY_THRESHOLD = 90;
export const SIDER_COLLAPSE_THRESHOLD = 36;
export const SIDER_WIDTH_STORAGE_KEY = 'aionui.siderWidth';
export const MOBILE_SIDER_WIDTH_RATIO = 0.7;
export const MOBILE_SIDER_MIN_WIDTH = 240;
export const MOBILE_SIDER_MAX_WIDTH = 320;

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

const readStoredSiderWidth = (): number => {
  if (typeof window === 'undefined') return DEFAULT_SIDER_WIDTH;
  try {
    const raw = window.localStorage.getItem(SIDER_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(SIDER_MAX_WIDTH, Math.max(SIDER_MIN_WIDTH, parsed));
    }
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_SIDER_WIDTH;
};

const persistSiderWidth = (value: number): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDER_WIDTH_STORAGE_KEY, String(Math.round(value)));
  } catch {
    /* localStorage unavailable */
  }
};

/* ------------------------------------------------------------------ */
/*  Hook API                                                          */
/* ------------------------------------------------------------------ */

export type UseSiderResizeResult = {
  desktopSiderWidth: number;
  siderDragging: boolean;
  siderIconOnly: boolean;
  beginSiderResizeDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  resizeBy: (delta: number) => void;
};

export type UseSiderResizeOptions = {
  isMobile: boolean;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
};

/**
 * Owns all sider-resize concerns:
 *  - width state + localStorage persistence
 *  - drag refs
 *  - applySiderWidthVar / clearSiderWidthVar
 *  - mousemove / mouseup / blur drag effect
 *  - CSS-var sync effect
 *  - icon-only threshold logic
 *
 * Layout passes `setCollapsed` so the drag handler can toggle collapse when
 * crossing the collapse threshold — that behavior stays identical to before.
 */
export const SIDER_RESIZE_STEP = 16;

export const useSiderResize = ({ isMobile, collapsed, setCollapsed }: UseSiderResizeOptions): UseSiderResizeResult => {
  const [desktopSiderWidth, setDesktopSiderWidth] = useState<number>(readStoredSiderWidth);
  const [siderDragging, setSiderDragging] = useState(false);

  const collapsedRef = useRef(collapsed);
  const desktopSiderWidthRef = useRef(desktopSiderWidth);
  const dragWidthRef = useRef(0);
  const prevDragWidthRef = useRef<number | null>(null);

  const dragStateRef = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: DEFAULT_SIDER_WIDTH,
  });

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    desktopSiderWidthRef.current = desktopSiderWidth;
  }, [desktopSiderWidth]);

  const applySiderWidthVar = useCallback((px: number) => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--layout-sider-width', `${px}px`);
    }
  }, []);

  const clearSiderWidthVar = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.removeProperty('--layout-sider-width');
    }
  }, []);

  // Keep the CSS variable in sync with the committed width outside of drag,
  // and clear it when the sider is collapsed or on mobile.
  useEffect(() => {
    if (isMobile || collapsed) {
      clearSiderWidthVar();
      return;
    }
    applySiderWidthVar(desktopSiderWidth);
  }, [desktopSiderWidth, isMobile, collapsed, applySiderWidthVar, clearSiderWidthVar]);

  const beginSiderResizeDrag = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      event.preventDefault();
      const startWidth = collapsedRef.current ? 0 : desktopSiderWidthRef.current;
      dragStateRef.current = {
        active: true,
        startX: event.clientX,
        startWidth,
      };
      dragWidthRef.current = startWidth;
      prevDragWidthRef.current = desktopSiderWidthRef.current;
      setSiderDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      if (!collapsedRef.current && startWidth > 0) {
        applySiderWidthVar(startWidth);
      }
    },
    [isMobile, applySiderWidthVar]
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState.active) return;

      const rawWidth = dragState.startWidth + (event.clientX - dragState.startX);

      if (rawWidth < SIDER_COLLAPSE_THRESHOLD) {
        if (!collapsedRef.current) {
          setCollapsed(true);
        }
        return;
      }

      const clamped = Math.min(SIDER_MAX_WIDTH, Math.max(SIDER_MIN_WIDTH, rawWidth));
      if (collapsedRef.current) {
        setCollapsed(false);
      }

      // Drive the visual width via CSS variable — no React re-render.
      dragWidthRef.current = clamped;
      applySiderWidthVar(clamped);

      // Commit state once when crossing the icon-only threshold so the
      // `layout-sider--icon-only` class flips without per-frame re-renders.
      const prevWidth = prevDragWidthRef.current ?? desktopSiderWidthRef.current;
      const prevIconOnly = prevWidth < SIDER_ICON_ONLY_THRESHOLD;
      const currIconOnly = clamped < SIDER_ICON_ONLY_THRESHOLD;
      if (prevIconOnly !== currIconOnly) {
        setDesktopSiderWidth(clamped);
        prevDragWidthRef.current = clamped;
      }
    };

    const endDrag = () => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      setSiderDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const finalWidth = dragWidthRef.current;
      if (!collapsedRef.current && finalWidth > 0) {
        setDesktopSiderWidth(finalWidth);
        persistSiderWidth(finalWidth);
        applySiderWidthVar(finalWidth);
      }
      dragWidthRef.current = 0;
      prevDragWidthRef.current = null;
    };

    const handleBlur = () => endDrag();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('blur', handleBlur);
      endDrag();
    };
  }, [applySiderWidthVar, clearSiderWidthVar, setCollapsed]);

  const resizeBy = useCallback(
    (delta: number) => {
      if (isMobile || collapsed) return;
      const next = Math.min(SIDER_MAX_WIDTH, Math.max(SIDER_MIN_WIDTH, desktopSiderWidthRef.current + delta));
      const clampedDelta = next - desktopSiderWidthRef.current;
      if (clampedDelta === 0) return;
      setDesktopSiderWidth(next);
      persistSiderWidth(next);
      applySiderWidthVar(next);
      // Mirror drag behavior: update icon-only threshold if crossing it.
      const prevWidth = prevDragWidthRef.current ?? desktopSiderWidthRef.current;
      const prevIconOnly = prevWidth < SIDER_ICON_ONLY_THRESHOLD;
      const currIconOnly = next < SIDER_ICON_ONLY_THRESHOLD;
      if (prevIconOnly !== currIconOnly) {
        prevDragWidthRef.current = next;
      }
    },
    [isMobile, collapsed, applySiderWidthVar]
  );

  const siderIconOnly = !isMobile && !collapsed && desktopSiderWidth < SIDER_ICON_ONLY_THRESHOLD;

  return {
    desktopSiderWidth,
    siderDragging,
    siderIconOnly,
    beginSiderResizeDrag,
    resizeBy,
  };
};

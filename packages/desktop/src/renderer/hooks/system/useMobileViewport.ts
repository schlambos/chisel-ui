/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { isElectronDesktop } from '@renderer/utils/platform';

export type UseMobileViewportResult = {
  isMobile: boolean;
  viewportWidth: number;
};

const detectMobileViewportOrTouch = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isElectronDesktop()) {
    return window.innerWidth < 768;
  }
  const width = window.innerWidth;
  const byWidth = width < 768;
  // Treat touch/coarse pointer as mobile only on smaller viewports
  // to avoid misclassifying touch-enabled laptops.
  const smallScreen = width < 1024;
  const byMedia = window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches;
  const byTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return byWidth || (smallScreen && (byMedia || byTouchPoints));
};

/**
 * Detects mobile viewport and tracks window width. Owns the resize listener
 * so Layout and any future consumer can share the same detection without
 * duplicating effects.
 *
 * NOTE: auto-collapse effects (collapsing the sider/pane on mobile entry) stay
 * in Layout because they depend on Layout-local `setCollapsed` state — we do
 * not force an awkward callback API here.
 */
export const useMobileViewport = (): UseMobileViewportResult => {
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 390 : window.innerWidth
  );

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(detectMobileViewportOrTouch());
      setViewportWidth(window.innerWidth);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return { isMobile, viewportWidth };
};

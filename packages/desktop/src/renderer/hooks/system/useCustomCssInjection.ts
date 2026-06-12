/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ICssTheme } from '@/common/config/storage';
import { processCustomCss } from '@renderer/utils/theme/customCssProcessor';
import { computeCssSyncDecision, resolveCssByActiveTheme } from '@renderer/utils/theme/themeCssSync';
import { DEFAULT_THEME_ID } from '@renderer/pages/settings/DisplaySettings/presets';
import { configService } from '@/common/config/configService';

/* ------------------------------------------------------------------ */
/*  Hook API                                                          */
/* ------------------------------------------------------------------ */

export type UseCustomCssInjectionOptions = {
  /** Current pathname (or any route signal) — used for settings-transition gating. */
  pathname: string;
  /** Currently injected CSS string — passed into the decision so the sync
   *  logic can detect external updates (e.g. from the settings page). */
  customCss: string;
};

export type UseCustomCssInjectionResult = {
  /** Returns the effective CSS string to inject. May re-trigger a re-sync
   *  when the caller knows something changed (e.g. settings save). */
  loadAndHealCustomCss: () => Promise<void>;
};

/* ------------------------------------------------------------------ */
/*  Implementation                                                    */
/* ------------------------------------------------------------------ */

export const useCustomCssInjection = ({
  pathname,
  customCss,
}: UseCustomCssInjectionOptions): UseCustomCssInjectionResult => {
  const lastCssRef = useRef('');
  const lastUiCssUpdateAtRef = useRef(0);
  const prevPathnameRef = useRef(pathname);
  const isFirstMountRef = useRef(true);

  const loadAndHealCustomCss = useCallback(async () => {
    try {
      const [savedCssRaw, activeThemeId, savedThemes] = await Promise.all([
        configService.get('customCss'),
        configService.get('css.activeThemeId'),
        configService.get('css.themes'),
      ]);

      const decision = computeCssSyncDecision({
        savedCss: savedCssRaw || '',
        activeThemeId: activeThemeId || '',
        savedThemes: (savedThemes || []) as ICssTheme[],
        currentUiCss: customCss,
        lastUiCssUpdateAt: lastUiCssUpdateAtRef.current,
      });

      if (decision.shouldSkipApply) {
        return;
      }

      let effectiveCss = decision.effectiveCss;

      // If the active theme resolved to empty CSS and there IS a saved activeThemeId
      // (but it no longer matches any known theme), fall back to the built-in default and persist.
      if (!effectiveCss && activeThemeId && activeThemeId !== DEFAULT_THEME_ID) {
        const defaultCss = resolveCssByActiveTheme(DEFAULT_THEME_ID, (savedThemes || []) as ICssTheme[]);
        effectiveCss = defaultCss;
        // Persist the fallback so Layout doesn't keep retrying
        await Promise.all([
          configService.set('css.activeThemeId', DEFAULT_THEME_ID),
          configService.set('customCss', effectiveCss),
        ]).catch((error) => {
          console.warn('Failed to persist theme fallback:', error);
        });
      } else if (decision.shouldHealStorage) {
        await configService.set('customCss', effectiveCss).catch((error) => {
          console.warn('Failed to heal custom CSS from active theme:', error);
        });
      }

      if (lastCssRef.current !== effectiveCss) {
        lastCssRef.current = effectiveCss;
        window.dispatchEvent(new CustomEvent('custom-css-updated', { detail: { customCss: effectiveCss } }));
      }
    } catch (error) {
      console.error('Failed to load or heal custom CSS:', error);
    }
  }, [customCss]);

  // Load on mount + listen for external updates / storage changes.
  useEffect(() => {
    void loadAndHealCustomCss();

    const handleCssUpdate = (event: CustomEvent) => {
      if (event.detail?.customCss !== undefined) {
        const css = event.detail.customCss || '';
        lastCssRef.current = css;
        lastUiCssUpdateAtRef.current = Date.now();
        // Note: the caller's state update is driven by the event listener
        // in the component that owns `customCss` state. This hook only
        // tracks the internal refs; the component wires setCustomCss itself.
      }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && (event.key.includes('customCss') || event.key.includes('css.activeThemeId'))) {
        void loadAndHealCustomCss();
      }
    };

    window.addEventListener('custom-css-updated', handleCssUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('custom-css-updated', handleCssUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadAndHealCustomCss]);

  // Re-sync theme CSS on route changes — only when entering/leaving settings
  // routes, because some settings pages do not mount CssThemeSettings.
  // Initial mount always runs.
  const shouldReSyncCss = useCallback((): boolean => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevPathnameRef.current = pathname;
      return true;
    }
    const prev = prevPathnameRef.current;
    const curr = pathname;
    const wasSettings = prev.startsWith('/settings');
    const isSettings = curr.startsWith('/settings');
    const enteringLeavingSettings = wasSettings !== isSettings;
    prevPathnameRef.current = curr;
    return enteringLeavingSettings;
  }, [pathname]);

  useEffect(() => {
    if (shouldReSyncCss()) {
      void loadAndHealCustomCss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loadAndHealCustomCss, shouldReSyncCss]);

  return { loadAndHealCustomCss };
};

/* ------------------------------------------------------------------ */
/*  Style-tag injection effect (kept in this hook so Layout knows      */
/*  nothing about document.head)                                       */
/* ------------------------------------------------------------------ */

export const useCustomCssStyleInjection = (customCss: string): void => {
  useEffect(() => {
    const styleId = 'user-defined-custom-css';

    if (!customCss) {
      document.getElementById(styleId)?.remove();
      return;
    }

    const wrappedCss = processCustomCss(customCss);

    const ensureStyleAtEnd = () => {
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

      if (styleEl && styleEl.textContent === wrappedCss && styleEl === document.head.lastElementChild) {
        return;
      }

      styleEl?.remove();
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.type = 'text/css';
      styleEl.textContent = wrappedCss;
      document.head.appendChild(styleEl);
    };

    ensureStyleAtEnd();

    const observer = new MutationObserver((mutations) => {
      const hasNewStyle = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => node.nodeName === 'STYLE' || node.nodeName === 'LINK')
      );

      if (hasNewStyle) {
        const element = document.getElementById(styleId);
        if (element && element !== document.head.lastElementChild) {
          ensureStyleAtEnd();
        }
      }
    });

    observer.observe(document.head, { childList: true });

    return () => {
      observer.disconnect();
      document.getElementById(styleId)?.remove();
    };
  }, [customCss]);
};

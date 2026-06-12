/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { TEAM_MODE_ENABLED } from '@/common/config/constants';
import { configService } from '@/common/config/configService';
import type { ICssTheme } from '@/common/config/storage';
import PwaPullToRefresh from '@/renderer/components/layout/PwaPullToRefresh';
import Titlebar from '@/renderer/components/layout/Titlebar';
import { Layout as ArcoLayout } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutContext } from '@renderer/hooks/context/LayoutContext';
import { LayoutModeProvider } from '@renderer/hooks/context/LayoutModeContext';
import { NavigationHistoryProvider } from '@renderer/hooks/context/NavigationHistoryContext';
import { TerminalPanelProvider } from '@renderer/hooks/context/TerminalPanelContext';
import TerminalPanelHost from '@/renderer/components/layout/TerminalPanel/TerminalPanelHost';
import { useDeepLink } from '@renderer/hooks/system/useDeepLink';
import { useNotificationClick } from '@renderer/hooks/system/useNotificationClick';
import { useMainProcessLogBridge } from '@renderer/hooks/system/useMainProcessLogBridge';
import { useTrayEventHandlers } from '@renderer/hooks/system/useTrayEventHandlers';
import { useMobileViewport } from '@renderer/hooks/system/useMobileViewport';
import {
  useSiderResize,
  MOBILE_SIDER_MIN_WIDTH,
  MOBILE_SIDER_MAX_WIDTH,
  MOBILE_SIDER_WIDTH_RATIO,
  SIDER_MIN_WIDTH,
  SIDER_MAX_WIDTH,
} from '@renderer/hooks/system/useSiderResize';
import { useDirectorySelection } from '@renderer/hooks/file/useDirectorySelection';
import SidebarIcon from '@renderer/components/layout/icons/SidebarIcon';
import { processCustomCss } from '@renderer/utils/theme/customCssProcessor';
import { cleanupSiderTooltips } from '@renderer/utils/ui/siderTooltip';
import { useConversationShortcuts } from '@renderer/hooks/ui/useConversationShortcuts';
import { computeCssSyncDecision, resolveCssByActiveTheme } from '@renderer/utils/theme/themeCssSync';
import { DEFAULT_THEME_ID } from '@renderer/pages/settings/DisplaySettings/presets';
import { dispatchConversationPaneStateEvent } from '@renderer/utils/conversationPane/events';
import ConversationPane from '@renderer/components/layout/ConversationPane';
import { useTerminalPanelSafe } from '@renderer/hooks/context/TerminalPanelContext';
import { useLayoutModeSafe } from '@renderer/hooks/context/LayoutModeContext';
import { useEditorContextSafe } from '@renderer/pages/conversation/Editor';
import { dispatchWorkspaceSetCollapsedEvent } from '@renderer/utils/workspace/workspaceEvents';
import { useEditorDock } from '@renderer/utils/layout/editorDock';
import '@renderer/styles/layout.css';

const UpdateModal = React.lazy(() => import('@/renderer/components/settings/UpdateModal'));
// Command Center editor pane — a single shell-level editor host rendered as a
// peer column to the LEFT of the chat content on all non-team routes
// (conversation, /guid, settings). Monaco stays lazy inside it.
const CommandCenterEditorHost = React.lazy(() => import('@/renderer/components/layout/CommandCenterEditorHost'));

const LayoutModeOrchestrator: React.FC<{
  setCollapsed: (val: boolean) => void;
  isDesktop: boolean;
}> = ({ setCollapsed, isDesktop }) => {
  const layoutMode = useLayoutModeSafe();
  const terminalCtx = useTerminalPanelSafe();
  const editorCtx = useEditorContextSafe();

  const activeMode = layoutMode?.mode;
  const prevModeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isDesktop || !activeMode) return;
    if (activeMode === prevModeRef.current) return;
    prevModeRef.current = activeMode;

    if (activeMode === 'command-center') {
      setCollapsed(false);
      dispatchWorkspaceSetCollapsedEvent(false);
      terminalCtx?.open_();
      if (!editorCtx?.buffers?.length) {
        editorCtx?.openUntitledEditor();
      } else {
        editorCtx?.expandEditor();
      }
    }
    if (activeMode === 'chat') {
      setCollapsed(true);
      dispatchWorkspaceSetCollapsedEvent(true);
      editorCtx?.hideEditor();
      if (!terminalCtx?.pinned) {
        terminalCtx?.close();
      }
    }
  }, [activeMode, isDesktop, setCollapsed, terminalCtx, editorCtx]);

  return null;
};

const CONVERSATION_PANE_COLLAPSE_KEY = 'aionui.conversationPaneCollapsed';

// Default: OPEN on desktop so the conversation list is immediately usable.
const readStoredConversationPaneCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONVERSATION_PANE_COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
};

const persistConversationPaneCollapsed = (value: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONVERSATION_PANE_COLLAPSE_KEY, String(value));
  } catch {
    /* localStorage unavailable */
  }
};

const Layout: React.FC<{
  sider: React.ReactNode;
  onSessionClick?: () => void;
}> = ({ sider, onSessionClick: _onSessionClick }) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(true);
  const [conversationPaneCollapsed, setConversationPaneCollapsedState] = useState<boolean>(
    readStoredConversationPaneCollapsed
  );
  const [customCss, setCustomCss] = useState<string>('');
  const [shouldMountUpdateModal, setShouldMountUpdateModal] = useState(false);
  const { contextHolder: directorySelectionContextHolder } = useDirectorySelection();
  useDeepLink();
  useNotificationClick();
  const navigate = useNavigate();
  useConversationShortcuts({ navigate });
  const location = useLocation();
  const workspaceAvailable =
    location.pathname.startsWith('/conversation/') || (TEAM_MODE_ENABLED && location.pathname.startsWith('/team/'));
  const isConversationRoute = location.pathname.startsWith('/conversation/');
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const { dock: editorDock } = useEditorDock();
  const conversationPaneEnabled = !isSettingsRoute;

  const { isMobile, viewportWidth } = useMobileViewport();

  const { desktopSiderWidth, siderDragging, siderIconOnly, beginSiderResizeDrag } = useSiderResize({
    isMobile,
    collapsed,
    setCollapsed,
  });

  // Guard against transition-on-mount for the mobile sider: add a class after
  // the first render so CSS only enables the open/close transition after the
  // initial collapsed state is committed.
  const [siderMounted, setSiderMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setSiderMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const setConversationPaneCollapsed = useCallback((value: boolean) => {
    setConversationPaneCollapsedState(value);
    persistConversationPaneCollapsed(value);
  }, []);

  const lastCssRef = useRef('');
  const lastUiCssUpdateAtRef = useRef(0);

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

      setCustomCss(effectiveCss);
      if (lastCssRef.current !== effectiveCss) {
        lastCssRef.current = effectiveCss;
        window.dispatchEvent(new CustomEvent('custom-css-updated', { detail: { customCss: effectiveCss } }));
      }
    } catch (error) {
      console.error('Failed to load or heal custom CSS:', error);
    }
  }, [customCss]);

  // 加载并监听自定义 CSS 配置 / Load & watch custom CSS configuration
  useEffect(() => {
    void loadAndHealCustomCss();

    const handleCssUpdate = (event: CustomEvent) => {
      if (event.detail?.customCss !== undefined) {
        const css = event.detail.customCss || '';
        lastCssRef.current = css;
        lastUiCssUpdateAtRef.current = Date.now();
        setCustomCss(css);
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

  // Track the previous pathname so we only re-sync on settings transitions.
  const prevPathnameRef = useRef(location.pathname);
  const shouldReSyncCss = (): boolean => {
    const prev = prevPathnameRef.current;
    const curr = location.pathname;
    const wasSettings = prev.startsWith('/settings');
    const isSettings = curr.startsWith('/settings');
    // Re-sync when entering or leaving a settings route, plus the initial mount.
    const enteringLeavingSettings = wasSettings !== isSettings;
    prevPathnameRef.current = curr;
    return enteringLeavingSettings;
  };

  // Re-sync theme css on route changes — only when entering/leaving settings
  // routes, because some settings pages do not mount CssThemeSettings.
  // Initial mount always runs (prevPathnameRef starts with the current pathname,
  // so wasSettings===isSettings and enteringLeavingSettings is false here; we
  // explicitly also run on mount when prevPathnameRef hasn't been set yet).
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevPathnameRef.current = location.pathname;
      void loadAndHealCustomCss();
      return;
    }
    if (shouldReSyncCss()) {
      void loadAndHealCustomCss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.hash, loadAndHealCustomCss]);

  // 注入自定义 CSS / Inject custom CSS into document head
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

  // 进入移动端后立即折叠 / Collapse immediately when switching to mobile
  // Track previous isMobile so we only fire on the desktop→mobile transition.
  // Using collapsed as a dep would re-fire whenever the user opens the sider
  // on mobile, immediately slamming it shut again.
  const prevIsMobileRef = useRef(isMobile);
  useEffect(() => {
    if (!isMobile || collapsed) {
      prevIsMobileRef.current = isMobile;
      return;
    }
    if (!prevIsMobileRef.current) {
      setCollapsed(true);
    }
    prevIsMobileRef.current = isMobile;
  }, [isMobile, collapsed]);

  // Broadcast the new ConversationPane state to the event bus so decoupled
  // listeners (e.g. mobile overlay animations, third-party widgets) can
  // mirror it. Direct tree descendants should read from LayoutContext.
  useEffect(() => {
    dispatchConversationPaneStateEvent(conversationPaneCollapsed);
  }, [conversationPaneCollapsed]);

  // Mobile: force-collapse the ConversationPane by default so it never
  // opens over a fresh chat unless the user explicitly invokes it.
  useEffect(() => {
    if (isMobile) {
      setConversationPaneCollapsed(true);
    }
  }, [isMobile, setConversationPaneCollapsed]);

  // 清理侧栏 Tooltip 残留节点，避免移动端路由切换后浮层卡在左上角
  useEffect(() => {
    cleanupSiderTooltips();
  }, [isMobile, collapsed, location.pathname, location.search, location.hash]);

  // Bridge Main Process logs to F12 Console
  useMainProcessLogBridge();

  // Handle tray events from main process / 处理来自主进程的托盘事件
  useTrayEventHandlers();

  const siderWidth = isMobile
    ? Math.max(
        MOBILE_SIDER_MIN_WIDTH,
        Math.min(MOBILE_SIDER_MAX_WIDTH, Math.round(viewportWidth * MOBILE_SIDER_WIDTH_RATIO))
      )
    : desktopSiderWidth;

  const mobileSiderClass = classNames('layout-sider--mobile', {
    'layout-sider--mounted': siderMounted,
    collapsed: collapsed,
    'layout-sider--dragging': siderDragging,
  });

  // During drag the live width is driven by the CSS variable so the Sider
  // resizes without triggering React re-renders on every mousemove.
  const siderDragStyle: React.CSSProperties | undefined =
    siderDragging && !isMobile && !collapsed
      ? {
          width: 'var(--layout-sider-width)',
          minWidth: `${SIDER_MIN_WIDTH}px`,
          maxWidth: `${SIDER_MAX_WIDTH}px`,
        }
      : undefined;

  const contextValue = useMemo(
    () => ({
      isMobile,
      siderCollapsed: collapsed,
      setSiderCollapsed: setCollapsed,
      siderWidth: isMobile ? 0 : desktopSiderWidth,
      siderIconOnly: siderIconOnly,
      conversationPaneCollapsed,
      setConversationPaneCollapsed,
    }),
    [
      isMobile,
      collapsed,
      desktopSiderWidth,
      siderIconOnly,
      conversationPaneCollapsed,
      setCollapsed,
      setConversationPaneCollapsed,
    ]
  );

  return (
    <LayoutContext.Provider value={contextValue}>
      <NavigationHistoryProvider>
        <TerminalPanelProvider>
          <LayoutModeProvider isMobile={isMobile} editorAvailable={!isMobile} diffAvailable={!isMobile}>
            <div className='app-shell flex flex-col size-full min-h-0' role='application'>
              <LayoutModeOrchestrator setCollapsed={setCollapsed} isDesktop={!isMobile} />
              <Titlebar workspaceAvailable={workspaceAvailable} />
              {/* 移动端左侧边栏蒙板 / Mobile left sider backdrop */}
              {isMobile && !collapsed && (
                <div className='fixed inset-0 bg-black/30 z-90' onClick={() => setCollapsed(true)} aria-hidden='true' />
              )}

              <ArcoLayout className={'size-full layout flex-1 min-h-0'}>
                <ArcoLayout.Sider
                  collapsedWidth={isMobile ? 0 : 0}
                  collapsed={collapsed}
                  width={siderDragging && !isMobile && !collapsed ? undefined : siderWidth}
                  className={classNames('!bg-2 layout-sider', isMobile ? mobileSiderClass : undefined, {
                    'layout-sider--icon-only': siderIconOnly,
                  })}
                  style={siderDragStyle}
                >
                  <div
                    role='navigation'
                    data-layout-region='sider'
                    tabIndex={-1}
                    className='size-full flex flex-col min-h-0'
                  >
                    {isMobile && !collapsed ? (
                      <ArcoLayout.Header
                        className={classNames(
                          'flex items-center justify-end pt-6px pb-6px pl-10px pr-8px gap-8px layout-sider-header layout-sider-header--mobile'
                        )}
                      >
                        <button
                          type='button'
                          className='app-titlebar__button app-titlebar__button--mobile'
                          onClick={() => setCollapsed(true)}
                          title={t('terminal.layout.regionSider', { defaultValue: 'Sidebar navigation' })}
                          aria-label={t('common.collapse', { defaultValue: 'Collapse' })}
                        >
                          <SidebarIcon size={18} strokeWidth={2.5} />
                        </button>
                      </ArcoLayout.Header>
                    ) : null}
                    <ArcoLayout.Content className='pt-0 px-4px pb-0 layout-sider-content'>
                      {React.isValidElement(sider)
                        ? React.cloneElement(sider, {
                            onSessionClick: () => {
                              cleanupSiderTooltips();
                              if (isMobile) setCollapsed(true);
                            },
                            collapsed,
                          } as any)
                        : sider}
                    </ArcoLayout.Content>
                    {!isMobile && (
                      <div
                        className='absolute top-0 h-full w-12px z-20 cursor-col-resize group flex items-center justify-center'
                        style={{ right: '-6px' }}
                        onMouseDown={beginSiderResizeDrag}
                        aria-hidden='true'
                        title='Drag to resize sidebar'
                      >
                        <div
                          className={classNames(
                            'pointer-events-none block h-full w-2px bg-bg-3 opacity-90 rd-full transition-all duration-150 group-hover:w-6px group-hover:bg-brand group-active:w-6px group-active:bg-brand',
                            siderDragging && '!w-6px !bg-brand'
                          )}
                        />
                      </div>
                    )}
                  </div>
                </ArcoLayout.Sider>

                {/* Command Center editor pane — peer column to the LEFT of the
                    chat content (desktop), universal across routes: conversation
                    routes and non-workspace routes (/guid, settings). Team routes
                    are excluded (no editor; different id shape). Self-gates to
                    command-center mode; renders null otherwise. A later phase
                    adds the left/right dock-side preference. */}
                {(isConversationRoute || !workspaceAvailable) && !isMobile && (
                  <Suspense fallback={null}>
                    <CommandCenterEditorHost />
                  </Suspense>
                )}

                <ArcoLayout.Content
                  className={'bg-1 layout-content flex flex-col min-h-0'}
                  onClick={() => {
                    if (isMobile && !collapsed) setCollapsed(true);
                  }}
                  style={{
                    // Complementary order to the editor host: start → editor(1)
                    // chat(2); end → chat(1) editor(2). Conversation pane is
                    // pinned rightmost (order 3) in its own component.
                    order: editorDock === 'end' ? 1 : 2,
                    ...(isMobile ? { width: '100%' } : {}),
                  }}
                >
                  <div role='main' data-layout-region='content' tabIndex={-1} className='flex flex-col flex-1 min-h-0'>
                    <TerminalPanelHost isMobile={isMobile}>
                      <Outlet />
                    </TerminalPanelHost>
                    {directorySelectionContextHolder}
                    <PwaPullToRefresh />
                    <Suspense fallback={null}>
                      <UpdateModal />
                    </Suspense>
                  </div>
                </ArcoLayout.Content>

                {/* Right-side conversation navigation pane — app-wide peer of
                    the main content (replaces the old left-Sider chat list).
                    Hidden on Settings routes. Visibility within an enabled
                    route is driven by LayoutContext.conversationPaneCollapsed. */}
                {conversationPaneEnabled && <ConversationPane />}
              </ArcoLayout>
            </div>
          </LayoutModeProvider>
        </TerminalPanelProvider>
      </NavigationHistoryProvider>
    </LayoutContext.Provider>
  );
};

export default Layout;

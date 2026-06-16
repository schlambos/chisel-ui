/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { TEAM_MODE_ENABLED } from '@/common/config/constants';
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
import { cleanupSiderTooltips } from '@renderer/utils/ui/siderTooltip';
import { useConversationShortcuts } from '@renderer/hooks/ui/useConversationShortcuts';
import { useCustomCssInjection, useCustomCssStyleInjection } from '@renderer/hooks/system/useCustomCssInjection';
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
    readStoredConversationPaneCollapsed()
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
  const { desktopSiderWidth, siderDragging, siderIconOnly, resizeBy, beginSiderResizeDrag } = useSiderResize({
    isMobile,
    collapsed,
    setCollapsed,
  });
  const handleSiderResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          resizeBy(-16);
          return;
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          resizeBy(16);
          return;
        case 'Home':
          event.preventDefault();
          resizeBy(Number.NEGATIVE_INFINITY);
          return;
        case 'End':
          event.preventDefault();
          resizeBy(Number.POSITIVE_INFINITY);
          return;
        default:
          return;
      }
    },
    [resizeBy]
  );

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

  useCustomCssInjection({ pathname: location.pathname, customCss });

  // Keep the custom-css-updated listener so the component's setCustomCss is
  // wired (the hook only manages internal refs / load scheduling).
  useEffect(() => {
    const handleCssUpdate = (event: CustomEvent) => {
      if (event.detail?.customCss !== undefined) {
        const css = event.detail.customCss || '';
        setCustomCss(css);
      }
    };

    window.addEventListener('custom-css-updated', handleCssUpdate as EventListener);
    return () => {
      window.removeEventListener('custom-css-updated', handleCssUpdate as EventListener);
    };
  }, []);

  useCustomCssStyleInjection(customCss);

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

  // One-time desktop recovery: a prior layout regression could persist a
  // stuck `collapsed=true`, leaving the pane hidden at 0 width on every
  // launch. On the first desktop mount, clear that stale value and force the
  // pane open so it is guaranteed visible. Runs once; the mobile effect below
  // still wins on mobile.
  const didRecoverPaneRef = useRef(false);
  useEffect(() => {
    if (didRecoverPaneRef.current) return;
    if (isMobile) return;
    didRecoverPaneRef.current = true;
    setConversationPaneCollapsed(false);
  }, [isMobile, setConversationPaneCollapsed]);

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
                        role='separator'
                        aria-orientation='vertical'
                        aria-label={t('common.resizeSidebar', { defaultValue: 'Resize sidebar' })}
                        aria-valuemin={SIDER_MIN_WIDTH}
                        aria-valuemax={SIDER_MAX_WIDTH}
                        aria-valuenow={desktopSiderWidth}
                        tabIndex={0}
                        className='absolute top-0 h-full w-12px z-20 cursor-col-resize group flex items-center justify-center'
                        style={{ right: '-6px' }}
                        onMouseDown={beginSiderResizeDrag}
                        onKeyDown={handleSiderResizeKeyDown}
                      >
                        <div
                          className={classNames(
                            'pointer-events-none block h-full w-2px bg-bg-3 opacity-90 rd-full transition-all duration-150 group-hover:w-6px group-hover:bg-brand group-focus-visible:w-6px group-focus-visible:bg-brand group-active:w-6px group-active:bg-brand',
                            siderDragging && '!w-6px !bg-brand'
                          )}
                        />
                      </div>
                    )}
                  </div>
                </ArcoLayout.Sider>

                <div
                  role='main'
                  data-layout-region='content'
                  tabIndex={-1}
                  className={'bg-1 layout-content flex flex-row flex-1 min-h-0 relative'}
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
                  <TerminalPanelHost isMobile={isMobile}>
                    <div className='flex flex-row flex-1 min-h-0'>
                      {(isConversationRoute || !workspaceAvailable) && !isMobile && (
                        <Suspense fallback={null}>
                          <CommandCenterEditorHost />
                        </Suspense>
                      )}
                      <div
                        className='flex-1 min-h-0 flex flex-col overflow-auto justify-center'
                        style={{
                          // Complementary order to the editor host: start → editor(1)
                          // chat(2); end → chat(1) editor(2). Conversation pane is
                          // pinned rightmost (order 3) in its own component.
                          order: editorDock === 'end' ? 1 : 2,
                          minWidth: 'var(--app-min-width, 360px)',
                          // Inset the chat content by the width of the overlay
                          // conversation pane so content stays centered in the
                          // visible (un-covered) area. Var is published by
                          // ConversationPaneDesktop; 0 when collapsed.
                          paddingRight: 'var(--conversation-pane-inset, 0px)',
                        }}
                      >
                        <Outlet />
                      </div>
                    </div>
                  </TerminalPanelHost>
                  {conversationPaneEnabled && <ConversationPane />}
                  {directorySelectionContextHolder}
                  <PwaPullToRefresh />
                  <Suspense fallback={null}>
                    <UpdateModal />
                  </Suspense>
                </div>
              </ArcoLayout>
            </div>
          </LayoutModeProvider>
        </TerminalPanelProvider>
      </NavigationHistoryProvider>
    </LayoutContext.Provider>
  );
};

export default Layout;

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React, { Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview/context/PreviewContext';
import { useResizableSplit } from '@/renderer/hooks/ui/useResizableSplit';
import { blurActiveElement } from '@/renderer/utils/ui/focus';
import { cleanupSiderTooltips } from '@/renderer/utils/ui/siderTooltip';

import ConversationPaneBottomPanel from './ConversationPaneBottomPanel';
import ConversationPaneHeader from './ConversationPaneHeader';
import styles from './ConversationPane.module.css';

const WorkspaceGroupedHistory = React.lazy(() => import('@/renderer/pages/conversation/GroupedHistory'));

const DEFAULT_PANE_WIDTH_PX = 300;
const MIN_PANE_WIDTH_PX = 240;
const MAX_PANE_WIDTH_PX = 560;
const PANE_WIDTH_STORAGE_KEY = 'aionui.conversationPaneWidth';
const CHAT_MIN_WIDTH_PX = 360;

interface ConversationPaneDesktopProps {
  collapsed: boolean;
  onSessionClick?: () => void;
}

const ConversationPaneDesktop: React.FC<ConversationPaneDesktopProps> = ({ collapsed, onSessionClick }) => {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const layout = useLayoutContext();
  const { closePreview } = usePreviewContext();
  const navigate = useNavigate();
  const { id: conversationId = '' } = useParams<{ id: string }>();

  // Drag-resizable width from the pane's left edge (reverse: dragging left
  // widens the right-docked pane). Persisted to localStorage.
  const { splitRatio: paneWidth, createDragHandle } = useResizableSplit({
    unit: 'px',
    defaultWidth: DEFAULT_PANE_WIDTH_PX,
    minWidth: MIN_PANE_WIDTH_PX,
    maxWidth: MAX_PANE_WIDTH_PX,
    storageKey: PANE_WIDTH_STORAGE_KEY,
  });

  // Width transition mirrors the left Sider (transition: width on the root).
  // Suppressed during resize-drag so width tracks the pointer with no lag.
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
    if (!isResizing) return;
    const stop = () => setIsResizing(false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
    };
  }, [isResizing]);

  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNewChat = useCallback(() => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/guid', { state: { resetAssistant: true } })).catch((error) => {
      console.error('Navigation failed:', error);
    });
    onSessionClick?.();
  }, [closePreview, navigate, onSessionClick]);

  const handleClosePane = useCallback(() => {
    layout?.setConversationPaneCollapsed(true);
  }, [layout]);

  const effectiveMaxWidth = Math.max(MIN_PANE_WIDTH_PX, viewportWidth - (layout?.siderWidth ?? 0) - CHAT_MIN_WIDTH_PX);
  const paneDisplayWidth = Math.min(Math.round(paneWidth), effectiveMaxWidth);

  // Two CSS variables on documentElement drive the layout:
  //
  //   --conversation-pane-width    The pane element's *rendered* width. It is
  //                                ALWAYS the open width (never 0), so the
  //                                collapsed state can be expressed by sliding
  //                                the pane off-screen with a compositor
  //                                `transform: translateX(100%)` (see
  //                                ConversationPane.module.css) — a GPU-only
  //                                animation that never reflows the center.
  //
  //   --conversation-pane-reserved The gutter the center content reserves
  //                                (padding-right on .layout-content). It SNAPS
  //                                between 0 (collapsed) and the open width —
  //                                no CSS transition — so the center reaches
  //                                its final width in a single frame instead of
  //                                being re-laid-out (and re-centered) on every
  //                                animation frame, which previously read as the
  //                                center content "marching" sideways in steps.
  //
  // Net effect (#1): the pane glides on the compositor; the center content
  // resolves to its new width in one clean movement.
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--conversation-pane-width', `${paneDisplayWidth}px`);
    root.setProperty('--conversation-pane-reserved', collapsed ? '0px' : `${paneDisplayWidth}px`);
    return () => {
      root.setProperty('--conversation-pane-width', '0px');
      root.setProperty('--conversation-pane-reserved', '0px');
    };
  }, [collapsed, paneDisplayWidth]);

  // Mark the document as mid-drag (mirrors .layout-sider--dragging). The pane's
  // own width tracks the pointer with no transition; .paneRootDragging also
  // suppresses the transform slide so a collapse toggled mid-drag can't tween.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('conversation-pane-dragging', isResizing);
    return () => {
      document.documentElement.classList.remove('conversation-pane-dragging');
    };
  }, [isResizing]);

  return (
    <div
      className={classNames(styles.paneRoot, {
        [styles.paneCollapsed]: collapsed,
        [styles.paneRootDragging]: isResizing,
      })}
      aria-hidden={collapsed}
    >
      {!collapsed && (
        <div style={{ display: 'contents' }} onPointerDown={() => setIsResizing(true)}>
          {createDragHandle({ className: 'left-0', reverse: true })}
        </div>
      )}
      <ConversationPaneHeader
        isBatchMode={isBatchMode}
        onToggleBatchMode={() => setIsBatchMode((prev) => !prev)}
        onNewChat={handleNewChat}
        onClose={handleClosePane}
        onSessionClick={onSessionClick}
      />
      <div className={styles.body}>
        <PanelGroup direction='vertical' autoSaveId='conversation-pane-split' className='size-full min-h-0'>
          <Panel defaultSize={60} minSize={20} className='min-h-0 overflow-hidden'>
            <div className={styles.bodyInner}>
              <Suspense fallback={<div className='min-h-200px' />}>
                <WorkspaceGroupedHistory
                  batchMode={isBatchMode}
                  onBatchModeChange={setIsBatchMode}
                  collapsed={false}
                  tooltipEnabled={false}
                  onSessionClick={onSessionClick}
                />
              </Suspense>
            </div>
          </Panel>
          <PanelResizeHandle className='group relative h-8px shrink-0 flex items-center justify-center cursor-row-resize'>
            <span className='h-3px w-32px rounded-full bg-[var(--color-border-2)] group-hover:bg-[var(--brand)] transition-colors' />
          </PanelResizeHandle>
          <Panel defaultSize={40} minSize={15} className='min-h-0'>
            <ConversationPaneBottomPanel conversationId={conversationId ?? ''} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

export default ConversationPaneDesktop;

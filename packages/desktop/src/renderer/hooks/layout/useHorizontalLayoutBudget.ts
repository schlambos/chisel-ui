/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { useMobileViewport } from '../system/useMobileViewport';
import { useLayoutContext } from '../context/LayoutContext';

type LayoutBudgetInputs = {
  viewportWidth?: number;
  siderCollapsed?: boolean;
  siderWidth?: number;
  conversationPaneCollapsed?: boolean;
};

type LayoutBudget = {
  editorMaxWidth: number;
  conversationPaneMaxWidth: number;
  shouldCollapsePane: boolean;
};

const CHAT_MIN = 360;
const EDITOR_MIN = 120;
const PANE_MIN = 240;
const BUFFER = 20;

export function useHorizontalLayoutBudget(inputs?: LayoutBudgetInputs): LayoutBudget {
  const { viewportWidth: viewportWidthFromHook } = useMobileViewport();
  const layout = useLayoutContext();

  // Use explicit inputs when provided, fall back to context for missing fields
  const effectiveViewportWidth = inputs?.viewportWidth ?? viewportWidthFromHook;
  const effectiveSiderCollapsed = inputs?.siderCollapsed ?? layout?.siderCollapsed;
  const effectiveSiderWidth = inputs?.siderWidth ?? layout?.siderWidth;
  const effectiveConversationPaneCollapsed = inputs?.conversationPaneCollapsed ?? layout?.conversationPaneCollapsed;

  return useMemo(() => {
    const siderWidth = effectiveSiderCollapsed ? 0 : (effectiveSiderWidth ?? 0);
    const conversationPaneCollapsed = effectiveConversationPaneCollapsed ?? false;

    const availableWidth = effectiveViewportWidth - siderWidth;

    const editorMaxWidth = Math.max(
      EDITOR_MIN,
      availableWidth - CHAT_MIN - (conversationPaneCollapsed ? 0 : PANE_MIN) - BUFFER
    );
    const conversationPaneMaxWidth = Math.max(PANE_MIN, availableWidth - CHAT_MIN - EDITOR_MIN - BUFFER);
    const shouldCollapsePane = availableWidth < CHAT_MIN + PANE_MIN + EDITOR_MIN + BUFFER;

    return {
      editorMaxWidth,
      conversationPaneMaxWidth,
      shouldCollapsePane,
    };
  }, [effectiveViewportWidth, effectiveSiderCollapsed, effectiveSiderWidth, effectiveConversationPaneCollapsed]);
}

export default useHorizontalLayoutBudget;

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { useMobileViewport } from '../system/useMobileViewport';
import { useLayoutContext } from '../context/LayoutContext';

type LayoutBudget = {
  editorMaxWidth: number;
  conversationPaneMaxWidth: number;
  shouldCollapsePane: boolean;
};

const CHAT_MIN = 360;
const EDITOR_MIN = 120;
const PANE_MIN = 240;
const BUFFER = 20;

export function useHorizontalLayoutBudget(): LayoutBudget {
  const { viewportWidth } = useMobileViewport();
  const layout = useLayoutContext();

  return useMemo(() => {
    const siderWidth = layout?.siderCollapsed ? 0 : (layout?.siderWidth ?? 0);
    const conversationPaneCollapsed = layout?.conversationPaneCollapsed ?? false;

    const availableWidth = viewportWidth - siderWidth;

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
  }, [viewportWidth, layout?.siderCollapsed, layout?.siderWidth, layout?.conversationPaneCollapsed]);
}

export default useHorizontalLayoutBudget;

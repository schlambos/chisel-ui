/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Workspace panel for the Sider in conversations mode.
 *
 * Stacks four VS Code-style collapsible sections in a single column:
 *   1. Explorer  (file tree)
 *   2. Diff      (uncommitted changes)
 *   3. Outline   (active buffer symbol list)
 *   4. Timeline  (active buffer file history)
 *
 * Each section is a `SiderAccordionSection` — the explorer and diff
 * panes wrap their existing implementations in `headerless` mode so
 * the accordion's header is the single source of chrome. Outline and
 * Timeline are new lightweight sections that read `useEditorContext`
 * directly so re-renders stay scoped to the affected section (typing
 * in the editor only re-renders Outline + Timeline, never the file
 * tree or diff).
 *
 * Expand/collapse state persists to `localStorage` per section so
 * the user's preferred layout survives reloads. Default expansions
 * match VS Code: explorer + diff open, outline + timeline collapsed.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SiderFileTree from './SiderFileTree';
import SiderDiffSection from './SiderDiffSection';
import SiderAccordionSection from './sections/SiderAccordionSection';
import SiderOutlineSection from './sections/SiderOutlineSection';
import SiderTimelineSection from './sections/SiderTimelineSection';
import SiderDiffFlyoutTrigger from './SiderDiffFlyoutTrigger';
import SiderFilesFlyoutTrigger from './SiderFilesFlyoutTrigger';
import ResizeHandle from '@renderer/components/layout/ResizeHandle';

type SiderWorkspacePanelProps = {
  collapsed?: boolean;
};

const ORDER_STORAGE_KEY = 'sider.section.order';
const HEIGHTS_STORAGE_KEY = 'sider.section.heights';
const DEFAULT_ORDER = ['explorer', 'diff', 'outline', 'timeline'];
const MIN_SECTION_HEIGHT = 30; // compact header height; body may shrink to zero

const SiderWorkspacePanel: React.FC<SiderWorkspacePanelProps> = ({ collapsed }) => {
  const { t } = useTranslation();
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<Map<string, HTMLElement>>(new Map());

  const setPaneRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) {
        paneRefs.current.set(id, el);
      } else {
        paneRefs.current.delete(id);
      }
    },
    []
  );

  useEffect(() => {
    try {
      const storedOrder = window.localStorage.getItem(ORDER_STORAGE_KEY);
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length) {
          setOrder(parsed);
        }
      }

      const storedHeights = window.localStorage.getItem(HEIGHTS_STORAGE_KEY);
      if (storedHeights) {
        setHeights(JSON.parse(storedHeights));
      }
    } catch {
      // Ignore
    }
    setHydrated(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        try {
          window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(newOrder));
        } catch {
          // Ignore
        }
        return newOrder;
      });
    }
  };

  const handleResize = useCallback(
    (index: number, delta: number) => {
      if (!containerRef.current) return;

      const upperId = order[index];
      const lowerId = order[index + 1];
      if (!upperId || !lowerId) return;

      const upperEl = paneRefs.current.get(upperId);
      const lowerEl = paneRefs.current.get(lowerId);
      if (!upperEl || !lowerEl) return;

      const upperCurrentHeight = heights[upperId] ?? upperEl.offsetHeight;
      const lowerCurrentHeight = heights[lowerId] ?? lowerEl.offsetHeight;

      const maxGrow = Math.max(0, lowerCurrentHeight - MIN_SECTION_HEIGHT);
      const maxShrink = Math.max(0, upperCurrentHeight - MIN_SECTION_HEIGHT);
      const actualDelta = Math.max(-maxShrink, Math.min(maxGrow, delta));
      if (actualDelta === 0) return;

      const newUpperHeight = upperCurrentHeight + actualDelta;
      const newLowerHeight = lowerCurrentHeight - actualDelta;

      setHeights((prev) => {
        const newHeights = {
          ...prev,
          [upperId]: newUpperHeight,
          [lowerId]: newLowerHeight,
        };
        try {
          window.localStorage.setItem(HEIGHTS_STORAGE_KEY, JSON.stringify(newHeights));
        } catch {
          // Ignore
        }
        return newHeights;
      });
    },
    [order, heights]
  );

  if (collapsed || !hydrated) {
    return null;
  }

  const sections: Record<string, React.ReactNode> = {
    explorer: (
      <SiderAccordionSection
        key='explorer'
        id='explorer'
        title={t('conversation.sider.explorer')}
        defaultExpanded
        storageKey='sider.section.explorer'
        height={heights['explorer']}
        elementRef={setPaneRef('explorer')}
        data-testid='sider-accordion-explorer'
        actions={<SiderFilesFlyoutTrigger />}
      >
        <SiderFileTree headerless />
      </SiderAccordionSection>
    ),
    diff: (
      <SiderAccordionSection
        key='diff'
        id='diff'
        title={t('conversation.workspace.changes.diff')}
        defaultExpanded
        storageKey='sider.section.diff'
        height={heights['diff']}
        elementRef={setPaneRef('diff')}
        data-testid='sider-accordion-diff'
        actions={<SiderDiffFlyoutTrigger />}
      >
        <SiderDiffSection headerless />
      </SiderAccordionSection>
    ),
    outline: (
      <SiderAccordionSection
        key='outline'
        id='outline'
        title={t('conversation.sider.outline')}
        defaultExpanded={false}
        storageKey='sider.section.outline'
        height={heights['outline']}
        elementRef={setPaneRef('outline')}
        data-testid='sider-accordion-outline'
      >
        <SiderOutlineSection />
      </SiderAccordionSection>
    ),
    timeline: (
      <SiderAccordionSection
        key='timeline'
        id='timeline'
        title={t('conversation.sider.timeline')}
        defaultExpanded={false}
        storageKey='sider.section.timeline'
        height={heights['timeline']}
        elementRef={setPaneRef('timeline')}
        data-testid='sider-accordion-timeline'
      >
        <SiderTimelineSection />
      </SiderAccordionSection>
    ),
  };

  return (
    <div
      ref={containerRef}
      className='size-full min-h-0 flex flex-col bg-[var(--bg-2)]'
      data-testid='sider-workspace-panel'
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((id, index) => (
            <React.Fragment key={id}>
              {sections[id]}
              {index < order.length - 1 && (
                <ResizeHandle
                  orientation='horizontal'
                  onDrag={(delta) => handleResize(index, delta)}
                  onKeyboardResize={(delta) => handleResize(index, delta)}
                  aria-label={t('common.resizePanel', { defaultValue: 'Resize panel' })}
                />
              )}
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default SiderWorkspacePanel;

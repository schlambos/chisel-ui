/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reusable VS Code-style collapsible section used by the Sider workspace
 * panel. Hands a real `<button>` to the toggle so the entire header
 * (chevron + title) is keyboard-activatable, while action buttons on the
 * right are kept OUTSIDE the toggle so a click on, e.g. Refresh doesn't
 * collapse the section.
 *
 * The expanded body uses `flex: 1; min-height: 0; overflow: auto` so
 * multiple open sections share the available vertical space (VS Code's
 * behavior) rather than growing to fit content. The collapsed state is
 * `flex: 0 0 auto` so the section shrinks to its header height.
 *
 * Persists open/closed to `localStorage[storageKey]` when provided. Errors
 * are swallowed — the section always falls back to the `defaultExpanded`
 * prop so a corrupted localStorage can't lock the UI.
 */

import React, { useCallback, useEffect, useId, useState } from 'react';
import { Down } from '@icon-park/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import panelStyles from '../SiderWorkspacePanel.module.css';

type Props = {
  id: string;
  title: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  storageKey?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  height?: number;
  _onHeightChange?: (height: number) => void;
  elementRef?: (element: HTMLElement | null) => void;
  'data-testid'?: string;
};

const SiderAccordionSection: React.FC<Props> = ({
  id,
  title,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandedChange,
  storageKey,
  actions,
  children,
  height,
  _onHeightChange,
  elementRef,
  'data-testid': testId,
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const isControlled = controlledExpanded !== undefined;
  const effectiveExpanded = controlledExpanded ?? expanded;
  const reactId = useId();
  const bodyId = `sider-accordion-body-${reactId}`;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const setSectionRef = useCallback(
    (element: HTMLElement | null) => {
      setNodeRef(element);
      elementRef?.(element);
    },
    [elementRef, setNodeRef]
  );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Use a shrinkable flex-basis for user-sized panes. A fixed `0 0 auto`
    // height can push lower sections out of view on short displays; shrinkable
    // basis lets expanded bodies compress to their compact header before any
    // later section becomes unreachable.
    ...(effectiveExpanded && height !== undefined ? { flex: `0 1 ${height}px` } : {}),
    ...(isDragging ? { zIndex: 1, position: 'relative' as const } : {}),
  };

  // Hydrate the persisted state on mount only — writes happen in the toggle
  // effect below. Wrapped in try/catch so a Storage quota / SecurityError
  // never blocks the UI.
  useEffect(() => {
    if (isControlled) {
      setHydrated(true);
      return;
    }
    if (!storageKey || typeof window === 'undefined') {
      setHydrated(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === 'true' || stored === 'false') {
        setExpanded(stored === 'true');
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [isControlled, storageKey]);

  useEffect(() => {
    if (isControlled || !hydrated || !storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, expanded ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [hydrated, isControlled, storageKey, expanded]);

  const toggle = useCallback(() => {
    const next = !effectiveExpanded;
    if (isControlled) {
      onExpandedChange?.(next);
      return;
    }
    setExpanded(next);
  }, [effectiveExpanded, isControlled, onExpandedChange]);

  return (
    <section
      ref={setSectionRef}
      style={style}
      className={`${panelStyles.accordionSection} ${effectiveExpanded ? panelStyles.accordionSectionOpen : panelStyles.accordionSectionCollapsed} ${isDragging ? 'opacity-50 shadow-lg !z-50 ring-1 ring-[var(--border-focus)]' : ''}`}
      data-testid={testId}
    >
      <div className={`${panelStyles.header} cursor-grab active:cursor-grabbing`} {...attributes} {...listeners}>
        <button
          type='button'
          className={panelStyles.toggle}
          onClick={toggle}
          aria-expanded={effectiveExpanded}
          aria-controls={bodyId}
        >
          <Down
            theme='outline'
            size={12}
            fill='currentColor'
            className={`${panelStyles.chevron} ${effectiveExpanded ? panelStyles.chevronOpen : ''}`}
            aria-hidden='true'
          />
          <h3 className={panelStyles.title}>{title}</h3>
        </button>
        {actions ? <div className={panelStyles.actions}>{actions}</div> : null}
      </div>
      {effectiveExpanded ? (
        <div
          id={bodyId}
          className={panelStyles.accordionBody}
          role='region'
          aria-label={typeof title === 'string' ? title : undefined}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
};

export default SiderAccordionSection;

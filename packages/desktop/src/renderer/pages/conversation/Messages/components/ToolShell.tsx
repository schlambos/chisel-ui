/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import classNames from 'classnames';
import React, { useCallback, useEffect, useId, useState } from 'react';
import { IconDown, IconRight } from '@arco-design/web-react/icon';
import StatusPill, { type StatusPillState } from './StatusPill';

interface ToolShellProps {
  state: StatusPillState;
  stateLabel?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactElement;
  /** When true, the body is collapsible. Default-collapsed unless state is "failed". */
  collapsible?: boolean;
  /** Override the auto-expand for failed state (e.g., when the body is critical to read on success too). */
  defaultExpanded?: boolean;
  /** Render mode: 'default' is the full card; 'compact' is an inline status dot + title only. */
  variant?: 'default' | 'compact';
  /** Forwarded for direct DOM access; rarely needed. */
  className?: string;
  /** Inline preview of the output, shown only when collapsed. */
  preview?: string;
}

const ToolShell: React.FC<ToolShellProps> = ({
  state,
  stateLabel,
  title,
  meta,
  children,
  icon,
  collapsible = true,
  defaultExpanded,
  variant = 'default',
  className,
  preview,
}) => {
  const bodyId = useId();
  const hasBody = children !== undefined && children !== null && children !== false;
  const autoExpand = state === 'failed';
  const initialExpanded = defaultExpanded ?? (!collapsible || autoExpand);
  const [expanded, setExpanded] = useState(initialExpanded);

  useEffect(() => {
    if (state === 'failed' && !expanded) {
      setExpanded(true);
    }
  }, [state, expanded]);

  const toggle = useCallback(() => {
    if (!hasBody || !collapsible) return;
    setExpanded((v) => !v);
  }, [hasBody, collapsible]);

  const onKey = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    },
    [toggle]
  );

  const showExpander = hasBody && collapsible;
  const isCancelled = state === 'cancelled';

  if (variant === 'compact') {
    return (
      <div className={classNames('tool-shell', 'tool-shell--compact', className)}>
        {icon && (
          <span className="w-14px h-14px shrink-0 flex items-center justify-center">
            {icon}
          </span>
        )}
        <StatusPill state={state} label={stateLabel} />
        <span
          className={classNames('tool-shell__title', 'tool-shell__title--compact', {
            'tool-shell__title--cancelled': isCancelled,
          })}
        >
          {title}
        </span>
      </div>
    );
  }

  return (
    <div className={classNames('tool-shell', className)}>
      <header className='tool-shell__header'>
        {icon && (
          <span className="w-14px h-14px shrink-0 flex items-center justify-center">
            {icon}
          </span>
        )}
        <StatusPill state={state} label={stateLabel} />
        <span
          className={classNames('tool-shell__title', {
            'tool-shell__title--cancelled': isCancelled,
          })}
        >
          {title}
        </span>
        {collapsible && !expanded && preview && (
          <span className='max-w-300px truncate text-t-tertiary text-12px ml-8px'>{preview}</span>
        )}
        {meta && <span className='tool-shell__meta'>{meta}</span>}
        {showExpander && (
          <button
            type='button'
            className='tool-shell__expander'
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={toggle}
            onKeyDown={onKey}
            title={expanded ? 'Hide details' : 'Show details'}
          >
            {expanded ? <IconDown style={{ fontSize: 12 }} /> : <IconRight style={{ fontSize: 12 }} />}
          </button>
        )}
      </header>
      {hasBody && (
        <div id={bodyId} className='tool-shell__body' hidden={collapsible && !expanded}>
          {children}
        </div>
      )}
    </div>
  );
};

export default ToolShell;

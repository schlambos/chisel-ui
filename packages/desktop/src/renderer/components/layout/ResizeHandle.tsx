/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ResizeHandle.module.css';

export type ResizeHandleOrientation = 'vertical' | 'horizontal';

export type ResizeHandleProps = {
  orientation?: ResizeHandleOrientation;
  variant?: 'inline' | 'edge';
  onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onKeyboardResize?: (delta: number) => void;
  onDrag?: (delta: number) => void;
  'aria-label'?: string;
  'aria-valuenow'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'data-dragging'?: 'true';
};

const STEP = 16;

const ResizeHandle: React.FC<ResizeHandleProps> = ({
  orientation = 'vertical',
  variant = 'inline',
  onMouseDown,
  onKeyboardResize,
  onDrag,
  'aria-label': ariaLabel,
  'aria-valuenow': ariaValueNow,
  'aria-valuemin': ariaValueMin,
  'aria-valuemax': ariaValueMax,
  'data-dragging': dataDragging,
}) => {
  const { t } = useTranslation();
  const isDraggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resolvedAriaLabel = ariaLabel ?? t('common.resizeSidebar');

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isDraggingRef.current = true;
      startRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      onMouseDown?.(event as unknown as React.MouseEvent<HTMLDivElement>);
    },
    [onMouseDown]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      const delta =
        orientation === 'vertical' ? event.clientX - startRef.current.x : event.clientY - startRef.current.y;
      if (delta !== 0) {
        onDrag?.(delta);
        startRef.current = { x: event.clientX, y: event.clientY };
      }
    },
    [onDrag, orientation]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onKeyboardResize) return;

      let delta = 0;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          delta = -STEP;
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          delta = STEP;
          break;
        case 'Home':
          // Treat as resize to min: negative infinity so the caller clamps.
          onKeyboardResize(Number.NEGATIVE_INFINITY);
          event.preventDefault();
          return;
        case 'End':
          // Treat as resize to max: positive infinity so the caller clamps.
          onKeyboardResize(Number.POSITIVE_INFINITY);
          event.preventDefault();
          return;
        default:
          return;
      }

      if (delta !== 0) {
        event.preventDefault();
        onKeyboardResize(delta);
      }
    },
    [onKeyboardResize]
  );

  const isVertical = orientation === 'vertical';
  const className = `${styles.handle} ${isVertical ? styles.vertical : styles.horizontal} ${
    variant === 'edge' ? styles.edge : ''
  }`;

  return (
    <div
      role='separator'
      aria-orientation={orientation}
      aria-label={resolvedAriaLabel}
      aria-valuenow={ariaValueNow}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={className}
      data-orientation={orientation}
      data-dragging={dataDragging}
    >
      <span className={styles.line} />
    </div>
  );
};

export default ResizeHandle;

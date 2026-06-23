/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import styles from './Skeleton.module.css';

export type SkeletonVariant = 'block' | 'pill' | 'circle';

export type SkeletonProps = {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const variantClass: Record<SkeletonVariant, string> = {
  block: styles.block,
  pill: styles.pill,
  circle: styles.circle,
};

const subscribeReducedMotion = (onChange: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

const getReducedMotionSnapshot = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

const getReducedMotionServerSnapshot = (): boolean => false;

const usePrefersReducedMotion = (): boolean =>
  React.useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);

const Skeleton: React.FC<SkeletonProps> = ({ variant = 'block', width, height, count = 1, className }) => {
  const reduced = usePrefersReducedMotion();
  const safeCount = Math.max(1, Math.floor(count));
  const style: React.CSSProperties = { width, height };

  const classes = [styles.skeleton, variantClass[variant], reduced ? styles.reduced : styles.animated, className]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {Array.from({ length: safeCount }, (_, index) => (
        <span
          key={index}
          data-testid='skeleton'
          data-variant={variant}
          data-reduced={reduced ? 'true' : 'false'}
          aria-hidden='true'
          className={classes}
          style={style}
        />
      ))}
    </>
  );
};

Skeleton.displayName = 'Skeleton';

export default Skeleton;

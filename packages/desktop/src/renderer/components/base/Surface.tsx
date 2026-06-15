/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SurfaceProps {
  padding: string;
  minHeight?: string;
  hoverable?: boolean;
  flex?: boolean;
  className?: string;
  variant?: 'default' | 'primary' | 'muted';
  children: React.ReactNode;
}

const Surface: React.FC<SurfaceProps> = ({
  padding,
  minHeight,
  hoverable,
  flex,
  className,
  variant = 'default',
  children,
}) => {
  const borderClass =
    variant === 'primary'
      ? 'border-[color-mix(in_srgb,var(--brand)_30%,var(--border-base))]'
      : variant === 'muted'
        ? 'border-[var(--color-border-1)]'
        : 'border-[var(--color-border-2)]';

  const bgClass = variant === 'muted' ? 'bg-[var(--color-fill-1)]' : 'bg-[var(--color-bg-2)]';

  const hoverClass =
    variant === 'primary'
      ? 'transition-colors hover:border-[color-mix(in_srgb,var(--brand)_50%,var(--bg-4))]'
      : hoverable
        ? 'transition-colors hover:border-[var(--color-border-3)]'
        : undefined;

  const classes = [
    'rounded-card',
    'border',
    'border-solid',
    borderClass,
    bgClass,
    flex ? 'flex flex-col' : '',
    hoverClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ padding, minHeight }}>
      {children}
    </div>
  );
};

Surface.displayName = 'Surface';

export default Surface;

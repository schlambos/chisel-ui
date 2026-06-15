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
  children: React.ReactNode;
}

const Surface: React.FC<SurfaceProps> = ({ padding, minHeight, hoverable, flex, className, children }) => {
  const classes = [
    'rounded-card',
    'border',
    'border-solid',
    'border-[var(--color-border-2)]',
    'bg-[var(--color-bg-2)]',
    `p-${padding}`,
    minHeight ? `min-h-[${minHeight}]` : '',
    flex ? 'flex flex-col' : '',
    hoverable ? 'transition-colors hover:border-[var(--color-border-3)]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
};

Surface.displayName = 'Surface';

export default Surface;
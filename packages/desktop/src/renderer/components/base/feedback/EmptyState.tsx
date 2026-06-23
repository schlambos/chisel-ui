/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import styles from './EmptyState.module.css';

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => {
  const classes = [styles.root, className].filter(Boolean).join(' ');

  return (
    <div className={classes} data-empty-state>
      {icon ? (
        <div className={styles.icon} data-empty-state-icon aria-hidden='true'>
          {icon}
        </div>
      ) : null}
      <div className={styles.title} data-empty-state-title>
        {title}
      </div>
      {description ? (
        <div className={styles.description} data-empty-state-description>
          {description}
        </div>
      ) : null}
      {action ? (
        <div className={styles.action} data-empty-state-action>
          {action}
        </div>
      ) : null}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';

export default EmptyState;
export type { EmptyStateProps };

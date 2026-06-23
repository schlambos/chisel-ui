/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * ErrorBanner — shared inline error/warning banner primitive.
 *
 * An inline banner (NOT a toast) for surfacing recoverable failures or
 * warnings near the affected region. Renders `role="alert"` for assistive
 * tech, optionally exposes a Retry action, and applies a severity-tinted
 * left border using Chisl semantic tokens.
 *
 * Usage:
 *   <ErrorBanner title='Could not load conversations' onRetry={refresh} />
 *   <ErrorBanner title='Slow connection' message='…' severity='warning' />
 */

import { Button } from '@arco-design/web-react';
import React from 'react';
import styles from './ErrorBanner.module.css';

type ErrorBannerSeverity = 'error' | 'warning';

type ErrorBannerProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
  severity?: ErrorBannerSeverity;
  className?: string;
};

const ErrorBanner: React.FC<ErrorBannerProps> = ({ title, message, onRetry, severity = 'error', className }) => {
  const severityClass = severity === 'warning' ? styles.warning : styles.error;
  const classes = [styles.root, severityClass, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role='alert' data-error-banner data-severity={severity}>
      <div className={styles.body}>
        <div className={styles.title} data-error-banner-title>
          {title}
        </div>
        {message ? (
          <div className={styles.message} data-error-banner-message>
            {message}
          </div>
        ) : null}
      </div>
      {onRetry ? (
        <div className={styles.actions} data-error-banner-actions>
          <Button size='small' type='primary' className={styles.retry} onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
};

ErrorBanner.displayName = 'ErrorBanner';

export default ErrorBanner;
export type { ErrorBannerProps, ErrorBannerSeverity };

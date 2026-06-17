/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { CloseOne } from '@icon-park/react';
import classNames from 'classnames';
import { iconColors } from '@renderer/styles/colors';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';

interface SiderFooterProps {
  isMobile: boolean;
  collapsed?: boolean;
  siderTooltipProps: SiderTooltipProps;
  showLogout?: boolean;
  onLogoutClick?: () => void;
}

const SiderFooter: React.FC<SiderFooterProps> = ({
  isMobile,
  collapsed = false,
  siderTooltipProps,
  showLogout = false,
  onLogoutClick,
}) => {
  const { t } = useTranslation();

  if (!showLogout || !onLogoutClick) {
    return null;
  }

  return (
    <div className='shrink-0 sider-footer mt-auto pt-4px pb-4px border-t border-solid border-[var(--color-border-2)] border-l-0 border-r-0 border-b-0'>
      <div className={classNames('flex', collapsed ? 'flex-col gap-2px' : 'items-center gap-2px')}>
        <Tooltip {...siderTooltipProps} content={t('settings.googleLogout')} position='right'>
          <div
            onClick={onLogoutClick}
            className={classNames(
              'h-24px flex items-center rd-6px cursor-pointer transition-colors hover:bg-[rgba(var(--primary-6),0.14)] active:bg-fill-2',
              collapsed ? 'w-full justify-center' : 'flex-1 min-w-0 justify-start gap-6px px-8px',
              isMobile && 'sider-footer-btn-mobile'
            )}
          >
            <span className='size-16px flex items-center justify-center shrink-0'>
              <CloseOne
                theme='outline'
                size='13'
                fill={iconColors.primary}
                className='block leading-none'
                style={{ lineHeight: 0 }}
              />
            </span>
            <span className='collapsed-hidden text-t-primary text-12px font-[500] leading-18px truncate'>
              {t('settings.googleLogout')}
            </span>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

export default SiderFooter;

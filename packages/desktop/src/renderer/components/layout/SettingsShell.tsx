/**
 * Full-area settings surface (below app titlebar): dedicated nav column + page content.
 * Replaces swapping the main left sider into "settings mode".
 */

import React, { Suspense } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ArrowCircleLeft, Moon, SunOne } from '@icon-park/react';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useThemeContext } from '@/renderer/hooks/context/ThemeContext';
import { useExitSettings } from '@/renderer/hooks/system/useExitSettings';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';

const SettingsSider = React.lazy(() => import('@renderer/pages/settings/components/SettingsSider'));

type SettingsShellProps = {
  children: React.ReactNode;
};

const SettingsShell: React.FC<SettingsShellProps> = ({ children }) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { theme, setTheme } = useThemeContext();
  const { exitSettings } = useExitSettings();
  const themeTooltip = theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode');
  const backLabel = t('common.back', { defaultValue: 'Back to Chat' });

  const handleThemeToggle = () => {
    void setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (isMobile) {
    return (
      <div className='settings-shell settings-shell--mobile flex flex-col flex-1 min-h-0 w-full bg-1'>
        <div className='shrink-0 flex items-center justify-between gap-8px px-12px py-8px border-b border-[var(--border-light)]'>
          <button
            type='button'
            onClick={exitSettings}
            className='flex items-center gap-6px text-13px font-[500] text-brand border-0 bg-transparent p-0 cursor-pointer'
          >
            <ArrowCircleLeft theme='outline' size={16} fill='currentColor' />
            {backLabel}
          </button>
          <button
            type='button'
            className='app-titlebar__button app-titlebar__button--mobile'
            onClick={handleThemeToggle}
            aria-label={themeTooltip}
            title={themeTooltip}
          >
            {theme === 'dark' ? (
              <SunOne theme='outline' size={16} fill='currentColor' />
            ) : (
              <Moon theme='outline' size={16} fill='currentColor' />
            )}
          </button>
        </div>
        <SettingsPageWrapper className='flex-1 min-h-0 !py-0' contentClassName='max-w-none md:max-w-none'>
          {children}
        </SettingsPageWrapper>
      </div>
    );
  }

  return (
    <div className='settings-shell settings-shell--desktop flex flex-row flex-1 min-h-0 w-full bg-1'>
      <aside
        className={classNames(
          'settings-shell__nav shrink-0 flex flex-col border-r border-[var(--border-light)] bg-2',
          'w-220px min-w-200px max-w-260px px-4px py-8px'
        )}
        aria-label={t('common.settings', { defaultValue: 'Settings' })}
      >
        <div className='shrink-0 px-4px pb-8px flex flex-col gap-6px'>
          <button
            type='button'
            onClick={exitSettings}
            className='settings-shell__back h-28px w-full flex items-center gap-6px px-8px rd-6px text-12px font-[500] text-brand cursor-pointer border-0 bg-transparent hover:bg-fill-3 transition-colors'
          >
            <ArrowCircleLeft theme='outline' size={14} fill='currentColor' className='shrink-0' />
            <span className='truncate'>{backLabel}</span>
          </button>
          <div className='flex items-center justify-between gap-8px px-4px'>
            <span className='text-12px font-[600] text-t-secondary uppercase tracking-wide truncate'>
              {t('common.settings', { defaultValue: 'Settings' })}
            </span>
            <button
              type='button'
              className='app-titlebar__button shrink-0'
              onClick={handleThemeToggle}
              aria-label={themeTooltip}
              title={themeTooltip}
            >
              {theme === 'dark' ? (
                <SunOne theme='outline' size={16} fill='currentColor' />
              ) : (
                <Moon theme='outline' size={16} fill='currentColor' />
              )}
            </button>
          </div>
        </div>
        <div className='flex-1 min-h-0 overflow-hidden'>
          <Suspense fallback={<div className='size-full' />}>
            <SettingsSider collapsed={false} tooltipEnabled={false} />
          </Suspense>
        </div>
      </aside>
      <main className='settings-shell__main flex-1 min-h-0 min-w-0 overflow-auto'>{children}</main>
    </div>
  );
};

export default SettingsShell;
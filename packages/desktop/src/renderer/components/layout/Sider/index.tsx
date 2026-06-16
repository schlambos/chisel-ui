import React, { useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { cleanupSiderTooltips, getSiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { useTeamCreatedRedirect } from '@renderer/pages/team/hooks/useTeamCreatedRedirect';
import SiderFooter from './SiderFooter';
import SiderWorkspacePanel from './SiderWorkspacePanel';

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { pathname } = useLocation();

  const { closePreview } = usePreviewContext();
  const { logout, status } = useAuth();
  useTeamCreatedRedirect();
  const showLogout =
    typeof window !== 'undefined' && !(window as { electronAPI?: unknown }).electronAPI && status === 'authenticated';

  const handleLogout = useCallback(async () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      return;
    }
    if (onSessionClick) {
      onSessionClick();
    }
  }, [closePreview, logout, onSessionClick]);

  useEffect(() => {
    if (!showLogout) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        handleLogout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleLogout, showLogout]);

  const tooltipEnabled = collapsed && !isMobile;
  const siderTooltipProps = getSiderTooltipProps(tooltipEnabled);

  // Settings routes render in SettingsShell; this sider is workspace-only.
  if (pathname.startsWith('/settings')) {
    return null;
  }

  return (
    <div className='size-full flex flex-col'>
      <div className='flex-1 min-h-0 overflow-hidden'>
        <SiderWorkspacePanel collapsed={collapsed} />
      </div>
      <SiderFooter
        isMobile={isMobile}
        collapsed={collapsed}
        siderTooltipProps={siderTooltipProps}
        showLogout={showLogout}
        onLogoutClick={handleLogout}
      />
    </div>
  );
};

export default Sider;
import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'aion:last-non-settings-path';

/**
 * Navigate back to the last non-settings route (same behavior as pre-shell sider "Back").
 */
export function useExitSettings(): { exitSettings: () => void } {
  const navigate = useNavigate();
  const location = useLocation();
  const lastNonSettingsPathRef = useRef('/guid');
  const isSettingsRoute = location.pathname.startsWith('/settings');

  useEffect(() => {
    if (!isSettingsRoute) {
      const path = `${location.pathname}${location.search}${location.hash}`;
      lastNonSettingsPathRef.current = path;
      try {
        sessionStorage.setItem(STORAGE_KEY, path);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        lastNonSettingsPathRef.current = stored;
      }
    } catch {
      /* ignore */
    }
  }, [isSettingsRoute, location.pathname, location.search, location.hash]);

  const exitSettings = useCallback(() => {
    const target = lastNonSettingsPathRef.current;
    if (target && !target.startsWith('/settings')) {
      void navigate(target);
      return;
    }
    void navigate('/guid');
  }, [navigate]);

  return { exitSettings };
}
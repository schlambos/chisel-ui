import React, { Suspense } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import SettingsShell from '@renderer/components/layout/SettingsShell';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { TEAM_MODE_ENABLED } from '@/common/config/constants';
const Conversation = React.lazy(() => import('@renderer/pages/conversation'));
const Guid = React.lazy(() => import('@renderer/pages/guid'));
const AgentSettings = React.lazy(() => import('@renderer/pages/settings/AgentSettings'));
const AssistantSettings = React.lazy(() => import('@renderer/pages/settings/AssistantSettings'));
const DisplaySettings = React.lazy(() => import('@renderer/pages/settings/DisplaySettings'));
const PermissionsSettings = React.lazy(() => import('@renderer/pages/settings/PermissionsSettings'));
const ModeSettings = React.lazy(() => import('@renderer/pages/settings/ModeSettings'));
const SystemSettings = React.lazy(() => import('@renderer/pages/settings/SystemSettings'));
const WebuiSettings = React.lazy(() => import('@renderer/pages/settings/WebuiSettings'));
const ExtensionSettingsPage = React.lazy(() => import('@renderer/pages/settings/ExtensionSettingsPage'));
const LoginPage = React.lazy(() => import('@renderer/pages/login'));
const ComponentsShowcase = import.meta.env.DEV ? React.lazy(() => import('@renderer/pages/TestShowcase')) : null;
const TeamIndex = React.lazy(() => import('@renderer/pages/team'));

const withRouteFallback = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<AppLoader />}>
    <Component />
  </Suspense>
);

const SettingsLayout: React.FC = () => (
  <SettingsShell>
    <Suspense fallback={<AppLoader />}>
      <Outlet />
    </Suspense>
  </SettingsShell>
);

const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return React.cloneElement(layout);
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route
          path='/login'
          element={status === 'authenticated' ? <Navigate to='/guid' replace /> : withRouteFallback(LoginPage)}
        />
        <Route element={<ProtectedLayout layout={layout} />}>
          <Route index element={<Navigate to='/guid' replace />} />
          <Route path='/guid' element={withRouteFallback(Guid)} />
          <Route path='/conversation/:id' element={withRouteFallback(Conversation)} />
          <Route
            path='/team/:id'
            element={TEAM_MODE_ENABLED ? withRouteFallback(TeamIndex) : <Navigate to='/guid' replace />}
          />
          <Route path='/settings' element={<SettingsLayout />}>
            <Route index element={<Navigate to='agent' replace />} />
            <Route path='model' element={withRouteFallback(ModeSettings)} />
            <Route path='assistants' element={withRouteFallback(AssistantSettings)} />
            <Route path='agent' element={withRouteFallback(AgentSettings)} />
            <Route path='capabilities' element={<Navigate to='agent' replace />} />
            <Route path='skills-hub' element={<Navigate to='agent' replace />} />
            <Route path='tools' element={<Navigate to='agent' replace />} />
            <Route path='display' element={withRouteFallback(DisplaySettings)} />
            <Route path='permissions' element={withRouteFallback(PermissionsSettings)} />
            <Route path='webui' element={withRouteFallback(WebuiSettings)} />
            <Route path='sidecar' element={<Navigate to='agent' replace />} />
            <Route path='pet' element={<Navigate to='display' replace />} />
            <Route path='system' element={withRouteFallback(SystemSettings)} />
            <Route path='about' element={withRouteFallback(SystemSettings)} />
            <Route path='ext/:tabId' element={withRouteFallback(ExtensionSettingsPage)} />
          </Route>
          {ComponentsShowcase && <Route path='/test/components' element={withRouteFallback(ComponentsShowcase)} />}
        </Route>
        <Route path='*' element={<Navigate to={status === 'authenticated' ? '/guid' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;

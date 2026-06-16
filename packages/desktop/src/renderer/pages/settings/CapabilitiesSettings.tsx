/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CapabilitiesSettings — MCP servers and speech-to-text (formerly split with Skills Hub).
 * Accessible via /settings/capabilities.
 *
 * Legacy routes (/settings/skills-hub, ?tab=skills) redirect to /settings/capabilities.
 */

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolsModalContent from '@/renderer/components/settings/SettingsModal/contents/ToolsModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const CapabilitiesSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Drop legacy ?tab=skills (and normalize ?tab=tools) so URL stays clean.
  useEffect(() => {
    if (!searchParams.has('tab')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <ToolsModalContent />
    </SettingsPageWrapper>
  );
};

export default CapabilitiesSettings;
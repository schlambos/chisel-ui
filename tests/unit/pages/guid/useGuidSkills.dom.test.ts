/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for pages/guid/hooks/useGuidSkills.ts.
 * Tests skills catalog loading, per-skill toggle state, and preset-assistant skill sync.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock @/common
vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listBuiltinAutoSkills: { invoke: vi.fn() },
      listAvailableSkills: { invoke: vi.fn() },
    },
  },
}));

// Mock react-i18next (not directly used by the hook, but imported by consumers)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'en' },
  }),
}));

import { useGuidSkills } from '@/renderer/pages/guid/hooks/useGuidSkills';
import { ipcBridge } from '@/common';

describe('useGuidSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and merges skills on mount, deduplicating by name', async () => {
    const autoSkills = [
      { name: 'code', description: 'Code interpreter', isAuto: true },
      { name: 'web', description: 'Web search', isAuto: true },
    ];
    const availableSkills = [
      { name: 'code', description: 'Code interpreter (dup)', isAuto: false },
      { name: 'pdf', description: 'PDF reader', isAuto: false },
    ];
    (ipcBridge.fs.listBuiltinAutoSkills.invoke as any).mockResolvedValue(autoSkills);
    (ipcBridge.fs.listAvailableSkills.invoke as any).mockResolvedValue(availableSkills);

    const { result } = renderHook(() => useGuidSkills({ selectedAssistantRecord: undefined }));

    await waitFor(() => expect(result.current.allSkills).toHaveLength(3));

    expect(result.current.allSkills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'code', isAuto: true }),
        expect.objectContaining({ name: 'web', isAuto: true }),
        expect.objectContaining({ name: 'pdf', isAuto: false }),
      ])
    );
  });

  it('falls back to empty array when skills load fails', async () => {
    (ipcBridge.fs.listBuiltinAutoSkills.invoke as any).mockRejectedValue(new Error('fs error'));
    (ipcBridge.fs.listAvailableSkills.invoke as any).mockRejectedValue(new Error('fs error'));

    const { result } = renderHook(() => useGuidSkills({ selectedAssistantRecord: undefined }));

    await waitFor(() => expect(result.current.allSkills).toHaveLength(0));
    expect(result.current.guidDisabledBuiltinSkills).toBeUndefined();
    expect(result.current.guidEnabledSkills).toBeUndefined();
  });

  it('starts with undefined skill lists until preset is resolved', async () => {
    (ipcBridge.fs.listBuiltinAutoSkills.invoke as any).mockResolvedValue([]);
    (ipcBridge.fs.listAvailableSkills.invoke as any).mockResolvedValue([]);

    const { result } = renderHook(() => useGuidSkills({ selectedAssistantRecord: undefined }));

    await waitFor(() => expect(result.current.allSkills).toHaveLength(0));
    expect(result.current.guidDisabledBuiltinSkills).toBeUndefined();
    expect(result.current.guidEnabledSkills).toBeUndefined();
  });

  it('syncs skills from preset assistant when provided', async () => {
    (ipcBridge.fs.listBuiltinAutoSkills.invoke as any).mockResolvedValue([]);
    (ipcBridge.fs.listAvailableSkills.invoke as any).mockResolvedValue([]);

    const presetRecord = {
      enabled_skills: ['code', 'pdf'],
      disabled_builtin_skills: ['web'],
    };

    const { result, rerender } = renderHook(
      (props) => useGuidSkills({ selectedAssistantRecord: props.selectedAssistantRecord }),
      { initialProps: { selectedAssistantRecord: undefined as any } }
    );

    await waitFor(() => expect(result.current.allSkills).toHaveLength(0));

    rerender({ selectedAssistantRecord: presetRecord });

    await waitFor(() => expect(result.current.guidEnabledSkills).toEqual(['code', 'pdf']));
    expect(result.current.guidDisabledBuiltinSkills).toEqual(['web']);
  });

  it('clears skill lists when preset assistant record is removed', async () => {
    (ipcBridge.fs.listBuiltinAutoSkills.invoke as any).mockResolvedValue([]);
    (ipcBridge.fs.listAvailableSkills.invoke as any).mockResolvedValue([]);

    const presetRecord = {
      enabled_skills: ['code'],
      disabled_builtin_skills: [],
    };

    const { result, rerender } = renderHook(
      (props) => useGuidSkills({ selectedAssistantRecord: props.selectedAssistantRecord }),
      { initialProps: { selectedAssistantRecord: presetRecord as any } }
    );

    await waitFor(() => expect(result.current.guidEnabledSkills).toEqual(['code']));

    rerender({ selectedAssistantRecord: undefined });

    await waitFor(() => expect(result.current.guidEnabledSkills).toBeUndefined());
    expect(result.current.guidDisabledBuiltinSkills).toBeUndefined();
  });

  it('toggles auto-skill disable state correctly', async () => {
    (ipcBridge.fs.listBuiltinAutoSkills.invoke as any).mockResolvedValue([
      { name: 'code', description: 'Code', isAuto: true },
    ]);
    (ipcBridge.fs.listAvailableSkills.invoke as any).mockResolvedValue([]);

    const { result } = renderHook(() => useGuidSkills({ selectedAssistantRecord: undefined }));

    await waitFor(() => expect(result.current.allSkills).toHaveLength(1));

    // Toggle disable for auto skill
    act(() => {
      result.current.handleToggleSkill('code', true);
    });
    expect(result.current.guidDisabledBuiltinSkills).toEqual(['code']);

    // Toggle again to re-enable
    act(() => {
      result.current.handleToggleSkill('code', true);
    });
    expect(result.current.guidDisabledBuiltinSkills).toEqual([]);
  });

  it('toggles non-auto skill enable state correctly', async () => {
    (ipcBridge.fs.listBuiltinAutoSkills.invoke as any).mockResolvedValue([]);
    (ipcBridge.fs.listAvailableSkills.invoke as any).mockResolvedValue([
      { name: 'pdf', description: 'PDF', isAuto: false },
    ]);

    const { result } = renderHook(() => useGuidSkills({ selectedAssistantRecord: undefined }));

    await waitFor(() => expect(result.current.allSkills).toHaveLength(1));

    act(() => {
      result.current.handleToggleSkill('pdf', false);
    });
    expect(result.current.guidEnabledSkills).toEqual(['pdf']);

    act(() => {
      result.current.handleToggleSkill('pdf', false);
    });
    expect(result.current.guidEnabledSkills).toEqual([]);
  });
});

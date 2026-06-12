/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useCallback, useEffect, useState } from 'react';
import type { Assistant } from '@/common/types/agent/assistantTypes';

export type SkillEntry = {
  name: string;
  description: string;
  isAuto: boolean;
};

export type GuidSkillsResult = {
  allSkills: SkillEntry[];
  guidDisabledBuiltinSkills: string[] | undefined;
  guidEnabledSkills: string[] | undefined;
  handleToggleSkill: (skillName: string, isAuto: boolean) => void;
};

export type UseGuidSkillsOptions = {
  selectedAssistantRecord: Pick<Assistant, 'enabled_skills' | 'disabled_builtin_skills'> | undefined;
};

/**
 * Manages the skills catalog, per-user enable/disable state, and preset-assistant
 * skill sync for the Guid page. Loads builtin-auto and available skills once on
 * mount, merges them into a deduplicated catalog, and keeps the disabled-builtin /
 * enabled lists in sync with the active preset assistant when one is selected.
 */
export const useGuidSkills = ({ selectedAssistantRecord }: UseGuidSkillsOptions): GuidSkillsResult => {
  const [allSkills, setAllSkills] = useState<SkillEntry[]>([]);
  const [guidDisabledBuiltinSkills, setGuidDisabledBuiltinSkills] = useState<string[] | undefined>(undefined);
  const [guidEnabledSkills, setGuidEnabledSkills] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    Promise.all([ipcBridge.fs.listBuiltinAutoSkills.invoke(), ipcBridge.fs.listAvailableSkills.invoke()])
      .then(([autoSkills, availableSkills]) => {
        const autoNames = new Set(autoSkills.map((s) => s.name));
        const merged: SkillEntry[] = [
          ...autoSkills.map((s) => ({ name: s.name, description: s.description, isAuto: true })),
          ...availableSkills
            .filter((s) => !autoNames.has(s.name))
            .map((s) => ({ name: s.name, description: s.description, isAuto: false })),
        ];
        setAllSkills(merged);
      })
      .catch(() => setAllSkills([]));
  }, []);

  const handleToggleSkill = useCallback((skillName: string, isAuto: boolean) => {
    if (isAuto) {
      setGuidDisabledBuiltinSkills((prev) => {
        const list = prev ?? [];
        return list.includes(skillName) ? list.filter((s) => s !== skillName) : [...list, skillName];
      });
    } else {
      setGuidEnabledSkills((prev) => {
        const list = prev ?? [];
        return list.includes(skillName) ? list.filter((s) => s !== skillName) : [...list, skillName];
      });
    }
  }, []);

  useEffect(() => {
    if (selectedAssistantRecord) {
      setGuidDisabledBuiltinSkills(selectedAssistantRecord.disabled_builtin_skills ?? []);
      setGuidEnabledSkills(selectedAssistantRecord.enabled_skills ?? []);
    } else {
      setGuidDisabledBuiltinSkills(undefined);
      setGuidEnabledSkills(undefined);
    }
  }, [selectedAssistantRecord]);

  return {
    allSkills,
    guidDisabledBuiltinSkills,
    guidEnabledSkills,
    handleToggleSkill,
  };
};

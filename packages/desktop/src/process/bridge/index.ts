/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { initApplicationBridge } from './applicationBridge';
import { initApprovalBridge } from './approvalBridge';
import { initDialogBridge } from './dialogBridge';
import { initGitBridge } from './gitBridge';
import { initLocalHistoryBridge } from './localHistoryBridge';
import { initUpdateBridge } from './updateBridge';
import { initSystemSettingsBridge } from './systemSettingsBridge';
import { initUntitledBackupBridge } from './untitledBackupBridge';
import { initWindowControlsBridge } from './windowControlsBridge';
import { initNotificationBridge } from './notificationBridge';
import { initWebuiBridge } from './webuiBridge';

export type BridgeDependencies = Record<string, never>;

export function initAllBridges(_deps: BridgeDependencies = {}): void {
  initDialogBridge();
  initApplicationBridge();
  initGitBridge();
  initLocalHistoryBridge();
  initWindowControlsBridge();
  initUpdateBridge();
  initSystemSettingsBridge();
  initNotificationBridge();
  initWebuiBridge();
  initUntitledBackupBridge();
  initApprovalBridge();
}

export {
  initApplicationBridge,
  initApprovalBridge,
  initDialogBridge,
  initGitBridge,
  initLocalHistoryBridge,
  initNotificationBridge,
  initSystemSettingsBridge,
  initUpdateBridge,
  initUntitledBackupBridge,
  initWindowControlsBridge,
  initWebuiBridge,
};
export { disposeGitBridge } from './gitBridge';
export { registerWindowMaximizeListeners } from './windowControlsBridge';
export const disposeAllTeamSessions = (): Promise<void> => Promise.resolve();

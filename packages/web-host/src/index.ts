import type { WebHostOptions, WebHostHandle } from './types.js';

export type { AppMetadata, BackendBinaryResolver, WebHostOptions, WebHostHandle, WebUIConfig } from './types.js';
export { resetPassword, changePassword, verifyPassword, loadConfig, saveConfig } from './auth/index.js';

// Backend launcher exports (M4)
export {
  BackendLifecycleManager,
  buildSpawnArgs,
  buildSpawnEnv,
  findAvailablePort,
  startBackend,
  stopBackend,
} from './backend-launcher.js';
export type {
  BackendDirConfig,
  BackendLaunchOptions,
  BackendHandle,
} from './backend-launcher.js';

/**
 * Start WebHost (main entry point)
 * M5: implementation will orchestrate backend-launcher + static-server + auth
 */
export async function startWebHost(opts: WebHostOptions): Promise<WebHostHandle> {
  throw new Error('M5: startWebHost not implemented yet');
}

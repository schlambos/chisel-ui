/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Module-level proxy bridge for editor-open requests from Monaco-VSCode.
 *
 * The `ViewsConfig.openEditorFunc` callback is consumed synchronously during
 * `wrapper.start()` before React mounts, so we can't pass React callbacks
 * directly. This module provides a proxy that React can register after mount.
 *
 * Flow: LSP → MonacoEditorService.openEditor → wrapOpenEditor → STEP 3
 * (openEditorFunc) → editorOpenProxy → bridgeCallback → openEditorFile →
 * waitForEditorWithUri → return ICodeEditor
 *
 * Note on StandaloneEditor vs StandaloneCodeEditor:
 * The `wrapOpenEditor` function's STEP 1 checks `editor instanceof StandaloneEditor`.
 * However, `monaco.editor.create()` returns `StandaloneCodeEditor`, and the class
 * hierarchy is `StandaloneEditor extends StandaloneCodeEditor`. This means STEP 1
 * will never find our editors. The bridge callback handles both new files AND
 * already-open files by checking `monaco.editor.getEditors()` directly.
 */

import * as monaco from '@aionui/editor-monaco';
import type {
  OpenEditor,
  IEditorOptions,
  IResolvedTextEditorModel,
  IReference,
} from '@codingame/monaco-vscode-editor-service-override';
import type { ICodeEditor } from '@codingame/monaco-vscode-api/vscode/vs/editor/browser/editorBrowser';
import { fileIdentityKey } from './editorMonacoUri';

/**
 * The React-side callback: receives a Monaco URI, opens the file via EditorContext,
 * waits for the editor to appear, and returns the ICodeEditor instance.
 */
type EditorOpenBridgeCallback = (
  uri: monaco.Uri,
  options: IEditorOptions | undefined
) => Promise<ICodeEditor | undefined>;

let bridgeCallback: EditorOpenBridgeCallback | null = null;

/**
 * Register the bridge callback from React (EditorContext).
 * Pass null to unregister (on unmount).
 */
export function setEditorOpenCallback(cb: EditorOpenBridgeCallback | null): void {
  bridgeCallback = cb;
}

/**
 * The OpenEditor function to pass in ViewsConfig.openEditorFunc.
 * This is a thin proxy that delegates to whatever callback React has registered.
 */
export const editorOpenProxy: OpenEditor = async (
  modelRef: IReference<IResolvedTextEditorModel>,
  options: IEditorOptions | undefined,
  _sideBySide?: boolean
): Promise<ICodeEditor | undefined> => {
  if (!bridgeCallback) {
    console.warn('[editorOpenBridge] No callback registered, cannot open editor');
    modelRef.dispose();
    return undefined;
  }

  const uri = modelRef.object.textEditorModel.uri;

  // First check if an editor already has this model open (since STEP 1 in
  // wrapOpenEditor won't find our StandaloneCodeEditor instances).
  const existingEditor = findEditorWithUri(uri);
  if (existingEditor) {
    modelRef.dispose();
    // Cast through unknown: @aionui/editor-monaco and @codingame/monaco-vscode-api
    // expose structurally identical ICodeEditor but from different type packages.
    return existingEditor as unknown as ICodeEditor;
  }

  // Otherwise, delegate to React to open the file and wait for the editor.
  // Only dispose modelRef on the error path — wrapOpenEditor manages the ref
  // on success: it disposes when the fallback returns undefined and keeps the
  // ref alive when an editor is returned.
  try {
    const result = await bridgeCallback(uri, options);
    return result ?? undefined;
  } catch (err) {
    modelRef.dispose();
    throw err;
  }
};

/**
 * Synchronously find an existing editor with the given URI.
 * Returns null if no editor has this model.
 */
function findEditorWithUri(uri: monaco.Uri): monaco.editor.ICodeEditor | null {
  const targetUriStr = fileIdentityKey(uri.toString());
  const editors = monaco.editor.getEditors();
  for (const ed of editors) {
    const model = ed.getModel();
    if (model && fileIdentityKey(model.uri.toString()) === targetUriStr) {
      return ed;
    }
  }
  return null;
}

/**
 * Convert a Monaco file:// URI back to a disk path.
 * This is the reverse of `uriForBuffer` in editorMonacoUri.ts.
 */
export function uriToDiskPath(uri: monaco.Uri): string {
  if (uri.scheme !== 'file') {
    return uri.path;
  }
  let p = uri.path;
  // Handle Windows drive letters: /C:/foo -> C:\foo
  if (/^\/[a-zA-Z]:/.test(p)) {
    p = p.slice(1);
  }
  return p;
}

/**
 * Poll monaco.editor.getEditors() until one has a model with the matching URI.
 * Used to wait for React to render the editor after openEditorFile is called.
 */
export async function waitForEditorWithUri(
  uri: monaco.Uri,
  { timeout = 3000, interval = 50 }: { timeout?: number; interval?: number } = {}
): Promise<ICodeEditor | null> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const match = findEditorWithUri(uri);
    if (match) return match as unknown as ICodeEditor;
    await new Promise((r) => setTimeout(r, interval));
  }

  return null;
}

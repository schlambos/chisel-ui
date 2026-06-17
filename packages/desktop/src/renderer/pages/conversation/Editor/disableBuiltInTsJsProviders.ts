/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Disable built-in Monaco TypeScript/JavaScript providers to avoid conflicts
 * with the LSP backend. Without this, users see dual completions, diagnostics,
 * and hover information from both the built-in TS worker and the LSP server.
 *
 * The `monaco.languages.typescript` namespace (with `typescriptDefaults` /
 * `javascriptDefaults`) is a standalone-`monaco-editor` feature and is NOT
 * guaranteed to exist at runtime. The `@aionui/editor-monaco` package uses
 * `@codingame/monaco-vscode-editor-api` (the VSCode-API flavor), where this
 * namespace is absent. When it is absent, there are no built-in providers to
 * disable, so this function is a defensive no-op.
 *
 * Tradeoff: TS/JS files without an active LSP session will have no completions
 * or diagnostics. This is by design — the app always targets LSP-backed projects.
 */

import * as monaco from '@aionui/editor-monaco';

/**
 * Cast through unknown: @aionui/editor-monaco does not re-export
 * `languages.typescript` in its type declarations. The namespace may
 * exist at runtime when standalone `monaco-editor` loads the TS worker
 * contribution, but is absent in the VSCode-API build.
 */
type TsLanguageDefaults = {
  setModeConfiguration(config: Record<string, boolean>): void;
  setDiagnosticsOptions(options: { noSemanticValidation: boolean; noSyntaxValidation: boolean }): void;
};

type TsLanguageNamespace =
  | {
      typescriptDefaults: TsLanguageDefaults;
      javascriptDefaults: TsLanguageDefaults;
    }
  | undefined;

const tsDefaults = (monaco.languages as unknown as { typescript?: TsLanguageNamespace }).typescript;

export function disableBuiltInTsJsProviders(): void {
  if (!tsDefaults?.typescriptDefaults || !tsDefaults?.javascriptDefaults) {
    return;
  }

  try {
    const disabledConfig = {
      completionItems: false,
      hovers: false,
      documentSymbols: false,
      definitions: false,
      references: false,
      documentHighlights: false,
      rename: false,
      diagnostics: false,
      documentRangeFormattingEdits: false,
      signatureHelp: false,
      onTypeFormattingEdits: false,
      codeActions: false,
      inlayHints: false,
    };

    tsDefaults.typescriptDefaults.setModeConfiguration(disabledConfig);
    tsDefaults.javascriptDefaults.setModeConfiguration(disabledConfig);

    tsDefaults.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    tsDefaults.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[disableBuiltInTsJsProviders] Failed to disable built-in TS/JS providers; continuing without dedup.',
      err
    );
  }
}

/**
 * Standalone Emmet abbreviation expansion for the Monaco editor.
 *
 * Uses the `emmet` npm package (pure JS, no VS Code extension host) to expand
 * abbreviations on Tab in markup/stylesheet languages. The `extract()` function
 * from `emmet` handles proper abbreviation boundary detection — it knows that
 * `<span>.foo[title=bar]</span>` contains the abbreviation `.foo[title=bar]`
 * without false-positiveing on the surrounding HTML.
 *
 * Does NOT interfere with Monaco's built-in tabCompletion / snippet support:
 * the registered action has preconditions that exclude it when the suggestion
 * widget is visible or snippet mode is active, and `tryExpandEmmet` returns
 * null for non-abbreviation text so Tab falls through to default behavior.
 */

import type * as monaco from '@aionui/editor-monaco';
import expandAbbreviation, { extract, resolveConfig } from 'emmet';

/** Language IDs where Emmet expansion is supported. */
const MARKUP_LANGUAGES = new Set([
  'html',
  'xml',
  'xsl',
  'haml',
  'pug',
  'jade',
  'slim',
  'handlebars',
  'razor',
  'vue',
  'svelte',
  'php',
]);

const STYLESHEET_LANGUAGES = new Set(['css', 'scss', 'less', 'sass']);

/** Languages that may be JSX — requires URI extension check to disambiguate. */
const JSX_LANGUAGES = new Set(['jsx', 'tsx', 'typescript', 'javascript']);

/** Returns true when the model's URI path ends in .tsx or .jsx. */
function isJsxPath(model: monaco.editor.ITextModel): boolean {
  return /\.(tsx|jsx)$/i.test(model.uri.path);
}

type SyntaxType = 'markup' | 'stylesheet';

interface EmmetLanguageInfo {
  type: SyntaxType;
  syntax: string;
  jsxEnabled?: boolean;
}

/**
 * Map a Monaco model to the Emmet syntax info.
 * Checks both the language ID and the URI path extension so that
 * .tsx/.jsx files get Emmet support even though Monaco maps them to
 * 'typescript'/'javascript' respectively.
 * Returns null for unsupported languages (including plain .ts/.js).
 */
function emmetInfoForLanguage(model: monaco.editor.ITextModel): EmmetLanguageInfo | null {
  const languageId = model.getLanguageId();

  if (MARKUP_LANGUAGES.has(languageId)) {
    return { type: 'markup', syntax: languageId };
  }
  if (STYLESHEET_LANGUAGES.has(languageId)) {
    return { type: 'stylesheet', syntax: languageId };
  }
  if (JSX_LANGUAGES.has(languageId) && isJsxPath(model)) {
    return { type: 'markup', syntax: 'jsx', jsxEnabled: true };
  }
  return null;
}

/**
 * Check whether Emmet expansion is supported for the given model.
 */
export function isEmmetLanguage(languageId: string, filePath?: string): boolean {
  if (MARKUP_LANGUAGES.has(languageId) || STYLESHEET_LANGUAGES.has(languageId)) {
    return true;
  }
  if (JSX_LANGUAGES.has(languageId) && filePath && /\.(tsx|jsx)$/i.test(filePath)) {
    return true;
  }
  return false;
}

/**
 * Attempt to expand an Emmet abbreviation at the cursor position.
 *
 * Uses `emmet.extract()` for robust abbreviation boundary detection — it
 * understands that in `<div>.foo|</div>` the abbreviation is `.foo`, not the
 * entire line. Returns the replacement range + expanded text, or null when
 * no expandable abbreviation is found.
 */
export function tryExpandEmmet(
  editor: monaco.editor.IStandaloneCodeEditor
): { range: monaco.IRange; text: string } | null {
  const model = editor.getModel();
  if (!model) return null;

  const position = editor.getPosition();
  if (!position) return null;

  const emmetInfo = emmetInfoForLanguage(model);
  if (!emmetInfo) return null;

  const lineContent = model.getLineContent(position.lineNumber);
  const column = position.column - 1; // 0-based for emmet.extract

  const extracted = extract(lineContent, column, { type: emmetInfo.type });
  if (!extracted) return null;

  const abbreviation = extracted.abbreviation;
  if (!abbreviation || abbreviation.length < 2) return null;

  try {
    const config = resolveConfig({
      type: emmetInfo.type,
      syntax: emmetInfo.syntax,
      ...(emmetInfo.jsxEnabled ? { options: { 'jsx.enabled': true } } : {}),
    });
    const expanded = expandAbbreviation(abbreviation, config);
    if (!expanded || expanded === abbreviation) return null;

    // extracted.start and extracted.end are 0-based offsets in the line.
    // Monaco uses 1-based columns.
    const startColumn = extracted.start + 1;
    const endColumn = extracted.end + 1;

    return {
      range: {
        startLineNumber: position.lineNumber,
        startColumn,
        endLineNumber: position.lineNumber,
        endColumn,
      },
      text: expanded,
    };
  } catch {
    // Invalid abbreviation — not expandable. Silently return null so Tab
    // falls through to Monaco's default behavior (indent / snippet).
    return null;
  }
}

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@arco-design/web-react';
import { Copy, Down, Up } from '@icon-park/react';
import katex from 'katex';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { forgeDark, forgeLight } from './codeThemes';
import { copyText } from '@/renderer/utils/ui/clipboard';
import MermaidBlock from './MermaidBlock';
import { formatCode, getDiffLineStyle } from './markdownUtils';
import styles from './CodeBlock.module.css';

const PREVIEW_LINES = 3;
// code span: font-size 13px, line-height 20px (per ShadowView injection)
const CODE_LINE_HEIGHT = 20;
// SyntaxHighlighter pre padding: 0.5em top + 0.5em bottom ≈ 13px each side
const CODE_PADDING_VERTICAL = 13;
const COLLAPSED_HEIGHT = PREVIEW_LINES * CODE_LINE_HEIGHT + CODE_PADDING_VERTICAL;

type CodeBlockProps = {
  children: string;
  className?: string;
  node?: unknown;
  hiddenCodeCopyButton?: boolean;
  codeStyle?: React.CSSProperties;
  [key: string]: unknown;
};

function CodeBlockImpl(props: CodeBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
  );

  React.useEffect(() => {
    const update = () => {
      setCurrentTheme((document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light');
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Destructure and derive pure values up front so the memos below always
  // run in the same order, before any conditional return.
  const { children, className, node: _node, hiddenCodeCopyButton: _h, codeStyle: _c, ...rest } = props;
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1] || 'text';
  const isLatexLanguage = language === 'latex' || language === 'math' || language === 'tex';

  // Memoize expensive derived values so streaming re-renders that share the
  // same children/language skip KaTeX, formatCode, and string splits.
  const latexHtml = useMemo<string | null>(() => {
    if (!isLatexLanguage) return null;
    const latexSource = String(children).replace(/\n$/, '');
    const isFullDocument = /\\(documentclass|begin\{document\}|usepackage)\b/.test(latexSource);
    if (isFullDocument) return null;
    try {
      return katex.renderToString(latexSource, { displayMode: true, throwOnError: false });
    } catch {
      return null;
    }
  }, [children, isLatexLanguage]);

  const formattedContent = useMemo(() => formatCode(children), [children]);
  const isDiff = language === 'diff';
  const totalLines = useMemo(() => formattedContent.split('\n').length, [formattedContent]);
  const diffLines = useMemo(() => (isDiff ? formattedContent.split('\n') : []), [formattedContent, isDiff]);

  const toggleExpanded = () => {
    const willCollapse = expanded;
    setExpanded((v) => !v);
    if (willCollapse && containerRef.current) {
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      });
    }
  };

  // KaTeX math blocks
  if (latexHtml !== null) {
    return <div className='katex-display' dangerouslySetInnerHTML={{ __html: latexHtml }} />;
  }

  if (language === 'mermaid') {
    return <MermaidBlock code={formattedContent} style={props.codeStyle} />;
  }

  // Inline code (single line)
  if (!String(children).includes('\n')) {
    return (
      <code {...rest} className={`${className || ''} ${styles.inlineCode}`.trim()}>
        {children}
      </code>
    );
  }

  const canCollapse = totalLines > PREVIEW_LINES;
  const codeTheme = currentTheme === 'dark' ? forgeDark : forgeLight;
  const isDark = currentTheme === 'dark';

  const handleCopy = () => {
    void copyText(formattedContent)
      .then(() => {
        try {
          Message.success(t('common.copySuccess'));
        } catch {
          /* Shadow DOM portal may fail silently */
        }
      })
      .catch(() => {
        try {
          Message.error(t('common.copyFailed'));
        } catch {
          /* ignore */
        }
      });
  };

  const dynamicStyles = {
    '--cb-max-height': canCollapse && !expanded ? `${COLLAPSED_HEIGHT}px` : 'none',
    ...props.codeStyle,
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      style={dynamicStyles}
      className={`group ${styles.container}`}
    >
      <div className={styles.block}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.language}>
            {language.toLocaleLowerCase()}
          </span>
          {/* Buttons: always visible on touch devices, hover-only on pointer devices */}
          <div className={`opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${styles.actions}`}>
            {canCollapse && (
              <span title={expanded ? t('common.collapse') : t('common.expand')} className={styles.actionBtn}>
                {expanded ? (
                  <Up
                    theme='outline'
                    size='14'
                    className={styles.icon}
                    fill="var(--text-secondary)"
                    onClick={toggleExpanded}
                  />
                ) : (
                  <Down
                    theme='outline'
                    size='14'
                    className={styles.icon}
                    fill="var(--text-secondary)"
                    onClick={toggleExpanded}
                  />
                )}
              </span>
            )}
            <span title={t('common.copy')} className={styles.actionBtn}>
              <Copy
                theme='outline'
                size='14'
                className={styles.icon}
                fill="var(--text-secondary)"
                onClick={handleCopy}
              />
            </span>
          </div>
        </div>

        {/* Code content — always full content, clipped by maxHeight when collapsed */}
        <div className={styles.content}>
          <SyntaxHighlighter
            children={formattedContent}
            language={language}
            style={codeTheme}
            PreTag='div'
            wrapLines={isDiff}
            lineProps={
              isDiff
                ? (lineNumber: number) => ({
                    style: {
                      display: 'block',
                      ...getDiffLineStyle(diffLines[lineNumber - 1] || '', isDark),
                    },
                  })
                : undefined
            }
            className={styles.syntaxPre}
            codeTagProps={{
              className: styles.syntaxCode,
            }}
          />
          {canCollapse && !expanded && (
            <div className={styles.gradient} />
          )}
        </div>

        {/* Footer */}
        {canCollapse && (
          <div className={styles.footer} onClick={toggleExpanded}>
            <span className={styles.footerText}>
              {expanded ? t('common.collapse') : t('common.viewMoreLines', { count: totalLines - PREVIEW_LINES })}
            </span>
            {expanded ? (
              <Up theme='outline' size='12' fill="var(--text-tertiary)" />
            ) : (
              <Down theme='outline' size='12' fill="var(--text-tertiary)" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CodeBlock = React.memo(CodeBlockImpl);
CodeBlock.displayName = 'CodeBlock';

export default CodeBlock;

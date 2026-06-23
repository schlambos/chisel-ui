import React from 'react';
import { FileText, Terminal, Search, Globe, Tool } from '@icon-park/react';

export function getToolCategoryIcon(toolName: string): React.ReactElement {
  const name = toolName.toLowerCase();
  const props = { theme: 'outline' as const, size: '14' };

  if (
    ['read', 'write', 'edit', 'replace', 'writefile', 'readfile', 'create', 'delete', 'move', 'rename', 'open', 'save', 'copy', 'mkdir'].includes(name)
  ) {
    return <FileText {...props} />;
  }

  if (['bash', 'shell', 'exec', 'run', 'command', 'execute', 'terminal', 'sh', 'zsh'].includes(name)) {
    return <Terminal {...props} />;
  }

  if (['grep', 'search', 'find', 'glob', 'list', 'ls', 'readdir', 'locate', 'rg', 'ag'].includes(name)) {
    return <Search {...props} />;
  }

  if (['fetch', 'curl', 'http', 'request', 'api', 'browse', 'url', 'download', 'wget'].includes(name)) {
    return <Globe {...props} />;
  }

  return <Tool {...props} />;
}

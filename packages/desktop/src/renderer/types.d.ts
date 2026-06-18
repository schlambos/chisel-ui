/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*?raw' {
  const content: string;
  export default content;
}

// Vite ?worker imports — each match resolves to a constructor that creates a
// Worker for the chunked source. Used by Monaco's language workers; see
// `pages/conversation/Editor/monacoEnvironment.ts`.
declare module '*?worker' {
  const WorkerCtor: new () => Worker;
  export default WorkerCtor;
}

declare module 'unocss';

// The `emmet` package ships types at `dist/index.d.ts` but its `exports` map
// lacks a `types` condition, so `moduleResolution: "bundler"` cannot find them.
// Provide ambient declarations for the functions we use.
declare module 'emmet' {
  type SyntaxType = 'markup' | 'stylesheet';
  type UserConfig = Partial<{
    type: SyntaxType;
    syntax: string;
    options: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  type Config = UserConfig & { options: Record<string, unknown> };
  interface ExtractedAbbreviation {
    abbreviation: string;
    location: number;
    start: number;
    end: number;
  }
  export default function expandAbbreviation(abbr: string, config?: Config): string;
  export function extract(
    line: string,
    pos?: number,
    options?: Partial<{ type: SyntaxType; lookAhead: boolean; prefix: string }>
  ): ExtractedAbbreviation | undefined;
  export function resolveConfig(config?: UserConfig, globals?: Record<string, Partial<Config>>): Config;
}

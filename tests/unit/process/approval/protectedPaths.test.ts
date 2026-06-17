/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { evaluateApprovalRules } from '@/process/services/approval/evaluator';
import { isPatternProtected, requestTouchesProtectedPath } from '@/process/services/approval/protectedPaths';
import type {
  ApprovalEvaluationContext,
  ApprovalRule,
  ChislPermissionRequest,
} from '@/process/services/approval/types';

const HOME = process.env.HOME ?? '/home/user';

describe('isPatternProtected', () => {
  it('matches ~/.ssh/id_rsa via absolute home path', () => {
    expect(isPatternProtected(`${HOME}/.ssh/id_rsa`)).toBe(true);
  });

  it('matches ~/.ssh/config via tilde path', () => {
    expect(isPatternProtected('~/.ssh/config')).toBe(true);
  });

  it('matches ~/.ssh/ subdirectory via absolute home path', () => {
    expect(isPatternProtected(`${HOME}/.ssh/some_dir/key`)).toBe(true);
  });

  it('matches .env at any depth', () => {
    expect(isPatternProtected('/proj/.env')).toBe(true);
  });

  it('matches .env.* at any depth', () => {
    expect(isPatternProtected('/proj/.env.local')).toBe(true);
  });

  it('matches credentials* at any depth', () => {
    expect(isPatternProtected('/x/credentials.json')).toBe(true);
  });

  it('matches *.pem at any depth', () => {
    expect(isPatternProtected('/x/key.pem')).toBe(true);
  });

  it('matches id_rsa at any depth', () => {
    expect(isPatternProtected(`${HOME}/.ssh/id_rsa`)).toBe(true);
  });

  it('matches id_ed25519 at any depth', () => {
    expect(isPatternProtected('~/.ssh/id_ed25519')).toBe(true);
  });

  it('does not match a normal source file', () => {
    expect(isPatternProtected('/proj/src/index.ts')).toBe(false);
  });

  it('does not match .env-like substring that is not a path segment', () => {
    expect(isPatternProtected('/proj/src/env_helper.ts')).toBe(false);
  });

  it('matches credentials without extension', () => {
    expect(isPatternProtected('/home/u/credentials')).toBe(true);
  });

  it('matches credentials with prefix-like suffix', () => {
    expect(isPatternProtected('/secrets/credentials-backup')).toBe(true);
  });

  it('matches root-relative .env', () => {
    expect(isPatternProtected('.env')).toBe(true);
  });

  it('matches root-relative .env.local', () => {
    expect(isPatternProtected('.env.local')).toBe(true);
  });

  it('matches root-relative credentials.json', () => {
    expect(isPatternProtected('credentials.json')).toBe(true);
  });

  it('matches root-relative key.pem', () => {
    expect(isPatternProtected('key.pem')).toBe(true);
  });

  it('matches root-relative id_rsa', () => {
    expect(isPatternProtected('id_rsa')).toBe(true);
  });

  it('matches root-relative id_ed25519', () => {
    expect(isPatternProtected('id_ed25519')).toBe(true);
  });
});

describe('requestTouchesProtectedPath', () => {
  it('returns true when any pattern is protected', () => {
    expect(requestTouchesProtectedPath(['/safe/file.ts', '/proj/.env'])).toBe(true);
  });

  it('returns false when no pattern is protected', () => {
    expect(requestTouchesProtectedPath(['/safe/a.ts', '/proj/src/index.ts'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(requestTouchesProtectedPath([])).toBe(false);
  });
});

describe('evaluateApprovalRules — protected path override', () => {
  const NOW = 1_700_000_000_000;

  const context: ApprovalEvaluationContext = {
    sessionID: 'sess-a',
    workspaceRef: 'ws-1',
  };

  function rule(overrides: Partial<ApprovalRule> & Pick<ApprovalRule, 'id' | 'name' | 'action'>): ApprovalRule {
    return {
      scope: 'global',
      matcher: { type: 'glob', field: 'patterns', patterns: ['**'] },
      priority: 100,
      enabled: true,
      createdBy: 'test',
      createdAt: NOW,
      updatedAt: NOW,
      tags: [],
      ...overrides,
    };
  }

  it('hard-denies request touching .env even with an allow rule', () => {
    const request: ChislPermissionRequest = {
      id: 'req-1',
      sessionID: 'sess-a',
      permission: 'read',
      patterns: ['/proj/.env'],
      tool: 'read',
    };

    const result = evaluateApprovalRules(
      [rule({ id: 'allow-all', name: 'allow all', action: 'allow' })],
      request,
      context,
      NOW
    );

    expect(result.decision).toBe('deny');
    expect(result.action).toBe('deny');
    expect(result.rule).toBeNull();
    expect(result.reason).toBe('Protected path; access cannot be granted');
  });

  it('hard-denies request touching *.pem even with a high-priority allow', () => {
    const request: ChislPermissionRequest = {
      id: 'req-2',
      sessionID: 'sess-a',
      permission: 'read',
      patterns: ['/secrets/cert.pem'],
      tool: 'read',
    };

    const result = evaluateApprovalRules(
      [rule({ id: 'super-allow', name: 'super allow', action: 'allow', priority: 999 })],
      request,
      context,
      NOW
    );

    expect(result.decision).toBe('deny');
    expect(result.rule).toBeNull();
  });

  it('allows normal paths when no protected path is touched', () => {
    const request: ChislPermissionRequest = {
      id: 'req-3',
      sessionID: 'sess-a',
      permission: 'read',
      patterns: ['/proj/src/index.ts'],
      tool: 'read',
    };

    const result = evaluateApprovalRules(
      [rule({ id: 'allow-all', name: 'allow all', action: 'allow' })],
      request,
      context,
      NOW
    );

    expect(result.decision).toBe('allow');
  });
});

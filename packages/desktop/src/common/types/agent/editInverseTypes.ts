/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents an edit inverse stored for a tool call.
 * Corresponds to the `edit_inverses` table in AionCore.
 */
export interface EditInverse {
  /** The OpenCode tool call ID that produced this edit */
  tool_call_id: string;
  /** Conversation ID this edit belongs to */
  conversation_id: string;
  /** File path that was edited */
  file_path: string;
  /** The unified diff patch that was applied */
  patch: string;
  /** The inverse patch that can revert this edit */
  inverse_patch: string;
  /** Git base hash at time of edit (placeholder "HEAD" when unavailable) */
  base_hash: string;
  /** Creation timestamp in milliseconds */
  created_at: number;
}

/**
 * Request to revert a single hunk within an edit inverse.
 */
export interface RevertHunkRequest {
  conversation_id: string;
  tool_call_id: string;
  hunk_index: number;
}

/**
 * Response from reverting a single hunk.
 */
export interface RevertHunkResponse {
  success: boolean;
  reverted_hunk_index: number;
  remaining_hunks: number;
}

/**
 * Request to revert an entire file's changes from an edit inverse.
 */
export interface RevertFileRequest {
  conversation_id: string;
  tool_call_id: string;
}

/**
 * Response from reverting an entire file.
 */
export interface RevertFileResponse {
  success: boolean;
  file_path: string;
}

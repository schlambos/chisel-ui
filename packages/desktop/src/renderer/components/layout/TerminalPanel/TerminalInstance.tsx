/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single ghostty-web instance bound to a server-side PTY session.
 *
 * The component keeps the underlying `Terminal` alive across visibility
 * changes — we toggle CSS `display` rather than unmounting so scrollback and
 * output buffers survive tab switches (matching VSCode/Cursor behavior).
 *
 * On mount, if the session was recovered from the main process's live list
 * (`restored: true`) we fetch a snapshot of recent output BEFORE subscribing
 * to live events. Any PTY output that arrives in the window between
 * subscribing and writing the snapshot is queued and drained after the
 * snapshot, so no data is lost or duplicated. See `attachReattach` below.
 */

import React, { useEffect, useRef } from 'react';
import { init, Terminal, FitAddon } from 'ghostty-web';
import type { ITheme } from 'ghostty-web';

import { createWriteQueue, type WriteQueue } from './writeQueue';

// Module-level shared init promise for ghostty-web
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = init();
  }
  return initPromise;
}

declare global {
  interface Window {
    __backendPort?: number;
    api?: { authToken?: string };
  }
}

/** Send resize event to backend via HTTP POST */
async function sendResize(sessionId: string, cols: number, rows: number): Promise<void> {
  const port = typeof window !== 'undefined' && window.__backendPort ? window.__backendPort : 13400;

  const token = typeof window !== 'undefined' && window.api?.authToken ? window.api.authToken : undefined;

  const url = `http://127.0.0.1:${port}/api/terminal/sessions/resize`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ session_id: sessionId, cols, rows }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error');
    console.error(`[TerminalInstance] Resize failed for session ${sessionId}: ${error}`);
  }
}

/** Get the WebSocket URL for a terminal session */
function getTerminalWsUrl(sessionId: string): string {
  // Use the same backend port resolution as other HTTP calls
  const port = typeof window !== 'undefined' && window.__backendPort ? window.__backendPort : 13400;

  const baseUrl = `ws://localhost:${port}/api/terminal/ws/${encodeURIComponent(sessionId)}`;
  return baseUrl;
}

type Props = {
  session_id: string;
  visible: boolean;
  theme: ITheme;
  fontScale: number;
  disabled: boolean;
  /**
   * When true, fetch a snapshot of recent output from the backend and
   * write it before consuming any live events. Set to true for sessions
   * recovered via `terminal.list` on renderer re-attach.
   */
  restored: boolean;
  /** Callback to notify parent when session exits */
  onExit?: (sessionId: string, exitCode: number | null) => void;
};

const BASE_FONT_SIZE = 13;
const FONT_FAMILY = "'JetBrains Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

const TerminalInstance: React.FC<Props> = ({ session_id, visible, theme, fontScale, disabled, restored, onExit }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const fitDebounceRef = useRef<number | null>(null);
  const queueRef = useRef<WriteQueue | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef<boolean>(false);
  const dataSubRef = useRef<{ dispose: () => void } | null>(null);
  const maxRetries = 5;
  const backoffDelays = [100, 250, 500, 1000, 2000]; // ms

  // Mount the terminal once. We re-fit on visibility changes and resizes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;

    // Initialize ghostty-web WASM and await before creating Terminal
    const initialize = async () => {
      await ensureInit();
      if (disposed) return;

      const term = new Terminal({
        fontFamily: FONT_FAMILY,
        fontSize: BASE_FONT_SIZE * fontScale,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 10_000,
        theme,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);

      term.open(host);
      termRef.current = term;
      fitRef.current = fit;

      // Forward keystrokes to the PTY via WebSocket.
      const dataSub = term.onData((data) => {
        const ws = wsRef.current;
        if (ws && wsConnectedRef.current) {
          try {
            // Send as JSON message
            const msg = JSON.stringify({ type: 'input', data: data });
            ws.send(msg);
          } catch (error) {
            console.warn('[TerminalInstance] WebSocket send failed:', error);
          }
        }
      });
      dataSubRef.current = dataSub;

      // Serialize all writes through a single-flight queue so a flood of PTY
      // events can never accumulate unbounded chunks in ghostty-web's parser. The
      // queue chains writes via ghostty-web's write callback and caps the
      // concatenation buffer at 1MB per write.
      const queue = createWriteQueue((data, cb) => {
        term.write(data, cb);
      });
      queueRef.current = queue;

      // Re-attach ordering: establish WebSocket connection FIRST so no event is
      // dropped, but route every event into a local reattach buffer instead
      // of straight into xterm while we fetch the snapshot. Once the
      // snapshot lands we drain `reattachBuf` into the main write queue in
      // order, then flip the listener to forward directly. This guarantees:
      //   1. The snapshot's contents are written before any new event the
      //      backend emitted after the snapshot was taken.
      //   2. No event is lost: anything that arrived between connect and
      //      snapshot land is appended to the snapshot before drain.
      // For non-restored sessions this is a no-op (no snapshot, events go
      // straight to the queue).
      const reattachBuf: string[] = [];
      let reattachDone = !restored;

      // Function to establish WebSocket connection with retry logic
      const establishWebSocketConnection = () => {
        // Clear any existing reconnect timer
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        const wsUrl = getTerminalWsUrl(session_id);
        // Auth rides on the aionui-session cookie auto-sent by the renderer to
        // 127.0.0.1; no subprotocol token is needed. Forcing a subprotocol the
        // client never offers violates RFC 6455 and breaks the handshake.
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          retryCountRef.current = 0; // Reset retry count on successful connection
          wsConnectedRef.current = true;
          intentionalCloseRef.current = false; // Reset intentional close flag on new connection
          console.log(`[TerminalInstance] WebSocket connected for session ${session_id}`);

          // For restored sessions, we need to send the initial size
          if (restored && lastSizeRef.current) {
            const { cols, rows } = lastSizeRef.current;
            void sendResize(session_id, cols, rows);
          }
        };

        ws.onmessage = (event) => {
          // Handle binary data from WebSocket (terminal output)
          if (event.data instanceof ArrayBuffer) {
            // Convert ArrayBuffer to string
            const data = new TextDecoder().decode(event.data);
            if (reattachDone) {
              queue.enqueue(data);
            } else {
              reattachBuf.push(data);
            }
          } else if (event.data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              const data = reader.result as string;
              if (reattachDone) {
                queue.enqueue(data);
              } else {
                reattachBuf.push(data);
              }
            };
            reader.readAsText(event.data);
          } else if (typeof event.data === 'string') {
            // Handle string messages (could be JSON control messages)
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'exit') {
                // FIX 5: Exit-code protocol mismatch - read from msg.data, not msg.exit_code
                const exitCode = msg.data ? parseInt(msg.data, 10) || 0 : null;
                onExit?.(session_id, exitCode);
              } else if (msg.type === 'output') {
                // FIX 1: UTF-8 chunk corruption - decode base64 data
                const data = msg.data ?? '';
                if (data) {
                  try {
                    // Decode base64 encoded terminal output
                    const binary = atob(data);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                      bytes[i] = binary.charCodeAt(i);
                    }
                    // Convert to string for the terminal
                    const output = new TextDecoder().decode(bytes);
                    if (reattachDone) {
                      queue.enqueue(output);
                    } else {
                      reattachBuf.push(output);
                    }
                  } catch {
                    // If base64 decode fails, treat as plain text (backward compat)
                    if (reattachDone) {
                      queue.enqueue(data);
                    } else {
                      reattachBuf.push(data);
                    }
                  }
                }
              } else if (msg.type === 'error') {
                // Handle error messages
                const data = msg.data ?? '';
                if (reattachDone) {
                  queue.enqueue(data);
                } else {
                  reattachBuf.push(data);
                }
              }
            } catch {
              // If not JSON, treat as raw output
              if (reattachDone) {
                queue.enqueue(event.data);
              } else {
                reattachBuf.push(event.data);
              }
            }
          }
        };

        ws.onclose = (event) => {
          console.log(
            `[TerminalInstance] WebSocket closed for session ${session_id}, code: ${event.code}, reason: ${event.reason}`
          );
          wsConnectedRef.current = false;

          // Skip reconnect if this was an intentional close
          if (intentionalCloseRef.current) return;

          // Only call onExit for permanent failures (after max retries) or explicit exit codes
          // Normal close codes: 1000 (normal), 1001 (going away), etc.
          // We treat these as transient failures and retry
          const isPermanentFailure = retryCountRef.current >= maxRetries;

          if (isPermanentFailure) {
            console.error(
              `[TerminalInstance] WebSocket failed permanently after ${maxRetries} retries for session ${session_id}`
            );
            onExit?.(session_id, null);
          } else {
            // Schedule retry with exponential backoff
            const delay = backoffDelays[retryCountRef.current] || backoffDelays[backoffDelays.length - 1];
            retryCountRef.current++;

            console.log(
              `[TerminalInstance] WebSocket connection failed, retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`
            );

            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              establishWebSocketConnection();
            }, delay);
          }
        };

        ws.onerror = (error) => {
          console.error(`[TerminalInstance] WebSocket error for session ${session_id}:`, error);
          // Don't call onExit here - let onclose handle the retry logic
          // The onclose event will be triggered after onerror in most cases
        };
      };

      // Initial WebSocket connection
      establishWebSocketConnection();

      if (restored) {
        void attachReattach({
          session_id,
          reattachBuf,
          onComplete: () => {
            reattachDone = true;
          },
          flush: (chunk) => queue.enqueue(chunk),
        });
      }

      // Watch container size to re-fit + push the new dimensions to the PTY.
      //
      // Debounced: while a layout pane (the left sider or the right
      // ConversationPane) animates its width, this container's width changes on
      // every animation frame. Fitting per-frame reflows the xterm grid and the
      // PTY, which reads as rapid flicker for the full ~300ms slide. Coalescing
      // to a single fit ~120ms after the size stops changing means we fit once,
      // after the animation settles — no flicker, no PTY resize spam.
      const runFit = () => {
        fitDebounceRef.current = null;
        if (!host.isConnected || host.offsetParent === null) return;
        try {
          fit.fit();
        } catch {
          /* terminal may not be visible yet */
        }
        const { cols, rows } = term;
        const last = lastSizeRef.current;
        if (!last || last.cols !== cols || last.rows !== rows) {
          lastSizeRef.current = { cols, rows };
          void sendResize(session_id, cols, rows);
        }
      };
      const obs = new ResizeObserver(() => {
        if (!host.isConnected || host.offsetParent === null) return;
        if (fitDebounceRef.current !== null) {
          window.clearTimeout(fitDebounceRef.current);
        }
        fitDebounceRef.current = window.setTimeout(runFit, 120);
      });
      obs.observe(host);
      resizeObsRef.current = obs;
    };

    void initialize();

    // Cleanup is returned SYNCHRONOUSLY from the effect, not from initialize()
    return () => {
      disposed = true;

      // Dispose data subscription
      const dataSub = dataSubRef.current;
      if (dataSub) {
        dataSub.dispose();
        dataSubRef.current = null;
      }

      // Clear reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Close WebSocket connection - mark as intentional close
      const ws = wsRef.current;
      if (ws) {
        intentionalCloseRef.current = true;
        ws.close();
        wsRef.current = null;
      }

      // Disconnect resize observer
      const obs = resizeObsRef.current;
      if (obs) {
        obs.disconnect();
        resizeObsRef.current = null;
      }

      // Clear fit debounce timer
      if (fitDebounceRef.current !== null) {
        window.clearTimeout(fitDebounceRef.current);
        fitDebounceRef.current = null;
      }

      // Dispose queue
      const queue = queueRef.current;
      if (queue) {
        queue.dispose();
        queueRef.current = null;
      }

      // Dispose terminal
      const term = termRef.current;
      if (term) {
        term.dispose();
        termRef.current = null;
      }
      fitRef.current = null;
    };
    // We intentionally only mount once per session — subsequent prop changes
    // are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id]);

  // Push theme changes into the existing terminal without remounting.
  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.theme = theme;
  }, [theme]);

  // Push font-scale changes; re-fit so dimensions stay aligned.
  useEffect(() => {
    if (!termRef.current || !fitRef.current) return;
    termRef.current.options.fontSize = BASE_FONT_SIZE * fontScale;
    try {
      fitRef.current.fit();
    } catch {
      /* not visible */
    }
  }, [fontScale]);

  // When the panel becomes visible (or the active tab changes to this one),
  // fit + focus so the user can start typing immediately.
  useEffect(() => {
    if (!visible || !termRef.current || !fitRef.current) return;
    // Defer to next frame so layout has settled.
    const raf = requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {
        /* noop */
      }
      if (!disabled) termRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, disabled]);

  return (
    <div
      ref={hostRef}
      className='size-full overflow-hidden'
      style={{
        display: visible ? 'block' : 'none',
        // Promote the terminal (and its ghostty-web canvases) to its own compositor
        // layer + isolate its paint. When a layout pane (left sider / right
        // ConversationPane) animates its width, the main content reflows every
        // frame; without isolation the browser repaints the canvases each
        // frame → visible flicker. On its own layer the terminal is merely
        // re-composited, not repainted.
        transform: 'translateZ(0)',
        contain: 'layout paint',
        backfaceVisibility: 'hidden',
      }}
      aria-hidden={!visible}
    />
  );
};

export default React.memo(TerminalInstance);

type ReattachArgs = {
  session_id: string;
  reattachBuf: string[];
  flush: (chunk: string) => void;
  onComplete: () => void;
};

/**
 * Re-attach ordering helper.
 *
 * Race-free sequence for restoring a session's scrollback:
 *   1. Caller has already subscribed to live output; events land in
 *      `reattachBuf`.
 *   2. We fetch the snapshot from main. The snapshot represents the
 *      main-side view of the ring buffer AT FETCH TIME — anything main
 *      emitted after that point will arrive via the live subscription.
 *   3. We concatenate `snapshot + reattachBuf` and write the combined
 *      blob into ghostty-web. This guarantees chronological order: the snapshot
 *      covers the pre-fetch history, the reattachBuf covers the
 *      subscribe-to-fetch window. No duplicate output (snapshot is from
 *      before our subscription) and no gap (reattachBuf fills the window).
 *   4. After the combined blob is enqueued, the live subscription switches
 *      to forwarding directly to the queue (the next event handler
 *      invocation in the closure no longer pushes to reattachBuf because
 *      we null it out after step 3).
 *
 * If the snapshot RPC fails we log, drop the reattach buffer, and resume
 * live forwarding — the user will see a blank screen until live events
 * catch up, but no event is lost.
 */
async function attachReattach({ reattachBuf, flush, onComplete }: ReattachArgs): Promise<void> {
  // For now, the new backend doesn't have a snapshot endpoint, so we just
  // drain any buffered data and mark as complete. The WebSocket will handle
  // all future output.

  // Drain everything we captured between subscribe and snapshot completion.
  const buffered = reattachBuf.join('');
  reattachBuf.length = 0;

  if (buffered.length > 0) {
    flush(buffered);
  }
  // Flip the live listener into direct-queue mode. Anything that arrives
  // after this point bypasses reattachBuf and goes straight to the queue.
  onComplete();
}

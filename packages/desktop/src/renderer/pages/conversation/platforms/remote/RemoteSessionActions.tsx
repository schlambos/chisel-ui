/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import AionModal from '@/renderer/components/base/AionModal';
import { getConversationOrNull, refreshConversationCache } from '@/renderer/pages/conversation/utils/conversationCache';
import { findShadowedPaths } from './configShadowDiff';
import { useRemoteMessage } from './useRemoteMessage';
import { iconColors } from '@/renderer/styles/colors';
import { Button, Dropdown, Input, Menu, Message, Modal, Spin, Tag, Tooltip, Typography } from '@arco-design/web-react';
import { Branch, Copy, More, Refresh, ShareTwo, FileText, Setting, LinkCloud } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { emitter } from '@/renderer/utils/emitter';
import { copyText } from '@/renderer/utils/ui/clipboard';
import { dispatchWorkspaceOpenRemoteChangesEvent } from '@/renderer/utils/workspace/workspaceEvents';

/**
 * Remote Session Details Panel - shows attached processes and server details in an overlay
 */
const RemoteSessionDetailsPanel: React.FC<{
  visible: boolean;
  onClose: () => void;
  conversation: TChatConversation;
}> = ({ visible, onClose, conversation }) => {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Array<{ id: string; name: string; protocol?: string }>>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | undefined>();
  const [currentAgentName, setCurrentAgentName] = useState<string | undefined>();
  const [health, setHealth] = useState<Record<string, { healthy: boolean; error?: string; latency_ms?: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || conversation.type !== 'remote') {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchData = async () => {
      const extra = conversation.extra as { remoteAgentId?: string; remote_agent_id?: string } | undefined;
      const remoteAgentId = extra?.remoteAgentId || extra?.remote_agent_id;

      if (!remoteAgentId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const [agent, agentList, healthData] = await Promise.all([
          ipcBridge.remoteAgent.get.invoke({ id: remoteAgentId }),
          ipcBridge.remoteAgent.list.invoke({}),
          ipcBridge.remoteAgent.health.invoke({}),
        ]);

        if (cancelled) return;

        if (agent) {
          setCurrentAgentId(remoteAgentId);
          setCurrentAgentName(agent.name);
        }

        setAgents(agentList || []);
        setHealth(healthData || {});
      } catch {
        // Best effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [visible, conversation.id, conversation.type, conversation.extra]);

  if (!visible) return null;

  const currentHealth = currentAgentId ? health[currentAgentId] : undefined;
  const currentIsHealthy = currentHealth?.healthy;
  const latency = currentHealth?.latency_ms;

  return (
    <AionModal
      visible={visible}
      size='medium'
      header={{
        title: t('conversation.session.remoteSessionDetails', { defaultValue: 'Remote Session Details' }),
        showClose: true,
      }}
      contentStyle={{ padding: '16px 24px' }}
      onCancel={onClose}
      footer={null}
    >
      <div className='flex flex-col gap-16px'>
        {loading ? (
          <div className='flex-center p-40px'>
            <Spin size={24} />
          </div>
        ) : (
          <>
            {/* Server/Agent Information */}
            <div className='flex flex-col gap-12px'>
              <div>
                <Typography.Text className='text-11px text-color-text-3 uppercase tracking-wide'>
                  {t('conversation.session.serverAgent', { defaultValue: 'Server / Agent' })}
                </Typography.Text>
                <div className='mt-4px flex items-center gap-8px'>
                  <Tag size='small' color={currentIsHealthy === false ? 'red' : 'arcoblue'}>
                    <span className='flex items-center gap-4px'>
                      <LinkCloud theme='outline' size='12' />
                      <Typography.Ellipsis className='max-w-[200px]'>{currentAgentName || t('common.unknown')}</Typography.Ellipsis>
                    </span>
                  </Tag>
                  {latency && (
                    <Tag size='small' color='gray'>
                      {latency}ms
                    </Tag>
                  )}
                  {currentHealth?.error && (
                    <Tooltip content={currentHealth.error}>
                      <Tag size='small' color='red'>
                        {t('common.error')}
                      </Tag>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Attached Processes */}
              <div>
                <Typography.Text className='text-11px text-color-text-3 uppercase tracking-wide'>
                  {t('conversation.session.attachedProcesses', { defaultValue: 'Attached Processes' })}
                </Typography.Text>
                <div className='mt-4px'>
                  <BgProcessIndicatorForDetails remoteAgentId={currentAgentId || null} />
                </div>
              </div>

              {/* Available Agents */}
              {agents.length > 0 && (
                <div>
                  <Typography.Text className='text-11px text-color-text-3 uppercase tracking-wide'>
                    {t('conversation.session.availableAgents', { defaultValue: 'Available Agents' })}
                  </Typography.Text>
                  <div className='mt-8px flex flex-wrap gap-6px'>
                    {agents.map((agent) => {
                      const agentHealth = health[agent.id];
                      const isHealthy = agentHealth?.healthy;
                      const isCurrent = agent.id === currentAgentId;
                      return (
                        <Tag
                          key={agent.id}
                          size='small'
                          color={isCurrent ? 'arcoblue' : agentHealth?.healthy === false ? 'red' : 'gray'}
                          className={isCurrent ? 'opacity-100' : 'opacity-80'}
                        >
                          <span className='flex items-center gap-4px'>
                            <span
                              className={`inline-block h-6px w-6px shrink-0 rounded-full ${
                                agentHealth === 'loading'
                                  ? 'bg-[var(--brand)]'
                                  : isHealthy === false
                                  ? 'bg-[rgb(var(--danger-6))]'
                                  : 'bg-[rgb(var(--success-6))]'
                              }`}
                            />
                            <Typography.Ellipsis className='max-w-[140px]'>{agent.name}</Typography.Ellipsis>
                          </span>
                        </Tag>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AionModal>
  );
};

/** Simple indicator for bg processes without the full drawer */
const BgProcessIndicatorForDetails: React.FC<{ remoteAgentId: string | null }> = ({ remoteAgentId }) => {
  const { t } = useTranslation();
  const { running, processCount } = useBgProcessesForDetails(remoteAgentId);

  if (!remoteAgentId) {
    return (
      <Tag size='small' color='gray'>
        {t('conversation.session.noAgent', { defaultValue: 'No agent attached' })}
      </Tag>
    );
  }

  if (running === 0) {
    return (
      <Tag size='small' color='gray'>
        {t('conversation.session.noProcesses', { defaultValue: 'No background processes' })}
      </Tag>
    );
  }

  return (
    <Tag size='small' color='arcoblue'>
      <span className='flex items-center gap-4px'>
        {processCount > 0 && (
          <span className='text-10px'>{processCount}</span>
        )}
        <span>{t('conversation.session.processesRunning', { defaultValue: 'processes running' })}</span>
      </span>
    </Tag>
  );
};

/** Hook for bg processes in details panel */
const useBgProcessesForDetails = (remoteAgentId: string | null) => {
  const [running, setRunning] = useState(0);
  const [processCount, setProcessCount] = useState(0);

  useEffect(() => {
    if (!remoteAgentId) {
      setRunning(0);
      setProcessCount(0);
      return;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const result = await ipcBridge.remoteAgent.processes.invoke({ id: remoteAgentId });
        if (cancelled) return;
        const processes = result?.processes || [];
        setRunning(processes.filter((p: { status: string }) => p.status === 'running').length);
        setProcessCount(processes.length);
      } catch {
        // Best effort
      }
    }, 2000);

    // Initial fetch
    void (async () => {
      try {
        const result = await ipcBridge.remoteAgent.processes.invoke({ id: remoteAgentId });
        if (cancelled) return;
        const processes = result?.processes || [];
        setRunning(processes.filter((p: { status: string }) => p.status === 'running').length);
        setProcessCount(processes.length);
      } catch {
        // Best effort
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [remoteAgentId]);

  return { running, processCount };
};

/**
 * Session-level OpenCode actions surfaced in the conversation header (M01–M05):
 * fork, summarize/compact, share/unshare, restore reverted, and a file-changes
 * (diff) viewer. OpenCode remote conversations only.
 */
const RemoteSessionActions: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const conversation_id = conversation.id;

  const { running } = useRemoteMessage(conversation_id);

  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | undefined>(undefined);
  const [showSessionDetails, setShowSessionDetails] = useState(false);

  // Count user text messages (position === 'right') from local DB to decide
  // whether Compact should be enabled. Remote sessions may have zero local
  // messages if the user hasn't spoken yet in this conversation.
  const [userMessageCount, setUserMessageCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void ipcBridge.database.getConversationMessages
      .invoke({ conversation_id, page: 0, page_size: 1000 })
      .then((result) => {
        if (cancelled || !result?.items) return;
        const count = result.items.filter((m) => m.type === 'text' && m.position === 'right').length;
        setUserMessageCount(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversation_id]);

  const compactDisabled = userMessageCount === 0 || running;
  const compactTooltip = useMemo(() => {
    if (running)
      return t('conversation.session.compactDisabledRunning', {
        defaultValue: 'Cannot compact while response is in progress',
      });
    if (userMessageCount === 0)
      return t('conversation.session.compactDisabledEmpty', { defaultValue: 'No user messages to compact' });
    return null;
  }, [running, userMessageCount, t]);

  // M19: server global-config editor state.
  const [configOpen, setConfigOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configText, setConfigText] = useState('');
  // Stash of the last server-confirmed config (pretty-printed). Used by the
  // "Revert changes" affordance so a bad edit never has to be reconstructed by
  // hand, and so we always PATCH from a known-good baseline (M19 §6).
  const [lastGoodConfig, setLastGoodConfig] = useState('');
  // M19 (Option A): dotted paths of the last save that were persisted to the
  // global layer but are overridden by a higher-precedence layer (project /
  // agent files), so they won't change behavior. Empty = all edits took effect.
  const [shadowedPaths, setShadowedPaths] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const extra = conversation.extra as { remoteAgentId?: string; remote_agent_id?: string } | undefined;
    const remoteAgentId = extra?.remoteAgentId || extra?.remote_agent_id;
    if (!remoteAgentId) return;
    void ipcBridge.remoteAgent.get.invoke({ id: remoteAgentId }).then((agent) => {
      if (!cancelled) {
        setToolHost(agent?.tool_host ?? 'local');
        setProtocol(agent?.protocol);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversation.extra]);

  const runExclusive = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  // M01: fork the server session and open a new local conversation bound to it.
  const handleFork = () =>
    runExclusive(async () => {
      try {
        const { session_id } = await ipcBridge.conversation.forkRemoteSession.invoke({ conversation_id });
        const id = uuid();
        const source = (await getConversationOrNull(conversation_id)) || conversation;
        const created = await ipcBridge.conversation.createWithConversation.invoke({
          conversation: {
            ...source,
            id,
            name: t('conversation.session.forkName', { name: source.name, defaultValue: `Fork of ${source.name}` }),
            created_at: Date.now(),
            modified_at: Date.now(),
            extra: { ...source.extra, sessionKey: session_id, history_loaded: false },
          } as unknown as TChatConversation,
          preserve_session_key: true,
        });
        void navigate(`/conversation/${created.id}`);
        emitter.emit('chat.history.refresh');
        Message.success(t('conversation.session.forkSuccess', { defaultValue: 'Forked session' }));
      } catch (error) {
        Message.error(t('conversation.session.forkFailed', { defaultValue: 'Failed to fork session' }));
        console.error('[RemoteSessionActions] fork failed:', error);
      }
    });

  // M04/M22: compact the session (V2 with V1 summarize fallback).
  const handleSummarize = () =>
    runExclusive(async () => {
      try {
        Message.info(t('conversation.session.summarizeStarted', { defaultValue: 'Compacting session…' }));
        try {
          await ipcBridge.conversation.compactRemoteSession.invoke({ conversation_id });
        } catch {
          await ipcBridge.conversation.summarizeRemoteSession.invoke({ conversation_id });
        }
        await refreshConversationCache(conversation_id);
        Message.success(
          t('conversation.session.summarizeSuccess', {
            defaultValue: 'Session compacted. Future replies will use the compacted context.',
          })
        );
      } catch (error) {
        Message.error(t('conversation.session.summarizeFailed', { defaultValue: 'Failed to compact' }));
        console.error('[RemoteSessionActions] compact failed:', error);
      }
    });

  // M02: restore all reverted messages. Clear `revert_message_id` so the
  // inactive-region dim/divider in the message list collapses back to the
  // normal state (the dim is gated on both `is_reverted` and a known
  // `revert_message_id`).
  const handleUnrevert = () =>
    runExclusive(async () => {
      try {
        await ipcBridge.conversation.unrevertRemoteSession.invoke({ conversation_id });
        await refreshConversationCache(conversation_id);
        Message.success(t('conversation.session.unrevertSuccess', { defaultValue: 'Restored reverted messages' }));
      } catch (error) {
        Message.error(t('conversation.session.unrevertFailed', { defaultValue: 'Failed to restore messages' }));
        console.error('[RemoteSessionActions] unrevert failed:', error);
      }
    });

  // M03: share / unshare.
  const handleShare = () =>
    runExclusive(async () => {
      try {
        const { url } = await ipcBridge.conversation.shareRemoteSession.invoke({ conversation_id });
        setShareUrl(url);
      } catch (error) {
        Message.error(t('conversation.session.shareFailed', { defaultValue: 'Failed to share session' }));
        console.error('[RemoteSessionActions] share failed:', error);
      }
    });

  const handleUnshare = () =>
    runExclusive(async () => {
      try {
        await ipcBridge.conversation.unshareRemoteSession.invoke({ conversation_id });
        setShareUrl(null);
        Message.success(t('conversation.session.unshareSuccess', { defaultValue: 'Sharing disabled' }));
      } catch (error) {
        Message.error(t('conversation.session.unshareFailed', { defaultValue: 'Failed to unshare' }));
        console.error('[RemoteSessionActions] unshare failed:', error);
      }
    });

  // M05/T18.1: open the Workspace Changes tab with remote session diff source or native VCS.
  const handleViewChanges = () =>
    runExclusive(async () => {
      try {
        const vcsRes = await ipcBridge.conversation.getWorkspaceVcs.invoke({ conversation_id });
        if (vcsRes.mode === 'not-git') {
          Modal.confirm({
            title: t('conversation.workspaceVcs.trackWorkspace', { defaultValue: 'Track this workspace' }),
            content: t('conversation.workspaceVcs.notGitHint', {
              defaultValue: 'This folder is not in git. Track it to see changes.',
            }),
            okText: t('conversation.workspaceVcs.trackWorkspace', { defaultValue: 'Track this workspace' }),
            onOk: async () => {
              try {
                await ipcBridge.conversation.initWorkspaceVcs.invoke({ conversation_id });
                Message.success(t('conversation.workspaceVcs.trackSuccess', { defaultValue: 'Workspace tracked' }));
                dispatchWorkspaceOpenRemoteChangesEvent(conversation_id);
              } catch (err) {
                Message.error(
                  t('conversation.workspaceVcs.trackFailed', { defaultValue: 'Failed to track workspace' })
                );
                console.error('[RemoteSessionActions] initWorkspaceVcs failed:', err);
              }
            },
          });
          return;
        }
        dispatchWorkspaceOpenRemoteChangesEvent(conversation_id);
      } catch (error) {
        Message.error(
          t('conversation.session.diffLocalMode', {
            defaultValue: 'Server diff is unavailable for local tool-host sessions.',
          })
        );
        console.error('[RemoteSessionActions] getWorkspaceVcs failed:', error);
      }
    });

  // M19: load the server's global config into the editor (stashing a known-good
  // baseline). Discards any unsaved local edits.
  const loadConfig = async () => {
    setConfigLoading(true);
    setShadowedPaths([]);
    try {
      const config = await ipcBridge.conversation.getRemoteConfig.invoke({ conversation_id });
      const pretty = JSON.stringify(config ?? {}, null, 2);
      setConfigText(pretty);
      setLastGoodConfig(pretty);
    } catch (error) {
      Message.error(t('conversation.session.configLoadFailed', { defaultValue: 'Failed to load server config' }));
      console.error('[RemoteSessionActions] config load failed:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleOpenConfig = () =>
    runExclusive(async () => {
      setConfigOpen(true);
      await loadConfig();
    });

  // M19: parse the editor JSON and PATCH it (shallow-merged server-side). The
  // server returns the new effective config, which becomes the new baseline.
  const handleSaveConfig = async () => {
    let partial: Record<string, unknown>;
    try {
      partial = JSON.parse(configText) as Record<string, unknown>;
    } catch {
      Message.error(t('conversation.session.configInvalidJson', { defaultValue: 'Config is not valid JSON' }));
      return;
    }
    if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
      Message.error(t('conversation.session.configNotObject', { defaultValue: 'Config must be a JSON object' }));
      return;
    }
    // Baseline (pre-edit) used to compute exactly which paths the user changed.
    let baseline: Record<string, unknown> = {};
    try {
      baseline = JSON.parse(lastGoodConfig) as Record<string, unknown>;
    } catch {
      baseline = {};
    }
    setConfigSaving(true);
    try {
      const next = await ipcBridge.conversation.patchRemoteConfig.invoke({ conversation_id, partial });
      const pretty = JSON.stringify(next ?? {}, null, 2);
      setConfigText(pretty);
      setLastGoodConfig(pretty);
      Message.success(t('conversation.session.configSaved', { defaultValue: 'Server config saved' }));
      // Option A: detect edits shadowed by a higher-precedence config layer.
      // Best-effort — a failed effective-config read must not mask the save.
      try {
        const effective = await ipcBridge.conversation.getRemoteEffectiveConfig.invoke({ conversation_id });
        setShadowedPaths(findShadowedPaths(baseline, partial, effective));
      } catch (effErr) {
        setShadowedPaths([]);
        console.error('[RemoteSessionActions] effective-config read failed:', effErr);
      }
    } catch (error) {
      // The server body (e.g. read-only field rejection) is surfaced verbatim.
      Message.error(t('conversation.session.configSaveFailed', { defaultValue: 'Failed to save server config' }));
      console.error('[RemoteSessionActions] config save failed:', error);
    } finally {
      setConfigSaving(false);
    }
  };

  const isReverted = (conversation.extra as { is_reverted?: boolean })?.is_reverted === true;

  const menu = (
    <Menu
      onClickMenuItem={(key) => {
        switch (key) {
          case 'sessionDetails':
            setShowSessionDetails(true);
            break;
          case 'fork':
            void handleFork();
            break;
          case 'summarize':
            void handleSummarize();
            break;
          case 'changes':
            void handleViewChanges();
            break;
          case 'share':
            void handleShare();
            break;
          case 'unshare':
            void handleUnshare();
            break;
          case 'unrevert':
            void handleUnrevert();
            break;
          case 'config':
            void handleOpenConfig();
            break;
        }
      }}
      >
        <Menu.Item key='sessionDetails'>
          <div className='flex items-center gap-8px'>
            <LinkCloud theme='outline' size='14' fill={iconColors.secondary} />
            <span>{t('conversation.session.remoteSessionDetails', { defaultValue: 'Remote session details' })}</span>
          </div>
        </Menu.Item>
        <Menu.Item key='fork'>
          <div className='flex items-center gap-8px'>
            <Branch theme='outline' size='14' fill={iconColors.secondary} />
            <span>{t('conversation.session.fork', { defaultValue: 'Fork session' })}</span>
          </div>
        </Menu.Item>
      <Menu.Item key='changes'>
        <div className='flex items-center gap-8px'>
          <FileText theme='outline' size='14' fill={iconColors.secondary} />
          <span>{t('conversation.session.viewChanges', { defaultValue: 'View changes' })}</span>
        </div>
      </Menu.Item>
      <Tooltip content={compactTooltip} disabled={!compactDisabled}>
        <Menu.Item key='summarize' disabled={compactDisabled}>
          <div className='flex items-center gap-8px'>
            <Refresh theme='outline' size='14' fill={iconColors.secondary} />
            <span>{t('conversation.session.summarize', { defaultValue: 'Summarize / compact' })}</span>
          </div>
        </Menu.Item>
      </Tooltip>
      {isReverted && (
        <Menu.Item key='unrevert'>
          <div className='flex items-center gap-8px'>
            <Refresh theme='outline' size='14' fill={iconColors.secondary} />
            <span>{t('conversation.session.unrevert', { defaultValue: 'Restore reverted' })}</span>
          </div>
        </Menu.Item>
      )}
      <Menu.Item key='share'>
        <div className='flex items-center gap-8px'>
          <ShareTwo theme='outline' size='14' fill={iconColors.secondary} />
          <span>{t('conversation.session.share', { defaultValue: 'Share session' })}</span>
        </div>
      </Menu.Item>
      <Menu.Item key='unshare'>
        <div className='flex items-center gap-8px'>
          <ShareTwo theme='outline' size='14' fill={iconColors.secondary} />
          <span>{t('conversation.session.unshare', { defaultValue: 'Unshare session' })}</span>
        </div>
      </Menu.Item>
      {protocol === 'opencode' && (
        <Menu.Item key='config'>
          <div className='flex items-center gap-8px'>
            <Setting theme='outline' size='14' fill={iconColors.secondary} />
            <span>{t('conversation.session.serverConfig', { defaultValue: 'Server config' })}</span>
          </div>
        </Menu.Item>
      )}
    </Menu>
  );

  return (
    <>
      <Dropdown droplist={menu} trigger='click' position='br'>
        <Tooltip content={t('conversation.session.actions', { defaultValue: 'Session actions' })}>
          <Button
            size='small'
            shape='circle'
            loading={busy}
            type='secondary'
            icon={<More theme='outline' size='16' fill={iconColors.secondary} />}
          />
        </Tooltip>
      </Dropdown>

      {/* Remote session details panel */}
      <RemoteSessionDetailsPanel
        visible={showSessionDetails}
        onClose={() => setShowSessionDetails(false)}
        conversation={conversation}
      />

      {/* M03: share URL modal */}
      <AionModal
        visible={shareUrl !== null}
        size='small'
        style={{ width: 460, height: 'auto' }}
        header={{ title: t('conversation.session.shareTitle', { defaultValue: 'Session shared' }), showClose: true }}
        contentStyle={{ padding: '20px 24px 0' }}
        onCancel={() => setShareUrl(null)}
        footer={{
          render: () => (
            <div className='flex justify-end gap-10px pt-20px'>
              <Button
                className='px-20px min-w-80px'
                style={{ borderRadius: 'var(--radius-control)' }}
                onClick={() => setShareUrl(null)}
              >
                {t('common.close', { defaultValue: 'Close' })}
              </Button>
              <Button
                type='primary'
                className='px-20px min-w-80px'
                style={{ borderRadius: 'var(--radius-control)' }}
                onClick={() => {
                  if (shareUrl) {
                    void copyText(shareUrl).then(() => Message.success(t('messages.copySuccess')));
                  }
                }}
              >
                <span className='flex items-center gap-6px'>
                  <Copy theme='outline' size='14' />
                  {t('common.copy', { defaultValue: 'Copy' })}
                </span>
              </Button>
            </div>
          ),
        }}
      >
        <div className='flex flex-col gap-10px'>
          <div className='text-13px text-t-secondary leading-20px'>
            {t('conversation.session.shareHint', {
              defaultValue: 'Anyone with this link on the server network can view this conversation.',
            })}
          </div>
          <Input readOnly value={shareUrl ?? ''} />
        </div>
      </AionModal>

      {/* M19: server global-config editor */}
      <AionModal
        visible={configOpen}
        size='medium'
        header={{
          title: t('conversation.session.serverConfigTitle', { defaultValue: 'Server config' }),
          showClose: true,
        }}
        contentStyle={{ padding: '16px 24px' }}
        onCancel={() => setConfigOpen(false)}
        footer={{
          render: () => (
            <div className='flex items-center justify-between pt-16px'>
              <Button type='text' disabled={configLoading || configSaving} onClick={() => void loadConfig()}>
                <span className='flex items-center gap-6px'>
                  <Refresh theme='outline' size='14' />
                  {t('conversation.session.configReload', { defaultValue: 'Reload' })}
                </span>
              </Button>
              <div className='flex gap-10px'>
                <Button
                  className='px-20px min-w-80px'
                  style={{ borderRadius: 'var(--radius-control)' }}
                  disabled={configSaving || configText === lastGoodConfig}
                  onClick={() => {
                    setConfigText(lastGoodConfig);
                    setShadowedPaths([]);
                  }}
                >
                  {t('conversation.session.configRevert', { defaultValue: 'Revert changes' })}
                </Button>
                <Button
                  type='primary'
                  className='px-20px min-w-80px'
                  style={{ borderRadius: 'var(--radius-control)' }}
                  loading={configSaving}
                  disabled={configLoading || configText === lastGoodConfig}
                  onClick={() => void handleSaveConfig()}
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </Button>
              </div>
            </div>
          ),
        }}
      >
        <div className='flex flex-col gap-10px'>
          <div className='text-12px text-t-secondary leading-18px'>
            {t('conversation.session.configRestartHint', {
              defaultValue:
                'Edits are shallow-merged into the server config. Some changes (e.g. model defaults) may require restarting the OpenCode server to take effect.',
            })}
          </div>
          {shadowedPaths.length > 0 && (
            <div
              className='flex flex-col gap-4px rounded-8px px-12px py-10px text-12px leading-18px'
              style={{ background: 'rgb(var(--warning-1))', border: '1px solid rgb(var(--warning-3))' }}
            >
              <span className='font-medium text-[rgb(var(--warning-6))]'>
                {t('conversation.session.configShadowedTitle', {
                  defaultValue: 'Saved, but overridden by a higher-precedence config — these will NOT take effect:',
                })}
              </span>
              <ul className='m-0 pl-16px'>
                {shadowedPaths.map((p) => (
                  <li key={p} className='font-mono text-t-primary'>
                    {p}
                  </li>
                ))}
              </ul>
              <span className='text-t-secondary'>
                {t('conversation.session.configShadowedHint', {
                  defaultValue:
                    'A project-level opencode.json or an agent file defines these. Edit them at that layer (and restart the OpenCode server) for changes to apply.',
                })}
              </span>
            </div>
          )}
          {configLoading ? (
            <div className='text-13px text-t-secondary py-20px text-center'>
              {t('common.loading', { defaultValue: 'Loading…' })}
            </div>
          ) : (
            <Input.TextArea
              value={configText}
              onChange={(v) => {
                setConfigText(v);
                if (shadowedPaths.length > 0) setShadowedPaths([]);
              }}
              autoSize={{ minRows: 14, maxRows: 24 }}
              spellCheck={false}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
            />
          )}
        </div>
      </AionModal>
    </>
  );
};

export default RemoteSessionActions;

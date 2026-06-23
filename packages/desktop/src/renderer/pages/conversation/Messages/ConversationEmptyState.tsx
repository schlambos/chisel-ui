import React from 'react';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/renderer/components/base/feedback/EmptyState';
import styles from './ConversationEmptyState.module.css';

const ConversationEmptyState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.root} data-testid='conversation-empty-state'>
      <div className={styles.backdrop} data-testid='conversation-empty-state-backdrop' aria-hidden='true' />
      <div className={`${styles.content} flex-center`}>
        <EmptyState title={t('conversation.emptyState', 'Start a conversation...')} />
      </div>
    </div>
  );
};

export default ConversationEmptyState;

import { Spin } from '@arco-design/web-react';
import React from 'react';
import brandWordmark from '@renderer/assets/logos/brand/wordmark.png';

const TAGLINE = 'Chisl — shape your agents.';

const AppLoader: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        minHeight: '100vh',
      }}
    >
      <img
        src={brandWordmark}
        alt='Chisl'
        draggable={false}
        style={{ width: 'min(240px, 68%)', height: 'auto', objectFit: 'contain', userSelect: 'none' }}
      />
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>{TAGLINE}</div>
      <Spin dot />
    </div>
  );
};

export default AppLoader;
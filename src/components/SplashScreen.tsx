import React from 'react';
import { motion } from 'motion/react';
import { APP_ASSETS } from '../types/igmeet';

export const SplashScreen: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-primary)] p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-5"
      >
        <div className="w-24 h-24 rounded-[28px] overflow-hidden shadow-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <img
            src={APP_ASSETS.logo}
            alt="IG Meet"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-center space-y-1.5">
          <h1 className="text-3xl font-extrabold font-display tracking-tight">IG Meet</h1>
          <p className="text-sm text-[var(--text-secondary)]">Real-time social messaging</p>
        </div>
        <div className="w-32 h-1 rounded-full bg-[var(--bg-surface-tonal)] overflow-hidden mt-2">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            className="w-1/2 h-full rounded-full bg-[var(--accent-primary)]"
          />
        </div>
      </motion.div>
    </div>
  );
};

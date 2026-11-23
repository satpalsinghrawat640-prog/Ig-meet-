import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { getContrastTextColor } from '../types/igmeet';

interface AvatarProps {
  name: string;
  photoURL?: string;
  profileColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  showRing?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const DOT_MAP = {
  xs: 'w-2.5 h-2.5 border-[1.5px]',
  sm: 'w-3 h-3 border-2',
  md: 'w-3.5 h-3.5 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-4 h-4 border-2',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  photoURL,
  profileColor = '#E11D6C',
  size = 'md',
  online = false,
  showRing = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const contrastColor = getContrastTextColor(profileColor);
  const hasPhoto = Boolean(photoURL && !imgError);

  return (
    <div
      className={`relative shrink-0 inline-flex items-center justify-center rounded-full ${className}`}
      style={
        showRing
          ? {
              padding: '2.5px',
              background: `linear-gradient(135deg, ${profileColor}, var(--accent-primary))`,
            }
          : undefined
      }
    >
      <div
        className={`${SIZE_MAP[size]} rounded-full overflow-hidden flex items-center justify-center font-display font-bold select-none ${
          showRing ? 'ring-2 ring-[var(--bg-surface)]' : ''
        }`}
        style={{
          backgroundColor: hasPhoto ? 'var(--bg-surface-tonal)' : profileColor,
          color: contrastColor,
        }}
      >
        {hasPhoto ? (
          <img
            src={photoURL}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials || '?'}</span>
        )}
      </div>

      {online && (
        <span
          aria-label="Online"
          className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 border-[var(--bg-surface)] ${DOT_MAP[size]}`}
        />
      )}
    </div>
  );
};

export const VerifiedTick: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'sm' }) => {
  const dims =
    size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const iconDims =
    size === 'lg' ? 'w-3 h-3' : size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  return (
    <span
      title="Verified IG Meet Subscriber"
      aria-label="Verified"
      className={`${dims} inline-flex items-center justify-center rounded-full shrink-0 text-white`}
      style={{ backgroundColor: 'var(--verified-blue)' }}
    >
      <Check className={`${iconDims} stroke-[3]`} />
    </span>
  );
};

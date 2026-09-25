// ============================================================
// components/Toast.js — Toast notification per eventi real-time
// ============================================================
import { useState, useEffect } from 'react';

export default function Toast({ message, type = 'info', duration = 4000, onClose, offset = 0 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 300); // Wait for fade-out
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-400'
  };

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  // Calculate offset for stacking multiple toasts
  const toastTop = 4 + offset;
  const toastRight = 4 + offset;

  return (
    <div
      className={`
        fixed top-[${toastTop}px] right-[${toastRight}px] z-50 px-4 py-3 rounded-xl border backdrop-blur-sm
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}
        ${typeStyles[type] || typeStyles.info}
      `}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{icons[type] || icons.info}</span>
        <span className="text-sm font-medium text-textMain">{message}</span>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Icon';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    setTheme(next);
  };

  return (
    <button type="button" onClick={flip} className="inline-flex items-center gap-2 hover:text-on-dark" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      {theme === 'dark' ? 'Light theme' : 'Dark theme'}
    </button>
  );
}

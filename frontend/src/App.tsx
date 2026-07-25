import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { CelebrationOverlay } from '@/components/layout/CelebrationOverlay';
import { HomePage } from '@/pages/HomePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AchievementsPage } from '@/pages/AchievementsPage';
import { useAuthStore } from '@/store/useAuthStore';
import { useTelegramLogin } from '@/hooks/useAuth';
import { getInitData } from '@/lib/telegram';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const login = useTelegramLogin();

  useEffect(() => {
    if (!user) {
      login.mutate(getInitData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-8 text-center">
        <p className="font-display text-3xl uppercase tracking-[0.18em]">LifeStreak</p>
        <span aria-hidden className="mt-3 h-px w-16 bg-ink" />
        <p className="mt-3 font-mono text-micro uppercase text-graphite">
          {login.isError ? 'Вход не выполнен' : 'Открываю журнал'}
        </p>
        {login.isError && (
          <p className="mt-4 max-w-xs text-sm leading-snug text-graphite">
            Запусти приложение внутри Telegram — вход выполняется через твой аккаунт.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      <BottomNav />
      <CelebrationOverlay />
    </>
  );
}

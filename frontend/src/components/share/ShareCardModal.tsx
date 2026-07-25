import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShareCard } from './ShareCard';
import type { Streak } from '@/types/api';
import { shareToTelegram } from '@/lib/telegram';

interface ShareCardModalProps {
  streak: Streak | null;
  onOpenChange: (open: boolean) => void;
}

export function ShareCardModal({ streak, onOpenChange }: ShareCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  async function generateImage(): Promise<string | null> {
    if (!cardRef.current) return null;
    setGenerating(true);
    try {
      return await toPng(cardRef.current, { pixelRatio: 2 });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    const dataUrl = await generateImage();
    if (!dataUrl || !streak) return;
    const link = document.createElement('a');
    link.download = `lifestreak-${streak.title}.png`;
    link.href = dataUrl;
    link.click();
  }

  function handleShare() {
    if (!streak) return;
    shareToTelegram(
      `${streak.icon} ${streak.title} — ${streak.currentCount} дней подряд в LifeStreak.`,
    );
  }

  return (
    <Dialog open={Boolean(streak)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Вырезка</DialogTitle>
        <div className="mt-4">{streak && <ShareCard ref={cardRef} streak={streak} />}</div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" disabled={generating} onClick={handleDownload}>
            {generating ? 'Готовлю…' : 'Сохранить'}
          </Button>
          <Button className="flex-1" onClick={handleShare}>
            В Telegram
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

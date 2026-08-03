import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

/**
 * A proof photo at full size.
 *
 * The card shows it small, which is enough to see that something was posted
 * and not enough to read a commit hash or a receipt. This is where the detail
 * lives, so the two jobs it has are to use the whole screen and to let the
 * picture be enlarged past it: pinch on a phone, tap for one-to-one anywhere
 * else. Everything else on screen gets out of the way.
 */
export function ProofViewer({
  src,
  caption,
  open,
  onOpenChange,
}: {
  src: string;
  caption: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoomed, setZoomed] = useState(false);

  // Reopening should start fitted again, or the next photo lands mid-zoom on
  // whatever corner the last one was left at.
  useEffect(() => {
    if (!open) setZoomed(false);
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Opaque, not near-opaque: at 95% the tab bar reads through the bottom
            of the screen and collides with the caption. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-ink" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[60] flex flex-col outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">{caption}</DialogPrimitive.Title>

          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate font-mono text-micro uppercase text-paper/70">
              {caption}
            </span>
            <DialogPrimitive.Close
              className="shrink-0 font-mono text-micro uppercase tracking-[0.1em] text-paper/70 transition-colors hover:text-paper"
              aria-label="Закрыть"
            >
              Закрыть
            </DialogPrimitive.Close>
          </div>

          {/* Tapping the surround closes; tapping the photo zooms. `touch-action`
              is what hands pinching back to the browser inside a dialog. */}
          <div
            onClick={() => onOpenChange(false)}
            // items-start, not the default stretch: a stretched flex item has
            // its height forced to the container's, which squashes the photo
            // out of its own proportions.
            className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-2"
            style={{ touchAction: 'pinch-zoom' }}
          >
            <img
              src={src}
              alt={caption}
              onClick={(event) => {
                event.stopPropagation();
                setZoomed((v) => !v);
              }}
              className={cn(
                'h-auto select-none',
                // Fit to width and scroll, rather than fit the whole thing on
                // screen. A tall screenshot is four times taller than a phone,
                // and making all of it visible at once turns it into a 174px
                // strip — which is exactly the detail this window exists to
                // show. Width is the dimension worth spending the screen on.
                // shrink-0 or the flex row squeezes the enlarged photo straight
                // back down to the width of the screen.
                zoomed ? 'max-w-none shrink-0 cursor-zoom-out' : 'w-full max-w-3xl cursor-zoom-in',
              )}
            />
          </div>

          <p className="shrink-0 px-4 pb-4 pt-1 text-center font-mono text-micro uppercase text-paper/45">
            {zoomed ? 'нажми, чтобы вписать' : 'нажми на фото — крупнее'}
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

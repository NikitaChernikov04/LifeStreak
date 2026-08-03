import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  useAttachProof,
  useCheckinGoal,
  useCompleteGoal,
  useJoinGoal,
  useLeaveGoal,
} from '@/hooks/useSocial';
import { useProofImage } from '@/hooks/useProofImage';
import { compressImage, formatBytes, type CompressedImage } from '@/lib/image';
import { formatDayMark } from '@/lib/streak';
import { cn } from '@/lib/utils';
import type { GoalProof, GroupGoal, VersusView } from '@/types/api';

/**
 * A bet two friends made, scored in sprints.
 *
 * The card answers "who is ahead" with a count of sprints and never with a
 * running total of days. A total is unwinnable the moment a real gap opens,
 * which leaves the person behind watching the rest of the distance go by; a
 * sprint restarts, so being four down is still a thing you can answer.
 */
export function VersusCard({ goal }: { goal: GroupGoal }) {
  const [confirming, setConfirming] = useState<'leave' | 'complete' | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [photo, setPhoto] = useState<CompressedImage | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [squeezing, setSqueezing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const checkin = useCheckinGoal();
  const attach = useAttachProof();
  const complete = useCompleteGoal();
  const join = useJoinGoal();
  const leave = useLeaveGoal();

  const versus = goal.versus;
  if (!versus) return null;

  const invited = goal.myStatus === 'INVITED';
  const done = goal.status === 'COMPLETED' || versus.over;
  const progress = Math.min(100, (versus.sprintNumber / versus.sprintCount) * 100);
  const busy = checkin.isPending || attach.isPending || squeezing;

  function dropPhoto() {
    setPhoto(null);
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileInput.current) fileInput.current.value = '';
  }

  /**
   * The photo is shrunk here, in the browser, before anything is sent. A
   * picture straight off a camera is several megabytes — slow on a phone
   * network and far more than a card needs.
   */
  async function pickPhoto(file: File) {
    setPhotoError(null);
    setSqueezing(true);
    try {
      const compressed = await compressImage(file);
      dropPhoto();
      setPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed.blob));
    } catch {
      setPhotoError('Не получилось прочитать этот файл');
    } finally {
      setSqueezing(false);
    }
  }

  async function upload() {
    if (!photo) return;
    const extension = photo.blob.type === 'image/webp' ? 'webp' : 'jpg';
    await attach.mutateAsync({
      goalId: goal.id,
      blob: photo.blob,
      filename: `proof.${extension}`,
    });
    dropPhoto();
  }

  const mark = async () => {
    await checkin.mutateAsync({
      goal,
      proofNote: note.trim() || undefined,
      proofUrl: url.trim() || undefined,
    });
    // Only after the day is recorded, so a failed upload never costs the mark.
    await upload();
    setNote('');
    setUrl('');
    setProofOpen(false);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3 border-b border-ink/15 py-4"
    >
      <div
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center border text-lg"
        style={{ borderColor: goal.color, backgroundColor: `${goal.color}1F` }}
      >
        {goal.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-lg uppercase leading-tight tracking-[0.05em]">
            {goal.title}
          </h3>

          {done ? (
            <span className="chip mt-0.5 shrink-0 border-ochre text-ochre">✓ Спор закрыт</span>
          ) : invited ? (
            <Button
              size="sm"
              className="mt-0.5 shrink-0"
              disabled={join.isPending}
              onClick={() => join.mutate(goal.id)}
            >
              Спорим
            </Button>
          ) : goal.markedToday ? (
            <span className="chip mt-0.5 shrink-0">✓ День отмечен</span>
          ) : (
            <Button size="sm" className="mt-0.5 shrink-0" disabled={busy} onClick={mark}>
              {squeezing ? 'Сжимаю…' : 'Отметить день'}
            </Button>
          )}
        </div>

        <p className="mt-0.5 font-mono text-micro uppercase text-graphite">
          спор · спринт <span className="figure">{versus.sprintNumber}</span> из{' '}
          {versus.sprintCount}
          {!done && (
            <>
              {' · '}день <span className="figure">{versus.dayInSprint}</span> из{' '}
              {versus.sprintDays}
            </>
          )}
        </p>

        {/* Sprints, not days: the same unit the score is kept in. */}
        <div className="mt-3 h-2 w-full border border-ink/25">
          <div
            className="h-full"
            style={{ width: `${progress}%`, backgroundColor: done ? undefined : goal.color }}
          />
        </div>

        {!invited && <Standings versus={versus} />}

        {invited && (
          <p className="mt-2 text-[0.8125rem] leading-snug text-graphite">
            Тебя зовут спорить. Каждый считает свои дни, счёт идёт по спринтам — отстать можно, но
            не насовсем.
          </p>
        )}

        {!invited && versus.proofs.length > 0 && <Proofs goalId={goal.id} versus={versus} />}

        {/* The evidence field, opened by hand. It is never a gate: the button
            above marks the day whether or not anything is filled in here. */}
        {!done && !invited && goal.myStatus === 'JOINED' && (
          <div className="mt-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pickPhoto(file);
              }}
            />

            {proofOpen || goal.markedToday ? (
              <div className="border border-dashed border-ink/30 p-2.5">
                {!goal.markedToday && (
                  <>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={280}
                      placeholder="Что именно сделал"
                      className="w-full border-b border-ink/20 bg-transparent pb-1 text-[0.875rem] outline-none placeholder:text-graphite/70"
                    />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      maxLength={500}
                      inputMode="url"
                      placeholder="Ссылка на скрин или коммит"
                      className="mt-2 w-full border-b border-ink/20 bg-transparent pb-1 font-mono text-[0.75rem] outline-none placeholder:text-graphite/70"
                    />
                  </>
                )}

                {photoPreview && photo ? (
                  <div className="mt-2">
                    <img
                      src={photoPreview}
                      alt="Выбранный пруф"
                      className="max-h-40 w-full border border-ink/20 object-contain"
                    />
                    {/* Said out loud, because the file that leaves the phone is
                        not the file that was picked. */}
                    <p className="mt-1 font-mono text-micro uppercase text-graphite">
                      {formatBytes(photo.originalBytes)} → {formatBytes(photo.blob.size)} ·{' '}
                      {photo.width}×{photo.height}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 font-mono text-micro uppercase">
                      <button
                        onClick={() => fileInput.current?.click()}
                        className="text-graphite underline underline-offset-2 hover:text-ink"
                      >
                        другое фото
                      </button>
                      <button
                        onClick={dropPhoto}
                        className="text-vermilion underline underline-offset-2"
                      >
                        убрать
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInput.current?.click()}
                    disabled={squeezing}
                    className="mt-2 font-mono text-micro uppercase text-graphite underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {squeezing ? 'сжимаю…' : '+ фото или скрин'}
                  </button>
                )}

                {photoError && (
                  <p className="mt-1 font-mono text-micro uppercase text-vermilion">{photoError}</p>
                )}

                <p className="mt-2 font-mono text-micro uppercase leading-relaxed text-graphite">
                  видят только те, кто в споре. Никто не подтверждает — просто видно
                </p>

                {/* Marking already happened; this button exists only to send a
                    photo added after the fact. */}
                {goal.markedToday && photo && (
                  <Button size="sm" className="mt-2 w-full" disabled={busy} onClick={upload}>
                    Приложить пруф
                  </Button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setProofOpen(true)}
                className="font-mono text-micro uppercase text-graphite underline underline-offset-2 transition-colors hover:text-ink"
              >
                + приложить пруф
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-end gap-3 font-mono text-micro uppercase">
          {!done && goal.myStatus === 'JOINED' && (
            <button
              onClick={() =>
                confirming === 'complete' ? complete.mutate(goal.id) : setConfirming('complete')
              }
              onBlur={() => setConfirming(null)}
              disabled={complete.isPending}
              className={cn(
                'uppercase transition-colors hover:text-ink disabled:opacity-50',
                confirming === 'complete'
                  ? 'text-ochre underline underline-offset-2'
                  : 'text-graphite',
              )}
            >
              {confirming === 'complete' ? 'Точно закрыть?' : 'Спор окончен'}
            </button>
          )}

          {!done && (
            <button
              onClick={() =>
                confirming === 'leave' ? leave.mutate(goal.id) : setConfirming('leave')
              }
              onBlur={() => setConfirming(null)}
              className={cn(
                'uppercase transition-colors hover:text-ink',
                confirming === 'leave'
                  ? 'text-vermilion underline underline-offset-2'
                  : 'text-graphite',
              )}
            >
              {confirming === 'leave'
                ? goal.isOwner
                  ? 'Бросить для всех?'
                  : 'Точно?'
                : invited
                  ? 'Отказаться'
                  : goal.isOwner
                    ? 'Бросить спор'
                    : 'Выйти'}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/**
 * The score. Sprints taken on the right, because that is the standing;
 * the current sprint in the middle, because that is what is still moving.
 */
function Standings({ versus }: { versus: VersusView }) {
  const draws = versus.standings[0]?.sprintsDrawn ?? 0;

  return (
    <>
      <div className="mt-2.5 border-y border-ink/15">
        {versus.standings.map((person) => (
          <div
            key={person.id}
            className="flex items-baseline justify-between gap-2 border-b border-ink/10 py-1.5 font-mono text-micro uppercase last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className={person.markedToday ? 'text-ink' : 'text-vermilion'}
                title={person.markedToday ? 'сегодня отмечено' : 'сегодня ещё нет'}
              >
                {person.markedToday ? '✓' : '·'}
              </span>
              <span className="truncate">{person.isMe ? 'ты' : person.firstName}</span>
            </span>

            <span className="flex shrink-0 items-baseline gap-3 text-graphite">
              <span>
                <span className="figure">{person.daysThisSprint}</span>/{versus.sprintDays}
              </span>
              <span className="figure text-[1.0625rem] text-ink">{person.sprintsWon}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-1 font-mono text-micro uppercase text-graphite">
        справа — взятые спринты{draws > 0 ? ` · ничьих ${draws}` : ''}
      </p>
    </>
  );
}

/** Evidence, newest first. Nobody approves it — it is here to be seen. */
function Proofs({ goalId, versus }: { goalId: string; versus: VersusView }) {
  const [open, setOpen] = useState(false);
  const shown = open ? versus.proofs : versus.proofs.slice(0, 2);

  return (
    <div className="mt-2.5">
      <p className="font-mono text-micro uppercase text-graphite">пруфы</p>

      <ul className="mt-1 space-y-2">
        {shown.map((proof) => (
          <ProofRow key={proof.id} goalId={goalId} proof={proof} />
        ))}
      </ul>

      {versus.proofs.length > 2 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1 font-mono text-micro uppercase text-graphite underline underline-offset-2 transition-colors hover:text-ink"
        >
          {open ? 'свернуть' : `ещё ${versus.proofs.length - 2}`}
        </button>
      )}
    </div>
  );
}

function ProofRow({ goalId, proof }: { goalId: string; proof: GoalProof }) {
  const { url, isPending, isError } = useProofImage(goalId, proof.id, proof.hasImage);

  return (
    <li className="text-[0.8125rem] leading-snug">
      <span className="font-mono text-micro uppercase text-graphite">
        {proof.author?.firstName ?? '—'} · {formatDayMark(proof.date)}
      </span>
      {proof.note && <span className="ml-1.5 break-words">{proof.note}</span>}
      {proof.url && (
        <a
          href={proof.url}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-1.5 break-all font-mono text-[0.75rem] text-ochre underline underline-offset-2"
        >
          ссылка
        </a>
      )}

      {proof.hasImage && (
        <div className="mt-1">
          {url ? (
            <img
              src={url}
              alt={`Пруф — ${proof.author?.firstName ?? 'участник'}`}
              className="max-h-56 w-full border border-ink/20 object-contain"
            />
          ) : (
            <div className="flex h-16 items-center justify-center border border-dashed border-ink/25 font-mono text-micro uppercase text-graphite">
              {isError ? 'фото не открылось' : isPending ? 'загружаю фото…' : ''}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

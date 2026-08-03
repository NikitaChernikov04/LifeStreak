import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, get, put } from '@vercel/blob';
import { Readable } from 'node:stream';

/** What a compressed proof is allowed to weigh once the browser is done with it. */
export const MAX_PROOF_BYTES = 2 * 1024 * 1024;

/**
 * Formats the browser can produce from a canvas and that every client can
 * render back. Anything else is a file we did not compress and cannot vouch
 * for the size of.
 */
export const PROOF_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/**
 * Proof photos, kept in a *private* Vercel Blob store.
 *
 * Private is the whole point. A public store hands out a CDN address that
 * works for anybody holding the string — forever, and long after somebody has
 * left the goal. There would be no way to honour "only the people in this
 * bet can see it" except by hoping the link never travels. Here the bytes can
 * only be reached through this service, which is only ever called after the
 * membership check.
 */
@Injectable()
export class ProofStorageService {
  private readonly logger = new Logger(ProofStorageService.name);

  constructor(private readonly config: ConfigService) {}

  /** False when the store is not wired up, which is the normal state locally. */
  get available(): boolean {
    return Boolean(this.token);
  }

  private get token(): string | undefined {
    return this.config.get<string>('BLOB_READ_WRITE_TOKEN');
  }

  /**
   * Stores one image and returns its pathname. The pathname is what goes in
   * the database — never the URL, so a leaked row still opens nothing.
   */
  async save(goalId: string, userId: string, file: Buffer, mimeType: string): Promise<string> {
    const token = this.token;
    if (!token) throw new InternalServerErrorException('Хранилище пруфов не настроено');

    const extension = EXTENSIONS[mimeType] ?? 'bin';
    const blob = await put(`proofs/${goalId}/${userId}.${extension}`, file, {
      access: 'private',
      contentType: mimeType,
      // Two proofs from the same person on the same goal must not collide, and
      // the suffix is not a security measure here — the store is private.
      addRandomSuffix: true,
      token,
    });

    return blob.pathname;
  }

  /** The bytes back, as a stream. Callers must have checked membership first. */
  async read(pathname: string): Promise<{ stream: Readable; contentType: string } | null> {
    const token = this.token;
    if (!token) return null;

    const blob = await get(pathname, { access: 'private', token });
    if (!blob || blob.statusCode !== 200) return null;

    return {
      stream: Readable.fromWeb(blob.stream as Parameters<typeof Readable.fromWeb>[0]),
      contentType: blob.blob.contentType || 'application/octet-stream',
    };
  }

  /**
   * Best-effort cleanup. A proof whose row is gone is not worth failing a
   * request over, but it is worth not paying to store forever.
   */
  async forget(pathname: string): Promise<void> {
    const token = this.token;
    if (!token) return;
    try {
      await del(pathname, { token });
    } catch (error) {
      this.logger.warn(`Не удалось удалить пруф ${pathname}: ${String(error)}`);
    }
  }
}

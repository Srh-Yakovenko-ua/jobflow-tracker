import { RESUME_UPLOAD_LIMITS } from '@jobflow/shared';

import { addMinutes } from '../common/add-minutes.js';
import type {
  CopyRequest,
  DownloadUrlRequest,
  FileStorage,
  ObjectStart,
  SignedUrl,
  StoredObject,
  UploadUrlRequest,
} from '../storage/file-storage.js';

export type FakeObject = { bytes: Uint8Array; mime: string };

export const FAKE_STORAGE_URL = 'https://storage.test/';

const signedUrl = (key: string, expiresAt: Date): Promise<SignedUrl> =>
  Promise.resolve({ url: `${FAKE_STORAGE_URL}${key}`, expiresAt });

class WrittenObjects extends Map<string, FakeObject> {
  readonly etags = new Map<string, string>();
  private writes = 0;

  override set(key: string, object: FakeObject): this {
    this.writes += 1;
    this.etags.set(key, `"etag-${String(this.writes)}"`);
    return super.set(key, object);
  }
}

export class FakeFileStorage implements FileStorage {
  readonly objects = new WrittenObjects();
  readonly signed: UploadUrlRequest[] = [];
  readonly downloads: DownloadUrlRequest[] = [];
  readonly copies: CopyRequest[] = [];
  readonly deleted: string[] = [];

  createUploadUrl(request: UploadUrlRequest): Promise<SignedUrl> {
    this.signed.push(request);
    const ttlMinutes = RESUME_UPLOAD_LIMITS.uploadUrlTtlSeconds / 60;
    return signedUrl(request.key, addMinutes(request.signedAt, ttlMinutes));
  }

  createDownloadUrl(request: DownloadUrlRequest): Promise<SignedUrl> {
    this.downloads.push(request);
    const ttlMinutes = RESUME_UPLOAD_LIMITS.downloadUrlTtlSeconds / 60;
    return signedUrl(request.key, addMinutes(request.signedAt, ttlMinutes));
  }

  head(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    const etag = this.objects.etags.get(key) ?? null;
    return Promise.resolve(
      object ? { sizeBytes: object.bytes.length, mime: object.mime, etag } : null,
    );
  }

  readStart({ key, bytes, ifMatch }: ObjectStart): Promise<Uint8Array> {
    const object = this.objects.get(key);
    const unchanged = ifMatch === undefined || this.objects.etags.get(key) === ifMatch;
    return Promise.resolve(object && unchanged ? object.bytes.slice(0, bytes) : new Uint8Array());
  }

  copy(request: CopyRequest): Promise<boolean> {
    this.copies.push(request);
    const source = this.objects.get(request.from);
    if (source === undefined || this.objects.etags.get(request.from) !== request.ifMatch) {
      return Promise.resolve(false);
    }
    this.objects.set(request.to, source);
    return Promise.resolve(true);
  }

  delete(key: string): Promise<void> {
    this.deleted.push(key);
    this.objects.delete(key);
    return Promise.resolve();
  }
}

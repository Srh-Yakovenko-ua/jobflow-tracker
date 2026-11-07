import { RESUME_UPLOAD_LIMITS } from '@jobflow/shared';

import { addMinutes } from '../common/add-minutes.js';
import type {
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

export class FakeFileStorage implements FileStorage {
  readonly objects = new Map<string, FakeObject>();
  readonly signed: UploadUrlRequest[] = [];
  readonly deleted: string[] = [];

  createUploadUrl(request: UploadUrlRequest): Promise<SignedUrl> {
    this.signed.push(request);
    const ttlMinutes = RESUME_UPLOAD_LIMITS.uploadUrlTtlSeconds / 60;
    return signedUrl(request.key, addMinutes(request.signedAt, ttlMinutes));
  }

  createDownloadUrl({ key, signedAt }: DownloadUrlRequest): Promise<SignedUrl> {
    const ttlMinutes = RESUME_UPLOAD_LIMITS.downloadUrlTtlSeconds / 60;
    return signedUrl(key, addMinutes(signedAt, ttlMinutes));
  }

  head(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    return Promise.resolve(object ? { sizeBytes: object.bytes.length, mime: object.mime } : null);
  }

  readStart({ key, bytes }: ObjectStart): Promise<Uint8Array> {
    return Promise.resolve(this.objects.get(key)?.bytes.slice(0, bytes) ?? new Uint8Array());
  }

  delete(key: string): Promise<void> {
    this.deleted.push(key);
    this.objects.delete(key);
    return Promise.resolve();
  }
}

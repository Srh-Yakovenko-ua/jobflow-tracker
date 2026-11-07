export type Signing = { signedAt: Date };

export type UploadUrlRequest = Signing & { key: string; mime: string; sizeBytes: number };

export type DownloadUrlRequest = Signing & { key: string; mime: string; filename: string };

export type SignedUrl = { url: string; expiresAt: Date };

export type StoredObject = { sizeBytes: number; mime: string | null; etag: string | null };

export type ObjectStart = { key: string; bytes: number; ifMatch?: string | undefined };

export type CopyRequest = { from: string; to: string; ifMatch: string };

export abstract class FileStorage {
  abstract createUploadUrl(request: UploadUrlRequest): Promise<SignedUrl>;
  abstract createDownloadUrl(request: DownloadUrlRequest): Promise<SignedUrl>;
  abstract head(key: string): Promise<StoredObject | null>;
  abstract readStart(start: ObjectStart): Promise<Uint8Array>;
  abstract copy(request: CopyRequest): Promise<boolean>;
  abstract delete(key: string): Promise<void>;
}

export type Signing = { signedAt: Date };

export type UploadUrlRequest = Signing & { key: string; mime: string; sizeBytes: number };

export type DownloadUrlRequest = Signing & { key: string; mime: string; filename: string };

export type SignedUrl = { url: string; expiresAt: Date };

export type StoredObject = { sizeBytes: number; mime: string | null };

export type ObjectStart = { key: string; bytes: number };

export abstract class FileStorage {
  abstract createUploadUrl(request: UploadUrlRequest): Promise<SignedUrl>;
  abstract createDownloadUrl(request: DownloadUrlRequest): Promise<SignedUrl>;
  abstract head(key: string): Promise<StoredObject | null>;
  abstract readStart(start: ObjectStart): Promise<Uint8Array>;
  abstract delete(key: string): Promise<void>;
}

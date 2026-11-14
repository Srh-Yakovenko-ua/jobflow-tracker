import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RESUME_UPLOAD_LIMITS } from '@jobflow/shared';
import type { OnModuleDestroy } from '@nestjs/common';
import { addSeconds } from 'date-fns';

import { AppError, ERROR_TYPES } from '../common/app-error.js';
import { DEPENDENCY_LIMITS } from '../common/probe.js';
import type { AppConfig } from '../config/app-config.js';
import type {
  CopyRequest,
  DownloadUrlRequest,
  FileStorage,
  ObjectStart,
  PutObject,
  SignedUrl,
  StoredObject,
  UploadUrlRequest,
} from './file-storage.js';

export type S3Settings = {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  bucket: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
};

type Expiry = { signedAt: Date; ttlSeconds: number };

const SIGNED_UPLOAD_HEADERS = new Set(['content-type', 'content-length']);

const PDF_MIME = 'application/pdf';

export function s3SettingsOf(config: AppConfig): S3Settings {
  const endpoint = config.get('S3_ENDPOINT', { infer: true });
  return {
    endpoint,
    publicEndpoint: config.get('S3_PUBLIC_ENDPOINT', { infer: true }) || endpoint,
    region: config.get('S3_REGION', { infer: true }),
    bucket: config.get('S3_BUCKET', { infer: true }),
    credentials: {
      accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
      secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
    },
  };
}

function clientAt(settings: S3Settings, endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: settings.region,
    credentials: settings.credentials,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: {
      connectionTimeout: DEPENDENCY_LIMITS.connectTimeoutMs,
      requestTimeout: DEPENDENCY_LIMITS.storageTimeoutMs,
    },
  });
}

const withinStorageLimit = () => ({
  abortSignal: AbortSignal.timeout(DEPENDENCY_LIMITS.storageTimeoutMs),
});

const storageDown = (cause: unknown) =>
  new AppError({ ...ERROR_TYPES[503], status: 503, detail: 'File storage did not answer', cause });

const isMissing = (error: unknown) => error instanceof NotFound || error instanceof NoSuchKey;

const isPreconditionFailed = (error: unknown) =>
  error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412;

async function orMissing<T>(call: Promise<T>): Promise<T | null> {
  try {
    return await call;
  } catch (error) {
    if (isMissing(error) || isPreconditionFailed(error)) {
      return null;
    }
    throw storageDown(error);
  }
}

const expiryOf = ({ signedAt, ttlSeconds }: Expiry) => ({
  signingDate: signedAt,
  expiresIn: ttlSeconds,
  expiresAt: addSeconds(signedAt, ttlSeconds),
});

const encodedFilename = (filename: string) =>
  encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export class S3FileStorage implements FileStorage, OnModuleDestroy {
  private readonly client: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;

  constructor(settings: S3Settings) {
    this.client = clientAt(settings, settings.endpoint);
    this.signer = clientAt(settings, settings.publicEndpoint);
    this.bucket = settings.bucket;
  }

  async createUploadUrl({ key, mime, sizeBytes, signedAt }: UploadUrlRequest): Promise<SignedUrl> {
    const { expiresAt, ...expiry } = expiryOf({
      signedAt,
      ttlSeconds: RESUME_UPLOAD_LIMITS.uploadUrlTtlSeconds,
    });
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mime,
      ContentLength: sizeBytes,
    });
    const url = await getSignedUrl(this.signer, command, {
      ...expiry,
      signableHeaders: SIGNED_UPLOAD_HEADERS,
    });
    return { url, expiresAt };
  }

  async createDownloadUrl({
    key,
    mime,
    filename,
    signedAt,
  }: DownloadUrlRequest): Promise<SignedUrl> {
    const { expiresAt, ...expiry } = expiryOf({
      signedAt,
      ttlSeconds: RESUME_UPLOAD_LIMITS.downloadUrlTtlSeconds,
    });
    const disposition = mime === PDF_MIME ? 'inline' : 'attachment';
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: mime,
      ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodedFilename(filename)}`,
    });
    return { url: await getSignedUrl(this.signer, command, expiry), expiresAt };
  }

  async head(key: string): Promise<StoredObject | null> {
    const command = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
    const stored = await orMissing(this.client.send(command, withinStorageLimit()));
    return (
      stored && {
        sizeBytes: stored.ContentLength ?? 0,
        mime: stored.ContentType ?? null,
        etag: stored.ETag ?? null,
      }
    );
  }

  async copy({ from, to, ifMatch }: CopyRequest): Promise<boolean> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      Key: to,
      CopySource: `${this.bucket}/${from}`,
      CopySourceIfMatch: ifMatch,
    });
    return (await orMissing(this.client.send(command, withinStorageLimit()))) !== null;
  }

  async put({ key, bytes, mime }: PutObject): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: bytes,
      ContentType: mime,
      ContentLength: bytes.length,
    });
    await this.client.send(command, withinStorageLimit()).catch((error: unknown) => {
      throw storageDown(error);
    });
  }

  async readStart({ key, bytes, ifMatch }: ObjectStart): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Range: `bytes=0-${String(bytes - 1)}`,
      IfMatch: ifMatch,
    });
    return (await orMissing(this.bodyOf(command))) ?? new Uint8Array();
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await orMissing(this.client.send(command, withinStorageLimit()));
  }

  onModuleDestroy(): void {
    this.client.destroy();
    this.signer.destroy();
  }

  private async bodyOf(command: GetObjectCommand): Promise<Uint8Array> {
    const object = await this.client.send(command, withinStorageLimit());
    return (await object.Body?.transformToByteArray()) ?? new Uint8Array();
  }
}

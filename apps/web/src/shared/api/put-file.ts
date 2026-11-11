export const FILE_UPLOAD_LIMITS = { putTimeoutMs: 120_000 } as const;

export type FileUploadErrorReason = 'status' | 'network' | 'timeout' | 'aborted';

export type UploadProgress = { loaded: number; total: number };

export type PutFileOptions = {
  url: string;
  file: File;
  headers: Readonly<Record<string, string>>;
  onProgress?: ((progress: UploadProgress) => void) | undefined;
  signal?: AbortSignal | undefined;
};

export type FileUploadErrorOptions = { reason: FileUploadErrorReason };

export class FileUploadError extends Error {
  readonly reason: FileUploadErrorReason;

  constructor({ reason }: FileUploadErrorOptions) {
    super(`File upload failed: ${reason}`);
    this.name = 'FileUploadError';
    this.reason = reason;
  }
}

const SUCCESS_STATUS = { from: 200, below: 300 } as const;

type PutTarget = Pick<PutFileOptions, 'url' | 'headers'>;

function openPut({ url, headers }: PutTarget): XMLHttpRequest {
  const request = new XMLHttpRequest();
  request.open('PUT', url);
  request.withCredentials = false;
  for (const [name, value] of Object.entries(headers)) {
    request.setRequestHeader(name, value);
  }
  return request;
}

function boundRequest(request: XMLHttpRequest, signal: AbortSignal | undefined) {
  let timedOut = false;
  const abort = () => {
    request.abort();
  };
  const timer = setTimeout(() => {
    timedOut = true;
    request.abort();
  }, FILE_UPLOAD_LIMITS.putTimeoutMs);
  signal?.addEventListener('abort', abort, { once: true });
  return {
    abortReason: (): FileUploadErrorReason => (timedOut ? 'timeout' : 'aborted'),
    release: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    },
  };
}

function isSuccess(status: number): boolean {
  return status >= SUCCESS_STATUS.from && status < SUCCESS_STATUS.below;
}

export function putFile({ url, file, headers, onProgress, signal }: PutFileOptions): Promise<void> {
  if (signal?.aborted === true) {
    return Promise.reject(new FileUploadError({ reason: 'aborted' }));
  }
  return new Promise((resolve, reject) => {
    const request = openPut({ url, headers });
    const bounds = boundRequest(request, signal);
    const settle = (reason: FileUploadErrorReason | null) => {
      bounds.release();
      if (reason === null) {
        resolve();
        return;
      }
      reject(new FileUploadError({ reason }));
    };
    request.upload.onprogress = ({ loaded, total }) => onProgress?.({ loaded, total });
    request.onload = () => {
      settle(isSuccess(request.status) ? null : 'status');
    };
    request.onerror = () => {
      settle('network');
    };
    request.onabort = () => {
      settle(bounds.abortReason());
    };
    request.send(file);
  });
}

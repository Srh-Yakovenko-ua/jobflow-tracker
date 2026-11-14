import { Injectable } from '@nestjs/common';

import { FileStorage, type PutObject } from '../storage/file-storage.js';

@Injectable()
export class DemoCvFiles {
  constructor(private readonly storage: FileStorage) {}

  async store(files: PutObject[]): Promise<void> {
    await Promise.all(files.map((file) => this.storage.put(file)));
  }
}

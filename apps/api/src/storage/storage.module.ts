import { type FactoryProvider, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/app-config.js';
import { FileStorage } from './file-storage.js';
import { S3FileStorage, s3SettingsOf } from './s3-file-storage.js';

const fileStorageProvider: FactoryProvider<FileStorage> = {
  provide: FileStorage,
  useFactory: (config: AppConfig) => new S3FileStorage(s3SettingsOf(config)),
  inject: [ConfigService],
};

@Module({
  providers: [fileStorageProvider],
  exports: [FileStorage],
})
export class StorageModule {}

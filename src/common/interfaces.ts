import { S3ClientConfig, StorageClass } from '@aws-sdk/client-s3';
import { NFSProvider } from '../providers/nfsProvider';
import { S3Provider } from '../providers/s3Provider';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface IngestionTaskParameters {
  paths: string[];
  modelId: string;
  lastIndexError: number;
}

export interface DeleteTaskParameters {
  modelId: string;
  modelFolderId: string;
}

export interface S3Config extends S3ClientConfig {
  kind: 's3';
  bucketName: string;
  storageClass?: StorageClass;
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
  maxAttempts: number;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface NFSConfig {
  kind: 'NFS';
  pvPath: string;
}

export interface ProviderManager {
  source: S3Provider | NFSProvider;
  dest: S3Provider | NFSProvider;
}

export interface ProvidersConfig {
  source: ProviderConfig;
  dest: ProviderConfig;
}

export type ProviderConfig = S3Config | NFSConfig;

export interface ProviderMap {
  [key: string]: Provider;
}

export interface Provider {
  getFile: (fileName: string) => Promise<Buffer>;
  postFile: (fileName: string, data: Buffer) => Promise<void>;
  deleteFolder: (folderPath: string) => Promise<void>;
}

export interface TaskResult {
  completed: boolean;
  index: number;
  error?: Error;
}

export interface LogContext {
  fileName: string;
  class: string;
  function?: string;
}

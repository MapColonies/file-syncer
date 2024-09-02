import { commonNfsV1Type, commonS3FullV1Type } from '@map-colonies/schemas';
import { NFSProvider } from '../providers/nfsProvider';
import { S3Provider } from '../providers/s3Provider';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface TaskParameters {
  paths: string[];
  modelId: string;
  lastIndexError: number;
}

export interface ProviderManager {
  source: S3Provider | NFSProvider;
  destination: S3Provider | NFSProvider;
}

export interface ProvidersConfig {
  source: ProviderConfig;
  destination: ProviderConfig;
}

export type ProviderConfig = {
    provider: "NFS",
    config: commonNfsV1Type
  } | {
    provider: "S3",
    config: commonS3FullV1Type
};

export interface ProviderMap {
  [key: string]: Provider;
}

export interface Provider {
  getFile: (fileName: string) => Promise<Buffer>;
  postFile: (fileName: string, data: Buffer) => Promise<void>;
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

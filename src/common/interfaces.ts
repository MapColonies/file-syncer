import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { NFSProvider } from '../providers/nfsProvider';
import { S3Provider } from '../providers/s3Provider';
import { ProviderTypes as ProviderType } from './enums';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface JobParameters {
  metadata: Layer3DMetadata;
  modelId: string;
  tilesetFilename: string;
}

export interface TaskParameters {
  paths: string[];
  modelId: string;
  lastIndexError: number;
}

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl: string;
  bucket: string;
  region: string;
  sslEnabled: boolean;
  forcePathStyle: boolean;
  maxAttempts: number;
}

export interface NFSConfig {
  pvPath: string;
}

export interface ProviderManager {
  source: S3Provider | NFSProvider,
  dest: S3Provider | NFSProvider
}

export interface ProviderConfigOld {
  type: ProviderType;
  config: NFSConfig | S3Config
}

export interface ProviderConfiguration {
  source: ProviderConfig;
  dest: ProviderConfig
}

export type ProviderConfig = S3Config | NFSConfig;

export interface ProviderMap {
  [key: string]: ProviderFunctions;
}

export interface ProviderFunctions {
  getFile: (fileName: string) => Promise<Buffer>;
  postFile: (fileName: string, data: Buffer) => Promise<void>;
}

export interface TaskResult {
  completed: boolean;
  index: number;
  error?: Error;
}

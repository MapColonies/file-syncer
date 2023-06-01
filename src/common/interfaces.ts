import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { Providers } from './enums';

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

export interface S3ProvidersConfig {
  source?: S3Config;
  destination?: S3Config;
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

export interface ProviderMap {
  [key: string]: Provider;
}

export interface ProviderConfig {
  source: Providers;
  destination: Providers;
}

export interface NFSProvidersConfig {
  source?: NFSConfig;
  destination?: NFSConfig;
}

export interface IData {
  content: Buffer;
  length?: number | undefined;
}

export interface Provider {
  getFile: (fileName: string) => Promise<IData>;
  postFile: (fileName: string, data: IData) => Promise<void>;
}

export interface TaskResult {
  completed: boolean;
  index: number;
  error?: Error;
}

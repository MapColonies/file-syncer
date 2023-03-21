import { Readable } from 'stream';
import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { Providers } from './enums';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface IJobParameters {
  metadata: Layer3DMetadata;
  modelId: string;
  tilesetFilename: string;
}

export interface ITaskParameters {
  paths: string[];
  modelId: string;
}

export interface IS3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl: string;
  bucket: string;
  destinationBucket: string;
  sslEnabled: boolean;
  forcePathStyle: boolean;
  maxAttempts: number;
}

export interface INFSConfig {
  pvPath: string;
}

export interface IProviderMap {
  [key: string]: IConfigProvider;
}


export interface IProviderConfig {
  source: Providers;
  destination: Providers;
}

export interface NFSConfig {
  source: INFSConfig;
  destination: INFSConfig;
}

export interface IData {
  content: Readable;
  length?: number | undefined;
}

export interface IConfigProvider {
  getFile: (fileName: string) => Promise<IData>;
  postFile: (fileName: string, data: IData) => Promise<void>;
  // isModelExists: (model: string) => boolean | Promise<boolean>;
}

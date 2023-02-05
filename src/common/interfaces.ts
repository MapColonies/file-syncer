import { Readable } from 'stream';
import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { Providers } from './enums';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface IJobParameters {
  metadata: Layer3DMetadata;
}

export interface ITaskParameters {
  paths: string[];
}

export interface IS3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl: string;
  bucket: string;
  destinationBucket: string;
  sslEnabled: boolean;
  forcePathStyle: boolean;
}

export interface IFSConfig {
  pvPath: string;
}

export interface IWorkerConfig {
  configProvider: Providers;
}

export interface FSConfig {
  source: IFSConfig;
  destination: IFSConfig;
}

export interface IData {
  content: Readable;
  length?: number | undefined;
}

export interface IConfigProvider {
  getFile: (model: string) => Promise<IData>;
  postFile: (model: string, data: IData) => Promise<void>;
}
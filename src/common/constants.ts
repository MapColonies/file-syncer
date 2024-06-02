import config from 'config';
import { readPackageJsonSync } from '@map-colonies/read-pkg';

const packageJsonData = readPackageJsonSync();
export const SERVICE_NAME = packageJsonData.name ?? 'unknown_service';
export const SERVICE_VERSION = packageJsonData.version ?? 'unknown_version';

export const NODE_VERSION = process.versions.node;

export const JOB_TYPE = config.get<string>('fileSyncer.job.type');

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  S3_CONFIG: Symbol('S3Config'),
  NFS_CONFIG: Symbol('NFSConfig'),
  TASK_HANDLER: Symbol('TaskHandler'),
  PROVIDER_MANAGER: Symbol('ProviderManager'),
};
/* eslint-enable @typescript-eslint/naming-convention */

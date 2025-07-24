import config from 'config';
import { readPackageJsonSync } from '@map-colonies/read-pkg';

const packageJsonData = readPackageJsonSync();
export const SERVICE_NAME = packageJsonData.name ?? 'unknown_service';
export const SERVICE_VERSION = packageJsonData.version ?? 'unknown_version';

export const NODE_VERSION = process.versions.node;

export const INGESTION_JOB_TYPE = config.get<string>('jobManager.ingestion.jobType');
export const INGESTION_TASK_TYPE = config.get<string>('jobManager.ingestion.taskType');
export const DELETE_JOB_TYPE = config.get<string>('jobManager.delete.jobType');
export const DELETE_TASK_TYPE = config.get<string>('jobManager.delete.taskType');

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

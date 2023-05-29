import { readPackageJsonSync } from '@map-colonies/read-pkg';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';
export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

export const JOB_TYPE = 'ingestion';

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METER: Symbol('Meter'),
  METRICS: Symbol('Metrics'),
  CONFIG_PROVIDER_FROM: Symbol('ConfigProviderFrom'),
  CONFIG_PROVIDER_TO: Symbol('ConfigProviderTo'),
  S3_CONFIG: Symbol('S3Config'),
  NFS_CONFIG: Symbol('NFSConfig'),
  TASK_HANDLER: Symbol('TaskHandler'),
};
/* eslint-enable @typescript-eslint/naming-convention */

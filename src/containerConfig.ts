import { TaskHandler } from '@map-colonies/mc-priority-queue';
import { Metrics } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import config from 'config';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { NFSProvidersConfig, Provider, ProviderConfig, S3ProvidersConfig } from './common/interfaces';
import { tracing } from './common/tracing';
import logger from './common/logger';
import { getProvider } from './common/providers/getProvider';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const nfsConfig = config.get<NFSProvidersConfig>('NFS');
  const s3Config = config.get<S3ProvidersConfig>('S3');
  const providerConfig = config.get<ProviderConfig>('fileSyncer.provider');
  const jobManagerBaseUrl = config.get<string>('jobManager.url');
  const heartbeatUrl = config.get<string>('heartbeat.url');
  const dequeueIntervalMs = config.get<number>('fileSyncer.waitTime');
  const heartbeatIntervalMs = config.get<number>('heartbeat.waitTime');

  const metrics = new Metrics(SERVICE_NAME);
  const meter = metrics.start();

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: meter } },
    { token: SERVICES.METRICS, provider: { useValue: metrics } },
    { token: SERVICES.NFS_CONFIG, provider: { useValue: nfsConfig } },
    { token: SERVICES.S3_CONFIG, provider: { useValue: s3Config } },
    {
      token: SERVICES.TASK_HANDLER,
      provider: {
        useFactory: (): TaskHandler => {
          return new TaskHandler(logger, jobManagerBaseUrl, heartbeatUrl, dequeueIntervalMs, heartbeatIntervalMs);
        },
      },
    },
    {
      token: SERVICES.CONFIG_PROVIDER_FROM,
      provider: {
        useFactory: (): Provider => {
          return getProvider(providerConfig.source);
        },
      },
    },
    {
      token: SERVICES.CONFIG_PROVIDER_TO,
      provider: {
        useFactory: (): Provider => {
          return getProvider(providerConfig.destination);
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};

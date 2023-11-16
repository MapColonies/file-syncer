import { TaskHandler } from '@map-colonies/mc-priority-queue';
import { Metrics } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import config from 'config';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { ProvidersConfig, ProviderManager } from './common/interfaces';
import logger from './common/logger';
import { tracing } from './common/tracing';
import { getProviderManager } from './providers/getProvider';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const providerConfiguration = config.get<ProvidersConfig>('provider');
  const jobManagerBaseUrl = config.get<string>('jobManager.url');
  const heartbeatUrl = config.get<string>('heartbeat.url');
  const dequeueIntervalMs = config.get<number>('fileSyncer.waitTime');
  const heartbeatIntervalMs = config.get<number>('heartbeat.waitTime');

  const metrics = new Metrics();
  const meter = metrics.start();

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: meter } },
    { token: SERVICES.METRICS, provider: { useValue: metrics } },
    {
      token: SERVICES.TASK_HANDLER,
      provider: {
        useFactory: (): TaskHandler => {
          return new TaskHandler(logger, jobManagerBaseUrl, heartbeatUrl, dequeueIntervalMs, heartbeatIntervalMs);
        },
      },
    },
    {
      token: SERVICES.PROVIDER_MANAGER,
      provider: {
        useFactory: (): ProviderManager => {
          return getProviderManager(providerConfiguration);
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};

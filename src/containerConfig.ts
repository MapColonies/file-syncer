import { TaskHandler } from '@map-colonies/mc-priority-queue';
import { trace } from '@opentelemetry/api';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { instanceCachingFactory } from 'tsyringe';
import client from 'prom-client';
import config from 'config';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { getOtelMixin } from '@map-colonies/telemetry';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { ProvidersConfig, ProviderManager } from './common/interfaces';
import { tracing } from './common/tracing';
import { getProviderManager } from './providers/getProvider';
import { IConfig } from './common/interfaces';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const providerConfiguration = config.get<ProvidersConfig>('provider');
  const jobManagerBaseUrl = config.get<string>('jobManager.url');
  const heartbeatUrl = config.get<string>('heartbeat.url');
  const dequeueIntervalMs = config.get<number>('jobManager.task.pollingIntervalTime');
  const heartbeatIntervalMs = config.get<number>('heartbeat.pingingIntervalTime');
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    {
      token: SERVICES.METRICS_REGISTRY,
      provider: {
        useFactory: instanceCachingFactory((container) => {
          const config = container.resolve<IConfig>(SERVICES.CONFIG);

          if (config.get<boolean>('telemetry.metrics.enabled')) {
            client.register.setDefaultLabels({
              app: SERVICE_NAME,
            });
            return client.register;
          }
        }),
      },
    },
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
          return getProviderManager(logger, tracer, providerConfiguration);
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};

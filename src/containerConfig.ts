import config from 'config';
import { TaskHandler } from '@map-colonies/mc-priority-queue';
import { trace } from '@opentelemetry/api';
import jsLogger from '@map-colonies/js-logger';
import { instanceCachingFactory } from 'tsyringe';
import client from 'prom-client';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { getOtelMixin } from '@map-colonies/telemetry';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { ProviderManager } from './common/interfaces';
import { tracing } from './common/tracing';
import { getProviderManager } from './providers/getProvider';
import { getConfig } from './common/config';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const configInstance = getConfig();

  const jobManager = configInstance.get('jobManager');
  const dequeueIntervalMs = configInstance.get('jobManager.task.pollingIntervalTime');
  const loggerConfig = configInstance.get('telemetry.logger');
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });
  const providers = configInstance.get('storage');

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: configInstance } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    {
      token: SERVICES.METRICS_REGISTRY,
      provider: {
        useFactory: instanceCachingFactory(() => {
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
          return new TaskHandler(logger, jobManager.url, jobManager.heartbeat.url, dequeueIntervalMs, jobManager.heartbeat.pingingIntervalTime);
        },
      },
    },
    {
      token: SERVICES.PROVIDER_MANAGER,
      provider: {
        useFactory: (): ProviderManager => {
          return getProviderManager(logger, tracer, providers);
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};

import { trace } from '@opentelemetry/api';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { instanceCachingFactory } from 'tsyringe';
import client from 'prom-client';
import config from 'config';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import { getOtelMixin } from '@map-colonies/telemetry';
import { Queue } from 'bullmq';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { ProvidersConfig, ProviderManager } from './common/interfaces';
import { tracing } from './common/tracing';
import { getProviderManager } from './providers/getProvider';
import { IConfig } from './common/interfaces';
import { QUEUES } from './common/commonBullMQ';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const providerConfiguration = config.get<ProvidersConfig>('provider');
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    {
      token: SERVICES.QUEUE,
      provider: {
        useFactory: (): Queue => {
          return new Queue(QUEUES.jobsQueue, {
            connection: {
              host: "127.0.0.1",
              port: 6379
            },
            prefix: '3D'
          });
        },
      },
    },
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

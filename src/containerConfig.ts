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

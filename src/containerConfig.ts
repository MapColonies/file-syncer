import config from 'config';
import { logMethod } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { tracing } from './common/tracing';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { IConfigProvider, INFSConfig, IS3Config, IProviderConfig } from './common/interfaces';
import { GetProvider } from './getProvider';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  const nfsConfig = config.get<INFSConfig>('NFS');
  const s3Config = config.get<IS3Config>('S3');
  const providerConfig = config.get<IProviderConfig>('worker.configProvider');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });

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
    { token: SERVICES.NFS, provider: { useValue: nfsConfig } },
    { token: SERVICES.S3, provider: { useValue: s3Config } },
    {
      token: SERVICES.CONFIG_PROVIDER_FROM,
      provider: {
        useFactory: (): IConfigProvider => {
          return GetProvider(providerConfig.source);
        },
      },
    },
    {
      token: SERVICES.CONFIG_PROVIDER_TO,
      provider: {
        useFactory: (): IConfigProvider => {
          return GetProvider(providerConfig.destination);
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};

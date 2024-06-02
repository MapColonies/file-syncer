import { Logger } from '@map-colonies/js-logger';
import { Tracer } from '@opentelemetry/api';
import { ProviderConfig, ProviderManager, ProvidersConfig } from '../common/interfaces';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(logger: Logger, tracer: Tracer, config: ProviderConfig): S3Provider | NFSProvider {
  if (config.type === 'S3') {
    return new S3Provider(logger, tracer, config);
  } else {
    return new NFSProvider(logger, tracer, config);
  }
}

function getProviderManager(logger: Logger, tracer: Tracer, providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    source: getProvider(logger, tracer, providerConfiguration.source),
    dest: getProvider(logger, tracer, providerConfiguration.dest),
  };
}

export { getProvider, getProviderManager };

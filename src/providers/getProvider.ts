import { Logger } from '@map-colonies/js-logger';
import { Tracer } from '@opentelemetry/api';
import { ProviderConfig, ProviderManager, ProvidersConfig } from '../common/interfaces';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(logger: Logger, tracer: Tracer, storage: ProviderConfig): S3Provider | NFSProvider {
  if (storage.provider === 'S3') {
    return new S3Provider(logger, tracer, storage.config);
  } else {
    return new NFSProvider(logger, tracer, storage.config);
  }
}

function getProviderManager(logger: Logger, tracer: Tracer, providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    source: getProvider(logger, tracer, providerConfiguration.source),
    destination: getProvider(logger, tracer, providerConfiguration.destination),
  };
}

export { getProvider, getProviderManager };

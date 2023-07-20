import { ProviderConfig, ProviderManager, ProvidersConfig } from '../common/interfaces';
import logger from '../common/logger';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(config: ProviderConfig): S3Provider | NFSProvider {
  if (config.type === 'S3') {
    return new S3Provider(logger, config);
  } else {
    return new NFSProvider(logger, config);
  }
}

function getProviderManager(providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    source: getProvider(providerConfiguration.source),
    dest: getProvider(providerConfiguration.dest),
  };
}

export { getProvider, getProviderManager };

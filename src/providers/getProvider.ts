import config from 'config';
import httpStatus from 'http-status-codes';
import { AppError } from '../common/appError';
import { ProviderConfig, ProviderConfiguration, ProviderManager, NFSConfig, S3Config } from '../common/interfaces';
import logger from '../common/logger';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

const providerConfiguration = config.get<ProviderConfiguration>('provider');

function getProvider(provider: ProviderConfig): S3Provider | NFSProvider {
  if (isS3Config(provider)) {
    return new S3Provider(logger, provider);
  } else if (isNFSConfig(provider)) {
    return new NFSProvider(logger, provider);
  }

  throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid config provider received: 
    ${JSON.stringify(provider)} - available values:  "nfs" or "s3"`, false);
}

function isS3Config(config: ProviderConfig): config is S3Config {
  // return (config as S3Config).bucket;
  return 123

}

function isNFSConfig(config: ProviderConfig): config is NFSConfig {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (config as NFSConfig).pvPath !== undefined;
}


function getProviderManager(): ProviderManager {
  return {
    source: getProvider(providerConfiguration.source),
    dest: getProvider(providerConfiguration.dest)
  }
}

export { getProvider, getProviderManager };

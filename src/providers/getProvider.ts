import httpStatus from 'http-status-codes';
import { AppError } from '../common/appError';
import { ProviderConfig, ProvidersConfig, ProviderManager, NFSConfig, S3Config } from '../common/interfaces';
import logger from '../common/logger';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(config: ProviderConfig): S3Provider | NFSProvider {
  if (isS3Config(config)) {
    return new S3Provider(logger, config);
  } else if (isNFSConfig(config)) {
    return new NFSProvider(logger, config);
  }

  throw new AppError(
    httpStatus.INTERNAL_SERVER_ERROR,
    `Invalid config provider received: 
    ${JSON.stringify(config)} - available values:  "nfs" or "s3"`,
    false
  );
}

function isS3Config(config: ProviderConfig): config is S3Config {
  return typeof (config as S3Config).bucket === 'string';
}

function isNFSConfig(config: ProviderConfig): config is NFSConfig {
  return typeof (config as NFSConfig).pvPath === 'string';
}

function getProviderManager(providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    source: getProvider(providerConfiguration.source),
    dest: getProvider(providerConfiguration.dest),
  };
}

export { getProvider, getProviderManager };

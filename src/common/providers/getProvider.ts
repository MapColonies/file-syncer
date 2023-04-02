import config from 'config';
import httpStatus from 'http-status-codes';
import { AppError } from '../appError';
import { NFSConfig, NFSProvidersConfig, Provider, S3Config, S3ProvidersConfig } from '../interfaces';
import logger from '../logger';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

const nfsConfig = config.get<NFSProvidersConfig>('NFS');
const s3Config = config.get<S3ProvidersConfig>('S3');

function getProvider(provider: string): Provider {
  switch (provider.toLowerCase()) {
    case 'nfs':
      return new NFSProvider(logger, nfsConfig);
    case 's3':
      return new S3Provider(logger, s3Config);
    default:
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid config provider received: ${provider} - available values:  "nfs" or "s3"`, false);
  }
}

function getProviderConfig(provider: string): NFSConfig | S3Config {
  try {
    return config.get(provider);
  } catch (err) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Invalid config provider received: ${provider} - available values:  "nfs" or "s3"`, false);
  }
}

export { getProvider, getProviderConfig };

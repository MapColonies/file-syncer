import config from 'config';
import httpStatus from 'http-status-codes';
import { container } from 'tsyringe';
import { AppError } from '../appError';
import { Provider, NFSConfig, S3Config } from '../interfaces';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

function getProvider(provider: string): Provider {
  switch (provider.toLowerCase()) {
    case 'nfs':
      return container.resolve(NFSProvider);
    case 's3':
      return container.resolve(S3Provider);
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

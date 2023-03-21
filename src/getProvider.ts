// import { FSProvider } from './common/providers/fSProvider';
import { container } from 'tsyringe';
import httpStatus from 'http-status-codes';
import { S3Provider } from './common/providers/s3Provider';
import { IConfigProvider, IProviderMap } from './common/interfaces';
import { NFSProvider } from './common/providers/nfSProvider';
import { AppError } from './common/appError';

const providers: IProviderMap = {
  'nfs': container.resolve(NFSProvider),
  's3': container.resolve(S3Provider)
};

export const GetProvider = (provider: string): IConfigProvider => {
  try {
    return providers[provider.toLowerCase()];
  } catch (err) {
    throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, `Invalid config provider received: ${provider} - available values: "nfs" or "s3"`, false);
  }
};

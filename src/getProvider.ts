// import { FSProvider } from './common/providers/fSProvider';
import { S3Provider } from './common/providers/s3Provider';
import { IConfigProvider, IProviderMap } from './common/interfaces';
import { NFSProvider } from './common/providers/nfSProvider';

const providers: IProviderMap = {
  'nfs': new NFSProvider(),
  's3': new S3Provider()
};

export const GetProvider = (provider: string): IConfigProvider => {
  try {
    return providers[provider.toLowerCase()];
  } catch (err) {
    throw new Error(`Invalid config provider received: ${provider} - available values: "nfs" or "s3"`);
  }
};

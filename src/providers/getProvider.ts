import { Logger } from '@map-colonies/js-logger';
import { Tracer } from '@opentelemetry/api';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { NFSConfig, ProviderConfig, ProviderManager, ProvidersConfig, S3Config } from '../common/interfaces';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

const nfsProviderName = 'nfs';
const s3ProviderName = 's3';

function getProvider(logger: Logger, tracer: Tracer, config: ProviderConfig): S3Provider | NFSProvider {
  if (config.kind.toLowerCase() === s3ProviderName) {
    const { kind, ...clientConfig } = config as S3Config;
    const s3ClientConfig: S3ClientConfig = {
      endpoint: clientConfig.endpoint,
      region: clientConfig.region,
      forcePathStyle: clientConfig.forcePathStyle,
      maxAttempts: clientConfig.maxAttempts,
      credentials: {
        accessKeyId: clientConfig.credentials.accessKeyId,
        secretAccessKey: clientConfig.credentials.secretAccessKey,
      },
    }
    const s3Client = new S3Client(s3ClientConfig);
    const fullS3ClientConfig = {...s3ClientConfig, bucketName: clientConfig.bucketName, storageClass: clientConfig.storageClass}
    return new S3Provider(s3Client, logger, tracer, fullS3ClientConfig as S3Config);
  } else if (config.kind.toLowerCase() === nfsProviderName) {
    return new NFSProvider(logger, tracer, config as NFSConfig);
  } else {
    const message = `Unsupported provider config type ${config.kind} was provided`;
    logger.fatal({ msg: message });
    throw Error(message);
  }
}

function getProviderManager(logger: Logger, tracer: Tracer, providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    source: getProvider(logger, tracer, providerConfiguration.source),
    dest: getProvider(logger, tracer, providerConfiguration.dest),
  };
}

export { getProvider, getProviderManager };

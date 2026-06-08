import { Logger } from '@map-colonies/js-logger';
import { Tracer } from '@opentelemetry/api';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { IConfig, NFSConfig, ProviderConfig, ProviderManager, ProvidersConfig, S3Config } from '../common/interfaces';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

const nfsProviderName = 'nfs';
const s3ProviderName = 's3';

function getProvider(logger: Logger, tracer: Tracer, appConfig: IConfig, config: ProviderConfig): S3Provider | NFSProvider {
  if (config.kind.toLowerCase() === s3ProviderName) {
    const { kind, ...clientConfig } = config as S3Config;
    logger.info({ msg: `Creating S3 provider with endpoint ${clientConfig.endpoint} and region ${clientConfig.region}` });

    const s3ClientConfig: S3ClientConfig = {
      endpoint: clientConfig.endpoint,
      region: clientConfig.region,
      forcePathStyle: clientConfig.forcePathStyle,
      maxAttempts: clientConfig.maxAttempts,
      credentials: {
        accessKeyId: clientConfig.credentials.accessKeyId,
        secretAccessKey: clientConfig.credentials.secretAccessKey,
      },
      requestHandler: clientConfig.requestHandler,
    };
    logger.debug({ msg: `s3 client configuration: `, s3ClientConfig });
    const s3Client = new S3Client(s3ClientConfig);

    const fullS3ClientConfig = { ...s3ClientConfig, bucketName: clientConfig.bucketName, storageClass: clientConfig.storageClass };
    return new S3Provider(s3Client, logger, tracer, appConfig, fullS3ClientConfig as S3Config);
  } else if (config.kind.toLowerCase() === nfsProviderName) {
    return new NFSProvider(logger, tracer, config as NFSConfig);
  } else {
    const message = `Unsupported provider config type ${config.kind} was provided`;
    logger.fatal({ msg: message });
    throw Error(message);
  }
}

function getProviderManager(logger: Logger, tracer: Tracer, appConfig: IConfig, providerConfiguration: ProvidersConfig): ProviderManager {
  return {
    source: getProvider(logger, tracer, appConfig, providerConfiguration.source),
    dest: getProvider(logger, tracer, appConfig, providerConfiguration.dest),
  };
}

export { getProvider, getProviderManager };

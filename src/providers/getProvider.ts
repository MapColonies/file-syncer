import { Logger } from '@map-colonies/js-logger';
import { Tracer } from '@opentelemetry/api';
import { S3Client } from '@aws-sdk/client-s3';
import { NFSConfig, ProviderConfig, ProviderManager, ProvidersConfig, S3Config } from '../common/interfaces';
import { NFSProvider } from './nfsProvider';
import { S3Provider } from './s3Provider';

const nfsProviderName = 'nfs';
const s3ProviderName = 's3';

function getProvider(logger: Logger, tracer: Tracer, config: ProviderConfig): S3Provider | NFSProvider {
  if (config.kind.toLowerCase() === s3ProviderName) {
    const { kind, bucketName, ...clientConfig } = config as S3Config;
    const s3Client = new S3Client(clientConfig);
    return new S3Provider(s3Client, logger, tracer, config as S3Config);
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

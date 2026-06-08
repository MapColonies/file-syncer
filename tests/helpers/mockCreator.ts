import { ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { faker } from '@faker-js/faker';
import jsLogger, { Logger } from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import config from 'config';
import { getApp } from '../../src/app';
import { SERVICES } from '../../src/common/constants';
import { InjectionObject } from '../../src/common/dependencyRegistration';
import {
  IConfig,
  NFSConfig,
  ProviderConfig,
  ProviderManager,
  ProvidersConfig,
  S3Config,
  IngestionTaskParameters,
  DeleteTaskParameters,
} from '../../src/common/interfaces';
import { getProviderManager } from '../../src/providers/getProvider';

const fakeNFSConfig = (name: string): NFSConfig => {
  return { kind: 'NFS', pvPath: `./tests/helpers/${name}` };
};

const fakeS3Config = (bucketName: string): S3Config => {
  const result: S3Config = {
    kind: 's3',
    endpoint: 'http://127.0.0.1:9000',
    bucketName,
    region: 'us-east-1',
    forcePathStyle: true,
    maxAttempts: 3,
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    },
    requestHandler: {
      socketTimeout: 222,
    },
  };
  return result;
};

const fakeProvidersConfig = (source: string, dest: string): ProvidersConfig => {
  return {
    source: FakeProvider(source, 'source-models'),
    dest: FakeProvider(dest, 'dest-models'),
  };
};

const FakeProvider = (provider: string, name: string): ProviderConfig => {
  switch (provider) {
    case 's3':
      return fakeS3Config(name);
    case 'nfs':
      return fakeNFSConfig(name);
    default:
      throw Error('wrong values');
  }
};

export const createIngestionTask = (modelId?: string, paths?: string[]): ITaskResponse<IngestionTaskParameters> => {
  return {
    id: faker.string.uuid(),
    jobId: faker.string.uuid(),
    description: faker.word.sample(),
    parameters: createTaskParameters(modelId, paths),
    created: '2020',
    updated: '2022',
    type: 'ingestion',
    status: OperationStatus.IN_PROGRESS,
    reason: faker.word.sample(),
    attempts: 0,
    resettable: true,
  };
};

export const createDeleteTask = (modelId?: string): ITaskResponse<DeleteTaskParameters> => {
  return {
    id: faker.string.uuid(),
    jobId: faker.string.uuid(),
    description: faker.word.sample(),
    parameters: {
      modelId: modelId!,
    },
    created: '2020',
    updated: '2022',
    type: 'ingestion',
    status: OperationStatus.IN_PROGRESS,
    reason: faker.word.sample(),
    attempts: 0,
    resettable: true,
  };
};

export const createTaskParameters = (modelId?: string, paths?: string[]): IngestionTaskParameters => {
  return {
    paths: paths ? paths : [faker.word.sample(), faker.word.sample()],
    modelId: modelId ?? faker.string.uuid(),
    lastIndexError: -1,
  };
};

export const taskHandlerMock = {
  jobManagerClient: {
    updateTask: jest.fn(),
  },
  waitForTask: jest.fn(),
  ack: jest.fn(),
  reject: jest.fn(),
  dequeue: jest.fn(),
};

export const providerManagerMock = {
  source: {
    getFile: jest.fn(),
  },
  dest: {
    postFile: jest.fn(),
    deleteFolder: jest.fn(),
  },
};

export const fileSyncerManagerMock = {
  sendFilesToCloudProvider: jest.fn(),
  changeModelName: jest.fn(),
  rejectJobManager: jest.fn(),
};

export const jobsManagerMock = {
  waitForTask: jest.fn(),
  ack: jest.fn(),
  reject: jest.fn(),
};

export const loggerMock: jest.Mocked<Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>> = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

export const mockNFStNFS = fakeProvidersConfig('nfs', 'nfs') as { source: NFSConfig; dest: NFSConfig };
export const mockNFStS3 = fakeProvidersConfig('nfs', 's3') as { source: NFSConfig; dest: S3Config };
export const mockS3tNFS = fakeProvidersConfig('s3', 'nfs') as { source: S3Config; dest: NFSConfig };
export const mockS3tS3 = fakeProvidersConfig('s3', 's3') as { source: S3Config; dest: S3Config };

export const testLogger = jsLogger({ enabled: false });
export const testTracer = trace.getTracer('testTracer');

export function createAppConfig(overrides: Record<string, unknown> = {}): IConfig {
  return {
    get: <T>(key: string): T => {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) {
        return overrides[key] as T;
      }
      return config.get<T>(key);
    },
    has: (key: string): boolean => config.has(key),
  };
}

export function setupProviderIntegrationApp(options: {
  providersConfig: ProvidersConfig;
  appConfig?: IConfig;
  extraOverrides?: InjectionObject<unknown>[];
}): ProviderManager {
  const appConfig = options.appConfig ?? createAppConfig();
  const providerManager = getProviderManager(testLogger, testTracer, appConfig, options.providersConfig);

  getApp({
    override: [
      { token: SERVICES.LOGGER, provider: { useValue: testLogger } },
      { token: SERVICES.CONFIG, provider: { useValue: appConfig } },
      { token: SERVICES.PROVIDER_MANAGER, provider: { useValue: providerManager } },
      ...(options.extraOverrides ?? []),
    ],
  });

  return providerManager;
}

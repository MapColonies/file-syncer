import { ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';
import { randUuid, randWord } from '@ngneat/falso';
import { NFSConfig, ProviderConfig, ProvidersConfig, S3Config, TaskParameters } from '../../src/common/interfaces';

const fakeNFSConfig = (name: string): NFSConfig => {
  return {pvPath: `./tests/helpers/${name}`};
}

const fakeS3Config = (bucket: string): S3Config => {
  return {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    endpointUrl: 'http://127.0.0.1:9000',
    bucket,
    region: 'us-east-1',
    forcePathStyle: true,
    sslEnabled: false,
    maxAttempts: 3,
  };
}

const fakeProvidersConfig = (source: string, dest: string): ProvidersConfig => {
  return {
    source: FakeProvider(source, 'source-models'),
    dest: FakeProvider(dest, 'dest-models'),
  };
}

const FakeProvider = (provider: string, name: string): ProviderConfig => {
  switch (provider) {
    case 's3':
      return fakeS3Config(name);
    case 'nfs':
      return fakeNFSConfig(name);
    default:
      throw Error('wrong values');
  }
}

export const createTask = (modelId?: string, paths?: string[]): ITaskResponse<TaskParameters> => {
  return {
    id: randUuid(),
    jobId: randUuid(),
    description: randWord(),
    parameters: createTaskParameters(modelId, paths),
    created: '2020',
    updated: '2022',
    type: 'ingestion',
    status: OperationStatus.IN_PROGRESS,
    reason: randWord(),
    attempts: 0,
    resettable: true,
  };
};

export const createTaskParameters = (modelId?: string, paths?: string[]): TaskParameters => {
  return {
    paths: paths ? paths : [randWord(), randWord()],
    modelId: modelId != undefined ? modelId : randUuid(),
    lastIndexError: 0,
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

export const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

export const providerConfigurationMockNFS2NFS = fakeProvidersConfig('nfs', 'nfs') as {source: NFSConfig, dest: NFSConfig};
export const providerConfigurationMockNFS2S3 = fakeProvidersConfig('nfs', 's3') as {source: NFSConfig, dest: S3Config};
export const providerConfigurationMockS32NFS = fakeProvidersConfig('s3', 'nfs') as {source: S3Config, dest: NFSConfig};
export const providerConfigurationMockS32S3 = fakeProvidersConfig('s3', 's3') as {source: S3Config, dest: S3Config};

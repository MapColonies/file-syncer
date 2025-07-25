import jsLogger from '@map-colonies/js-logger';
import { faker } from '@faker-js/faker';
import { container } from 'tsyringe';
import { trace } from '@opentelemetry/api';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { ProviderManager } from '../../../src/common/interfaces';
import { getProviderManager } from '../../../src/providers/getProvider';
import { mockNFStNFS } from '../../helpers/mockCreator';
import { NFSHelper } from '../../helpers/nfsHelper';

describe('NFSProvider', () => {
  let providerManager: ProviderManager;
  let nfsHelperSource: NFSHelper;
  let nfsHelperDest: NFSHelper;

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager(jsLogger({ enabled: false }), trace.getTracer('testTracer'), mockNFStNFS);
            },
          },
        },
      ],
    });

    providerManager = container.resolve(SERVICES.PROVIDER_MANAGER);
    nfsHelperSource = new NFSHelper(mockNFStNFS.source);
    nfsHelperDest = new NFSHelper(mockNFStNFS.dest);
  });

  beforeEach(() => {
    nfsHelperSource.initNFS();
    nfsHelperDest.initNFS();
  });

  afterEach(async () => {
    await nfsHelperSource.cleanNFS();
    await nfsHelperDest.cleanNFS();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('getFile', () => {
    it('When calling getFile, should get the file content from pv path', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const fileContent = await nfsHelperSource.createFileOfModel(model, file);

      const bufferResult = await providerManager.source.getFile(`${model}/${file}`);
      const result = bufferResult.toString();

      expect(result).toStrictEqual(fileContent);
    });
  });

  describe('postFile', () => {
    it('When calling postFile, we should see the file and his content in the destination pv path', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const fileContent = await nfsHelperSource.createFileOfModel(model, file);
      const bufferedContent = Buffer.from(fileContent, 'utf-8');

      await providerManager.dest.postFile(`${model}/${file}`, bufferedContent);
      const resultFileContent = await nfsHelperDest.readFile(`${model}/${file}`);

      expect(resultFileContent).toStrictEqual(bufferedContent);
    });
  });

  describe('Delete Folder', () => {
    it('When calling DeleteFolder, we should remove the folder and its content from destination pv path', async () => {
      const model = faker.word.sample();
      const file = `${faker.word.sample()}.${faker.system.commonFileExt()}`;
      await nfsHelperDest.createFileOfModel(model, file);

      expect(nfsHelperDest.fileExists(model)).toBeTruthy();
      await providerManager.dest.deleteFolder(model);
      expect(nfsHelperDest.fileExists(model)).toBeFalsy();
    });
  });
});

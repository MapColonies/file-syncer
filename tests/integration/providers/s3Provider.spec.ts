import jsLogger from '@map-colonies/js-logger';
import { randFileExt, randSentence, randWord } from '@ngneat/falso';
import { container } from 'tsyringe';
import { ProviderManager } from '../../../src/common/interfaces';
import { S3Helper } from '../../helpers/s3Helper';
import { SERVICES } from '../../../src/common/constants';
import { getApp } from '../../../src/app';
import { getProviderManager } from '../../../src/providers/getProvider';
import { mockS3tS3 } from '../../helpers/mockCreator';

jest.useFakeTimers();

describe('S3Provider', () => {
  let providerManager: ProviderManager;
  let s3HelperSource: S3Helper;
  let s3HelperDest: S3Helper;

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        {
          token: SERVICES.PROVIDER_MANAGER,
          provider: {
            useFactory: (): ProviderManager => {
              return getProviderManager(mockS3tS3);
            },
          },
        },
      ],
    });

    providerManager = container.resolve(SERVICES.PROVIDER_MANAGER);
    s3HelperSource = new S3Helper(mockS3tS3.source);
    s3HelperDest = new S3Helper(mockS3tS3.dest);
  });

  beforeEach(async () => {
    await s3HelperSource.initialize();
    await s3HelperDest.initialize();
  });

  afterEach(async () => {
    await s3HelperSource.terminate();
    await s3HelperDest.terminate();
    jest.clearAllMocks();
  });

  describe('getFile', () => {
    it(`When calling getFile, should see the file content from source bucket`, async () => {
      const model = randWord();
      const file = `${randWord()}.${randFileExt()}`;
      const expected = await s3HelperSource.createFileOfModel(model, file);

      const result = await providerManager.source.getFile(`${model}/${file}`);
      const resultBuffer = Buffer.from(result as unknown as string);

      expect(resultBuffer).toStrictEqual(expected);
    });

    it(`When the file is not exists in the bucket, throws error`, async () => {
      const file = `${randWord()}.${randFileExt()}`;

      const result = async () => {
        await providerManager.source.getFile(file);
      };

      await expect(result).rejects.toThrow(Error);
    });
  });

  describe('postFile', () => {
    it('When calling postFile, should be able to read the written file from the destination', async () => {
      const model = randWord();
      const file = `${randWord()}.${randFileExt()}`;
      const data = Buffer.from(randSentence());
      await providerManager.dest.postFile(`${model}/${file}`, data);
      const result = await s3HelperDest.readFile(mockS3tS3.dest.bucket, `${model}/${file}`);
      const resultBuffer = Buffer.from(result as unknown as string);

      expect(resultBuffer).toStrictEqual(data);
    });
  });
});

import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { randFileExt, randWord } from '@ngneat/falso';
import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { S3ProvidersConfig } from '../../../src/common/interfaces';
import { S3Provider } from '../../../src/providers/s3Provider';
import { S3Helper } from '../../helpers/s3Helper';

describe('S3Provider', () => {
  let provider: S3Provider;
  let s3Helper: S3Helper;

  const s3Config = config.get<S3ProvidersConfig>('S3');

  beforeAll(async () => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.PROVIDER_CONFIG, provider: { useValue: s3Config } },
      ],
    });
    provider = container.resolve(S3Provider);
    s3Helper = container.resolve(S3Helper);

    await s3Helper.createBuckets();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await s3Helper.clearBuckets();
    await s3Helper.deleteBuckets();
  });

  describe('getFile', () => {
    it.only(`When has file, should get the file from source bucket`, async () => {
      console.log("nati");
      
      const model = randWord();
      const file = `${randWord()}.${randFileExt()}`;
      const expected = await s3Helper.createFileOfModel(model, file);

      const result = await provider.getFile(`${model}/${file}`);

      expect(result).toStrictEqual(expected);
    });

    it(`throws error if didn't read the file`, async () => {
      const file = `${randWord()}.${randFileExt()}`;

      const result = async () => {
        await provider.getFile(file);
      };
      await expect(result).rejects.toThrow(Error('got empty response'));
    });
  });

  // describe('postFile', () => {
  //   it('When has file, should write the file to destination pv path', async () => {
  //     const model = randWord();
  //     const file = `${randWord()}.${randFileExt()}`;
  //     const fileContent = await s3Helper.createFileOfModel(model, file);

  //     await provider.postFile(`${model}/${file}`, fileContent);
  //     const result = await s3Helper.readFileFromSource(`${model}/${file}`);

  //     expect(result).toStrictEqual(fileContent);
  //   });
  // });
});

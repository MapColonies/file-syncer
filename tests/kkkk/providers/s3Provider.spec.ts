/* eslint-disable @typescript-eslint/no-non-null-assertion */
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { randFileExt, randSentence, randWord } from '@ngneat/falso';
import { container } from 'tsyringe';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { S3Config } from '../../../src/common/interfaces';
import { S3Provider } from '../../../src/providers/s3Provider';
import { S3Helper } from '../../helpers/s3Helper';

jest.useFakeTimers();

describe('S3Provider', () => {
  let provider: S3Provider;
  let s3Helper: S3Helper;

  const s3Config = config.get<S3Config>('S3');

  beforeEach(async () => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.PROVIDER_CONFIG, provider: { useValue: s3Config } },
      ],
    });
    provider = container.resolve(S3Provider);
    s3Helper = container.resolve(S3Helper);

    await s3Helper.initialize();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await s3Helper.terminate();
  });

  describe('getFile', () => { 
    it(`When has file, should get the file from source bucket`, async () => {
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
      await expect(result).rejects.toThrow(Error);
    });
  });

  describe('postFile', () => {
    it('When has file, should write the file to destination pv path', async () => {
      const model = randWord();
      const file = `${randWord()}.${randFileExt()}`;
      const data = Buffer.from(randSentence());

      await provider.postFile(`${model}/${file}`, data);
      const result = await s3Helper.readFile(s3Config.bucket, `${model}/${file}`);

      expect(result).toStrictEqual(data);
    });
  });
});

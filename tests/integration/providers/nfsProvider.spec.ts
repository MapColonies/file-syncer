import { container } from 'tsyringe';
import jsLogger from '@map-colonies/js-logger';
import { randWord } from '@ngneat/falso';
import { getApp } from '../../../src/app';
import { NFSProvider } from '../../../src/providers/nfsProvider';
import { SERVICES } from '../../../src/common/constants';
import { AppError } from '../../../src/common/appError';
import { NfsHelper } from '../../helpers/nfsHelper';

describe('NFSProvider', () => {
  let provider: NFSProvider;
  let nfsHelper: NfsHelper;

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
      ],
    });

    provider = container.resolve(NFSProvider);
    nfsHelper = container.resolve(NfsHelper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await nfsHelper.cleanNFS();
  })

  describe('getFile', () => {
    it('When has file, should get the file from pv path', async () => {
      const model = randWord();
      const file = randWord() + '.txt';
      const fileContent = await nfsHelper.createFileOfModel(model, file);
      const expected = Buffer.from(fileContent, 'utf-8');

      const result = await provider.getFile(`${model}/${file}`);

      expect(result).toStrictEqual(expected);
    });

    it('if the file does not exists in the agreed folder, throws error', async () => {
      const model = 'bla';

      const result = async () => {
        await provider.getFile(model);
      };

      await expect(result).rejects.toThrow(AppError);
    });
  });
});

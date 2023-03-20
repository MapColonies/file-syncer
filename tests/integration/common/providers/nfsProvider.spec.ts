import * as fs from 'fs';
import config from 'config';
import httpStatus from 'http-status-codes';
import { NFSProvider } from '../../../../src/common/providers/nfSProvider';
import { AppError } from '../../../../src/common/appError';

describe('FSProvider', () => {
  let provider: NFSProvider;

  beforeEach(() => {
    provider = new NFSProvider();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('#list files', () => {
    it('returns all the files of the model if the model exists in the agreed folder', async () => {
      const model = 'model1';
      const expected = 'a.txt\nb.txt';
      const queueFile = config.get<string>('ingestion.queueFile');

      await provider.listFiles(model);
      const result = fs.readFileSync(queueFile, 'utf-8');

      expect(result).toStrictEqual(expected);
    });

    it('returns error string when model is not in the agreed folder', async () => {
      const model = 'bla';

      const result = await provider.listFiles(model);

      expect(result).toThrow(new AppError('', httpStatus.BAD_REQUEST, `Model ${model} doesn't exists in the agreed folder`, true));
    });
  });
});

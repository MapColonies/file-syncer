import { Readable } from 'stream';
import { container } from 'tsyringe';
import httpStatus from 'http-status-codes';
import { NFSProvider } from '../../../../src/common/providers/nfsProvider';
import { AppError } from '../../../../src/common/appError';
import { IData } from '../../../../src/common/interfaces';

describe('NFSProvider', () => {
  let provider: NFSProvider;

  beforeEach(() => {
    provider = container.resolve(NFSProvider);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('#get file tests', () => {
    const fsMock = {
      existsSync: jest.fn(),
      promises: {
        readFile: jest.fn(),
      },
    };

    it(`returns the file's data`, async () => {
      const filePath = 'test/path.txt';
      const data = 'data';
      const content = Readable.from(data);
      const expected: IData = {
        content: content,
        length: content.readableLength,
      };
      fsMock.existsSync.mockReturnValue(true);
      fsMock.promises.readFile.mockResolvedValueOnce(data);

      const result = await provider.getFile(filePath);

      expect(result).toStrictEqual(expected);
    });

    it(`throws error if the file doesn't exists`, async () => {
      const filePath = 'test/path.txt';
      fsMock.existsSync.mockReturnValue(false);

      expect(await provider.getFile(filePath)).toThrow(
        new AppError(httpStatus.BAD_REQUEST, `File ${filePath} doesn't exists in the agreed folder`, true)
      );
    });

    it(`throws error if unexpected error occurred`, async () => {
      const filePath = 'test/path.txt';
      fsMock.existsSync.mockReturnValue(true);
      fsMock.promises.readFile.mockRejectedValueOnce(new Error('test error'));

      expect(await provider.getFile(filePath)).toThrow(
        new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Didn't write the file ${filePath} in NFS`, true)
      );
    });
  });

  describe('#post file tests', () => {
    const fsMock = {
      promises: {
        mkdir: jest.fn(),
        writeFile: jest.fn(),
      },
    };
    it(`posted the data successfully`, async () => {
      const filePath = 'test/path.txt';
      const content = Readable.from('data');
      const data: IData = {
        content: content,
        length: content.readableLength,
      };
      fsMock.promises.mkdir.mockResolvedValueOnce('response');
      fsMock.promises.writeFile.mockImplementationOnce(async () => Promise.resolve());

      const result = await provider.postFile(filePath, data);

      expect(result).toBeUndefined();
    });

    it(`throws error if couldn't write the file`, async () => {
      const filePath = 'test/path.txt';
      const content = Readable.from('data');
      const data: IData = {
        content: content,
        length: content.readableLength,
      };
      fsMock.promises.mkdir.mockRejectedValueOnce(new Error('test error'));

      expect(await provider.postFile(filePath, data)).toThrow(
        new AppError(httpStatus.INTERNAL_SERVER_ERROR, `Didn't write the file ${filePath} in NFS`, true)
      );
    });
  });
});

import { Readable } from 'stream';
import { container } from 'tsyringe';
import { S3Provider } from '../../../../src/common/providers/s3Provider';
import { IData } from '../../../../src/common/interfaces';

describe('S3Provider', () => {
  let provider: S3Provider;

  const s3Mock = {
    send: jest.fn(),
  };
  const s3ProviderMock = {
    handleS3Error: jest.fn(),
  };

  beforeEach(() => {
    provider = container.resolve(S3Provider);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('#get file tests', () => {
    it(`returns the file's data`, async () => {
      const filePath = 'test/path.txt';
      const content = Readable.from('data');
      const s3Response = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Body: content,
        length: content.readableLength,
      };
      const expected: IData = {
        content: s3Response.Body,
        length: s3Response.length,
      };
      s3Mock.send.mockResolvedValueOnce(s3Response);

      const result = await provider.getFile(filePath);

      expect(result).toStrictEqual(expected);
    });

    it(`throws error if didn't read the file`, async () => {
      const filePath = 'test/path.txt';
      s3Mock.send.mockRejectedValue(new Error('test error'));

      await provider.getFile(filePath);

      expect(s3ProviderMock).toHaveBeenCalled();
    });
  });

  describe('#post file tests', () => {
    it(`posted the data successfully`, async () => {
      const filePath = 'test/path.txt';
      const content = Readable.from('data');
      const data: IData = {
        content: content,
        length: content.readableLength,
      };
      s3Mock.send.mockImplementationOnce(async () => Promise.resolve());

      const result = await provider.postFile(filePath, data);

      expect(result).toBeUndefined();
    });

    it(`throws error if didn't write the file`, async () => {
      const filePath = 'test/path.txt';
      const content = Readable.from('data');
      const data: IData = {
        content: content,
        length: content.readableLength,
      };
      s3Mock.send.mockRejectedValue(new Error('test error'));

      await provider.postFile(filePath, data);

      expect(s3ProviderMock).toHaveBeenCalled();
    });
  });
});

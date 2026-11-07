import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, put } from '@vercel/blob';
import { UploadsService } from './uploads.service';

jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  del: jest.fn(),
}));

const createConfig = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

const pngBuffer = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8),
]);

const createFile = (overrides: Partial<Express.Multer.File> = {}) =>
  ({
    fieldname: 'file',
    originalname: 'product.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: pngBuffer.length,
    buffer: pngBuffer,
    ...overrides,
  }) as unknown as Express.Multer.File;

describe('UploadsService', () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    }
  });

  describe('local driver', () => {
    const service = new UploadsService(
      createConfig({ 'app.uploadDriver': 'local', 'app.uploadDir': 'uploads' }),
    );

    it('validates image magic bytes', async () => {
      await expect(service.validateImage(createFile())).resolves.toBeUndefined();
    });

    it('rejects content that does not match the declared image type', async () => {
      await expect(
        service.validateImage(createFile({ buffer: Buffer.from('not an image') })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns a local URL for the persisted file', async () => {
      const result = await service.persist(createFile({ filename: 'stored.png' }));

      expect(result).toEqual({
        filename: 'stored.png',
        url: '/uploads/stored.png',
        mimeType: 'image/png',
        size: pngBuffer.length,
      });
    });
  });

  describe('vercel-blob driver', () => {
    const service = new UploadsService(
      createConfig({ 'app.uploadDriver': 'vercel-blob', 'app.uploadDir': 'uploads' }),
    );

    it('uploads the buffer and returns the public Blob URL', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
      jest.mocked(put).mockResolvedValue({ url: 'https://blob.example/stored.png' } as never);

      const result = await service.persist(createFile({ filename: 'stored.png' }));

      expect(put).toHaveBeenCalledWith('stored.png', pngBuffer, {
        access: 'public',
        contentType: 'image/png',
        addRandomSuffix: false,
      });
      expect(result.url).toBe('https://blob.example/stored.png');
    });

    it('fails clearly when object storage is not configured', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;

      await expect(service.persist(createFile())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('deletes by safe filename and rejects path traversal', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';

      await expect(service.remove('stored.png')).resolves.toEqual({
        filename: 'stored.png',
        deleted: true,
      });
      expect(del).toHaveBeenCalledWith('stored.png');

      await expect(service.remove('../secret.png')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

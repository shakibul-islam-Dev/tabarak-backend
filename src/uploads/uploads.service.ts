import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del, put } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

export type UploadDriver = 'local' | 'vercel-blob';

export interface UploadResponse {
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export function allowedImageMimeTypes(): string[] {
  return Object.keys(MIME_EXTENSIONS);
}

export function extensionForMime(mime: string): string | undefined {
  return MIME_EXTENSIONS[mime];
}

export function uniqueUploadFilename(mime: string): string {
  return `${randomUUID()}${extensionForMime(mime) ?? ''}`;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadDir: string;
  private readonly driver: UploadDriver;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = join(process.cwd(), this.config.get<string>('app.uploadDir') ?? 'uploads');
    this.driver = this.config.get<UploadDriver>('app.uploadDriver') ?? 'local';

    if (this.driver === 'vercel-blob' && !process.env.BLOB_READ_WRITE_TOKEN) {
      this.logger.warn(
        'UPLOAD_DRIVER is vercel-blob but BLOB_READ_WRITE_TOKEN is missing; uploads will fail',
      );
    }
  }

  get usesLocalDisk(): boolean {
    return this.driver === 'local';
  }

  async validateImage(file: Express.Multer.File): Promise<void> {
    const header = file.buffer ? file.buffer.subarray(0, 16) : await this.readHeader(file.path);

    if (!this.matchesSignature(file.mimetype, header)) {
      if (file.path) {
        await this.removeFile(file.path, false);
      }
      throw new BadRequestException('Uploaded file content is not a valid image');
    }
  }

  /**
   * Persists an already validated upload. Local disk storage is the default;
   * Vercel Blob is used when the app runs on Vercel with object storage.
   */
  async persist(file: Express.Multer.File): Promise<UploadResponse> {
    const filename = file.filename ?? uniqueUploadFilename(file.mimetype);

    if (this.driver === 'vercel-blob') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new ServiceUnavailableException('Object storage is not configured');
      }

      const blob = await put(filename, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
        addRandomSuffix: false,
      });

      return {
        filename,
        url: blob.url,
        mimeType: file.mimetype,
        size: file.size,
      };
    }

    return {
      filename,
      url: `/uploads/${filename}`,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async remove(filename: string): Promise<{ filename: string; deleted: boolean }> {
    const safeName = basename(filename);

    if (safeName !== filename || !safeName) {
      throw new BadRequestException('Invalid filename');
    }

    if (this.driver === 'vercel-blob') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new ServiceUnavailableException('Object storage is not configured');
      }

      await del(safeName);
      return { filename: safeName, deleted: true };
    }

    const path = join(this.uploadDir, safeName);
    await this.removeFile(path, true);

    return { filename: safeName, deleted: true };
  }

  private async readHeader(path: string): Promise<Buffer> {
    const handle = await fs.open(path, 'r');

    try {
      const buffer = Buffer.alloc(16);
      const { bytesRead } = await handle.read(buffer, 0, 16, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  private matchesSignature(mime: string, header: Buffer): boolean {
    switch (mime) {
      case 'image/jpeg':
        return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      case 'image/png':
        return (
          header[0] === 0x89 &&
          header[1] === 0x50 &&
          header[2] === 0x4e &&
          header[3] === 0x47 &&
          header[4] === 0x0d &&
          header[5] === 0x0a &&
          header[6] === 0x1a &&
          header[7] === 0x0a
        );
      case 'image/gif':
        return (
          header.subarray(0, 6).toString('ascii') === 'GIF87a' ||
          header.subarray(0, 6).toString('ascii') === 'GIF89a'
        );
      case 'image/webp':
        return (
          header.subarray(0, 4).toString('ascii') === 'RIFF' &&
          header.subarray(8, 12).toString('ascii') === 'WEBP'
        );
      case 'image/avif':
        return (
          header.subarray(4, 8).toString('ascii') === 'ftyp' &&
          ['avif', 'avis'].includes(header.subarray(8, 12).toString('ascii'))
        );
      default:
        return false;
    }
  }

  async removeFile(path: string, ignoreMissing: boolean): Promise<void> {
    try {
      await fs.unlink(path);
    } catch (error) {
      if (ignoreMissing) {
        return;
      }

      this.logger.error(`Unable to remove invalid upload: ${path}`);
      throw error;
    }
  }
}

export function multerFilename(
  _request: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void,
): void {
  const extension = extensionForMime(file.mimetype);

  if (!extension) {
    callback(new BadRequestException('Unsupported image type'), '');
    return;
  }

  callback(null, uniqueUploadFilename(file.mimetype));
}

import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  allowedImageMimeTypes,
  multerFilename,
  UploadDriver,
  UploadsService,
} from './uploads.service';

@Controller('admin/uploads')
export class AdminUploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.UPLOADS_MANAGE)
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage('File uploaded successfully')
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    await this.uploadsService.validateImage(file);
    return this.uploadsService.persist(file);
  }

  @Post('multiple')
  @RequirePermissions(PERMISSIONS.UPLOADS_MANAGE)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ResponseMessage('Files uploaded successfully')
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('No files were uploaded');
    }

    for (const file of files) {
      await this.uploadsService.validateImage(file);
    }

    return Promise.all(files.map((file) => this.uploadsService.persist(file)));
  }

  @Delete(':filename')
  @RequirePermissions(PERMISSIONS.UPLOADS_MANAGE)
  @ResponseMessage('File deleted successfully')
  remove(@Param('filename') filename: string) {
    return this.uploadsService.remove(filename);
  }
}

export function uploadMulterOptions(config: ConfigService) {
  const driver = config.get<UploadDriver>('app.uploadDriver') ?? 'local';

  return {
    // Vercel Blob needs the bytes in memory; local mode streams straight to disk.
    storage:
      driver === 'vercel-blob'
        ? memoryStorage()
        : diskStorage({
            destination: config.get<string>('app.uploadDir') ?? 'uploads',
            filename: (request, file, callback) => {
              multerFilename(request, file, callback);
            },
          }),
    limits: {
      fileSize: config.get<number>('app.maxFileSize') ?? 5 * 1024 * 1024,
      files: 10,
    },
    fileFilter: (
      _request: unknown,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!allowedImageMimeTypes().includes(file.mimetype)) {
        callback(new BadRequestException('Unsupported image type'), false);
        return;
      }

      callback(null, true);
    },
  };
}

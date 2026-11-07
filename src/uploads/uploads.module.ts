import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AdminUploadsController, uploadMulterOptions } from './admin-uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => uploadMulterOptions(config),
    }),
  ],
  controllers: [AdminUploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}

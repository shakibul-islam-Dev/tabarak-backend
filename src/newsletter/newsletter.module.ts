import { Module } from '@nestjs/common';
import { AdminNewsletterController, NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  controllers: [NewsletterController, AdminNewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}

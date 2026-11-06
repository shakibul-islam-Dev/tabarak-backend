import { Body, Controller, Get, Post } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { NewsletterTokenDto, SubscribeNewsletterDto } from './dto/newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Public()
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @ResponseMessage('Subscription received. Please check your email to confirm.')
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto.email);
  }

  @Post('confirm')
  @ResponseMessage('Newsletter subscription confirmed')
  confirm(@Body() dto: NewsletterTokenDto) {
    return this.newsletterService.confirm(dto.token);
  }

  @Post('unsubscribe')
  @ResponseMessage('You have been unsubscribed')
  unsubscribe(@Body() dto: NewsletterTokenDto) {
    return this.newsletterService.unsubscribe(dto.token);
  }
}

@Controller('admin/newsletter')
export class AdminNewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get('subscribers')
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  list() {
    return this.newsletterService.listSubscribers();
  }
}

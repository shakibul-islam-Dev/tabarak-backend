import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async subscribe(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const token = randomBytes(24).toString('hex');

    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { isActive: true },
      create: { email, token },
    });

    if (!subscriber.confirmedAt) {
      const frontendUrl = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';
      const url = `${frontendUrl}/newsletter/confirm?token=${subscriber.token}`;
      void this.emailService.sendNewsletterConfirmationEmail(subscriber.email, url);
    }

    return {
      email: subscriber.email,
      subscribed: true,
      confirmationRequired: !subscriber.confirmedAt,
    };
  }

  async confirm(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { token },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid newsletter confirmation token');
    }

    const updated = await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { confirmedAt: subscriber.confirmedAt ?? new Date(), isActive: true },
      select: { email: true, confirmedAt: true },
    });

    return { email: updated.email, confirmed: true, confirmedAt: updated.confirmedAt };
  }

  async unsubscribe(token: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { token },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid newsletter token');
    }

    await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false },
    });

    return { email: subscriber.email, subscribed: false };
  }

  async listSubscribers() {
    return this.prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        isActive: true,
        confirmedAt: true,
        createdAt: true,
      },
    });
  }
}

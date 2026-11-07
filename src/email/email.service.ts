import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailStatus } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from '../database/prisma.service';
import { templates } from './email.templates';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  template: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;
  private from = 'tabarak <no-reply@tabarak.local>';
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.from = this.config.get<string>('mail.from') ?? this.from;
    this.enabled = this.config.get<boolean>('mail.enabled') ?? false;

    if (!this.enabled) {
      this.logger.warn('SMTP is not configured; outgoing email is disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('mail.host'),
      port: this.config.get<number>('mail.port'),
      secure: this.config.get<boolean>('mail.secure'),
      auth: {
        user: this.config.get<string>('mail.user'),
        pass: this.config.get<string>('mail.pass'),
      },
    });

    this.logger.log('SMTP transport configured');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sends an email and records the attempt in the database. Email failures are
   * logged and never throw so they cannot break the calling request.
   */
  async send({ to, subject, html, template }: SendEmailOptions): Promise<boolean> {
    const log = await this.prisma.emailLog.create({
      data: { to, subject, template, status: EmailStatus.PENDING },
    });

    if (!this.enabled || !this.transporter) {
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: { status: EmailStatus.FAILED, error: 'SMTP is not configured', attempts: 1 },
      });
      this.logger.warn(`Skipped "${template}" email to ${to}: SMTP is not configured`);
      return false;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: { status: EmailStatus.SENT, sentAt: new Date(), attempts: 1 },
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: { status: EmailStatus.FAILED, error: message, attempts: 1 },
      });
      this.logger.error(`Failed to send "${template}" email to ${to}: ${message}`);
      return false;
    }
  }

  async sendVerificationEmail(to: string, name: string, url: string): Promise<void> {
    const { subject, html } = templates.verification(name, url);
    await this.send({ to, subject, html, template: 'verification' });
  }

  async sendPasswordResetEmail(to: string, name: string, url: string): Promise<void> {
    const { subject, html } = templates.passwordReset(name, url);
    await this.send({ to, subject, html, template: 'password-reset' });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const { subject, html } = templates.welcome(name);
    await this.send({ to, subject, html, template: 'welcome' });
  }

  async sendOrderConfirmationEmail(to: string, orderNumber: string, total: string): Promise<void> {
    const { subject, html } = templates.orderConfirmation(orderNumber, total);
    await this.send({ to, subject, html, template: 'order-confirmation' });
  }

  async sendOrderStatusEmail(to: string, orderNumber: string, status: string): Promise<void> {
    const { subject, html } = templates.orderStatusUpdate(orderNumber, status);
    await this.send({ to, subject, html, template: 'order-status' });
  }

  async sendNewsletterConfirmationEmail(to: string, url: string): Promise<void> {
    const { subject, html } = templates.newsletterConfirmation(url);
    await this.send({ to, subject, html, template: 'newsletter-confirmation' });
  }
}

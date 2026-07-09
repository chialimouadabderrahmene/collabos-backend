import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('mail.from') as string;

    this.transporter = createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: this.configService.get<boolean>('mail.secure'),
      auth: this.configService.get<string>('mail.user')
        ? {
            user: this.configService.get<string>('mail.user'),
            pass: this.configService.get<string>('mail.password'),
          }
        : undefined,
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    this.logger.log(`Mail sent to ${options.to}: ${options.subject}`);
  }

  async sendEmailVerification(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your CollabOS email address',
      html: `<p>Welcome to CollabOS. Confirm your email address by clicking the link below.</p>
             <p><a href="${link}">${link}</a></p>
             <p>This link expires in 24 hours.</p>`,
    });
  }

  async sendPasswordReset(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your CollabOS password',
      html: `<p>A password reset was requested for your account.</p>
             <p><a href="${link}">${link}</a></p>
             <p>If you did not request this, you can safely ignore this email. This link expires in 1 hour.</p>`,
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushDispatch {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushProviderService {
  private readonly logger = new Logger(PushProviderService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(dispatch: PushDispatch): Promise<void> {
    if (dispatch.tokens.length === 0) {
      return;
    }

    const webhookUrl = this.configService.get<string>(
      'push.providerWebhookUrl',
    );

    if (!webhookUrl) {
      this.logger.log(
        `No PUSH_PROVIDER_WEBHOOK_URL configured; logging push instead of sending: "${dispatch.title}" to ${dispatch.tokens.length} device(s)`,
      );
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatch),
    });

    if (!response.ok) {
      throw new Error(
        `Push provider webhook responded with status ${response.status}`,
      );
    }
  }
}

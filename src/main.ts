import './observability/tracing/tracing-init';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { REQUEST_ID_HEADER } from './common/logging/correlation-id.middleware';
import { initSentry } from './observability/sentry/init-sentry';

initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.enableShutdownHooks();

  app.useStaticAssets(
    resolve(configService.get<string>('avatar.uploadDir') as string),
    {
      prefix: '/uploads/avatars',
    },
  );

  app.useStaticAssets(
    resolve(configService.get<string>('brandAsset.uploadDir') as string),
    {
      prefix: '/uploads/brands',
    },
  );

  app.useStaticAssets(
    resolve(configService.get<string>('messageAttachment.uploadDir') as string),
    {
      prefix: '/uploads/messages',
    },
  );

  app.useStaticAssets(
    resolve(configService.get<string>('dropMedia.uploadDir') as string),
    {
      prefix: '/uploads/drops',
    },
  );

  app.useStaticAssets(
    resolve(configService.get<string>('productMedia.uploadDir') as string),
    {
      prefix: '/uploads/products',
    },
  );

  app.enableCors({
    origin: configService.get<string>('app.corsOrigin'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      REQUEST_ID_HEADER,
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  if (configService.get<boolean>('app.swaggerEnabled')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('CollabOS API')
        .setDescription('CollabOS backend API documentation')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}

void bootstrap();

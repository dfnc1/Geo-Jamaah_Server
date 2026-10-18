import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const logger = new Logger('Bootstrap');

/**
 * Resolve konfigurasi CORS dari env CORS_ORIGIN (daftar origin dipisah koma).
 *
 * Jika CORS_ORIGIN kosong, semua origin diizinkan ('*'). Browser menolak
 * kombinasi origin '*' + credentials: true, jadi credentials dimatikan.
 * Auth memakai header Bearer (bukan cookie), jadi credentials tidak diperlukan.
 */
function resolveCorsOptions(configService: ConfigService) {
  const origins = (configService.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return { origin: '*' };
  }

  return { origin: origins, credentials: true };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors(resolveCorsOptions(configService));
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: errors.flatMap((e) => Object.values(e.constraints ?? {})),
          error: 'ERR_VALIDATION',
        }),
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // /docs dan /docs-json dikecualikan dari prefix v1 agar URL dokumentasi tetap /docs
  app.setGlobalPrefix('v1', { exclude: ['docs', 'docs-json'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Geo Jamaah API')
    .setDescription(
      'API backend Geo Jamaah: autentikasi, presensi berbasis geolokasi, izin, monitoring, dan DSS/EWS.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Masukkan token JWT dengan format "Bearer <token>"',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((err) => {
  logger.error(
    'Gagal menjalankan aplikasi',
    err instanceof Error ? err.stack : String(err),
  );
});

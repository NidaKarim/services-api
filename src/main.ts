import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown query/body keys instead of passing them through.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Lets DTOs turn "?page=2" into a real number and apply defaults.
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Services API')
    .setDescription(
      'Read and manage the organization service catalog that backs the services dashboard widget.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Services API listening on http://localhost:${port}/api`);
  console.log(`Swagger UI at http://localhost:${port}/api/docs`);
}
bootstrap();

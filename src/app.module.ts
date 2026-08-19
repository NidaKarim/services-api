import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './config/typeorm.config';
import { envValidationSchema } from './config/env.validation';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDataSourceOptions(),
    }),
    ServicesModule,
  ],
})
export class AppModule {}

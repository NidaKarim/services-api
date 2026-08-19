import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { Service } from './entities/service.entity';
import { ServiceVersion } from './entities/service-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Service, ServiceVersion])],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}

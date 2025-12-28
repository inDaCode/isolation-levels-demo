import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [DatabaseModule, GatewayModule],
})
export class AppModule {}

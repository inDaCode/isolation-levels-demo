import { Module } from '@nestjs/common';
import { TerminalGateway } from './terminal.gateway';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [TerminalGateway],
})
export class GatewayModule {}

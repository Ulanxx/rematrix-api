import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PromptopsModule } from './modules/promptops/promptops.module';
import { StorageModule } from './modules/storage/storage.module';
import { TemporalModule } from './modules/temporal/temporal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TemporalModule,
    JobsModule,
    ArtifactsModule,
    PromptopsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

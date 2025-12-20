import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ArtifactType, JobStage } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/prisma/prisma.service';

jest.setTimeout(5 * 60 * 1000);

function envReady() {
  return Boolean(process.env.DATABASE_URL && process.env.OPENROUTER_API_KEY);
}

async function waitFor<T>(params: {
  timeoutMs: number;
  intervalMs: number;
  check: () => Promise<T | null>;
}): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < params.timeoutMs) {
    const res = await params.check();
    if (res) return res;
    await new Promise((r) => setTimeout(r, params.intervalMs));
  }
  throw new Error('timeout');
}

describe('Video generation pipeline (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService | undefined;

  beforeAll(async () => {
    if (!envReady()) return;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (!envReady()) return;

    await prisma?.$disconnect();
    await app?.close();
  });

  it('runs PLAN -> ... -> MERGE and produces VIDEO artifact', async () => {
    if (!envReady()) return;

    const markdown = '# Hello\n\nThis is a test markdown.';

    const createRes = await request(app.getHttpServer())
      .post('/jobs')
      .send({ markdown })
      .expect(201);

    const jobId = (createRes.body as { jobId: string }).jobId;

    await request(app.getHttpServer()).post(`/jobs/${jobId}/run`).expect(201);

    await request(app.getHttpServer())
      .post(`/jobs/${jobId}/approve`)
      .send({ stage: 'PLAN' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/jobs/${jobId}/approve`)
      .send({ stage: 'NARRATION' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/jobs/${jobId}/approve`)
      .send({ stage: 'PAGES' })
      .expect(201);

    const video = await waitFor({
      timeoutMs: 3 * 60 * 1000,
      intervalMs: 1000,
      check: async () => {
        if (!prisma) return null;
        return prisma.artifact.findFirst({
          where: {
            jobId,
            stage: JobStage.MERGE,
            type: ArtifactType.VIDEO,
          },
          orderBy: { version: 'desc' },
        });
      },
    });

    expect(video).toBeTruthy();
  });
});

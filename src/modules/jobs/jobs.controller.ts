import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { ApproveJobDto } from './dto/approve-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  async create(@Body() dto: CreateJobDto) {
    const job = await this.jobs.create(dto);
    return { jobId: job.id };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.jobs.get(id);
  }

  @Post(':id/run')
  async run(@Param('id') id: string) {
    return this.jobs.run(id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: ApproveJobDto) {
    const stage = dto.stage ?? 'PLAN';
    return this.jobs.approve(id, stage);
  }
}

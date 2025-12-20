import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePromptStageConfigDto } from './dto/create-prompt-stage-config.dto';
import { PublishPromptStageConfigDto } from './dto/publish-prompt-stage-config.dto';
import { UpdatePromptStageConfigDto } from './dto/update-prompt-stage-config.dto';
import { PromptopsService } from './promptops.service';

type BootstrapResponse = {
  active: unknown;
};

@Controller('admin/promptops')
export class PromptopsAdminController {
  constructor(private readonly promptops: PromptopsService) {}

  @Get('stages')
  listStages() {
    return { stages: this.promptops.listStages() };
  }

  @Get('stages/:stage/configs')
  async listConfigs(@Param('stage') stage: string) {
    return { configs: await this.promptops.listConfigs(stage) };
  }

  @Get('stages/:stage/active')
  async getActive(@Param('stage') stage: string) {
    return { config: await this.promptops.getActiveConfig(stage) };
  }

  @Post('configs')
  async createConfig(@Body() dto: CreatePromptStageConfigDto) {
    return { config: await this.promptops.createConfig(dto) };
  }

  @Patch('configs/:id')
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdatePromptStageConfigDto,
  ) {
    return { config: await this.promptops.updateConfig(id, dto) };
  }

  @Delete('configs/:id')
  async deleteConfig(@Param('id') id: string) {
    return { config: await this.promptops.deleteConfig(id) };
  }

  @Post('stages/:stage/publish')
  async publish(
    @Param('stage') stage: string,
    @Body() dto: PublishPromptStageConfigDto,
  ) {
    return {
      active: await this.promptops.publish(stage, dto.configId),
    };
  }

  @Post('stages/:stage/bootstrap')
  async bootstrap(@Param('stage') stage: string): Promise<BootstrapResponse> {
    return {
      active: await this.promptops.bootstrap(stage),
    };
  }
}

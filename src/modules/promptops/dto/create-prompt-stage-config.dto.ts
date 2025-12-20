export class CreatePromptStageConfigDto {
  stage!: string;
  model!: string;
  temperature?: number;
  prompt!: string;
  tools?: unknown;
  schema?: unknown;
  meta?: unknown;
}

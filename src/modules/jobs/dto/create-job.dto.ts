export class CreateJobDto {
  markdown!: string;

  targetDurationSec?: number;

  style?: string;

  language?: string;
}

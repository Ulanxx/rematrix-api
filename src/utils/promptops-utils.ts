import { createHash } from 'node:crypto';

export type QualityLoopConfig = {
  enable?: boolean;
  maxAttempts?: number;
  checkPromptId?: string;
  repairPromptId?: string;
};

export type OutputContractConfig = {
  schemaVersion?: string;
  schemaRef?: string;
};

export function getQualityLoopConfig(meta: unknown): QualityLoopConfig | null {
  if (!meta || typeof meta !== 'object') return null;
  const record = meta as Record<string, unknown>;
  const ql = record.qualityLoop;
  if (!ql || typeof ql !== 'object') return null;
  return ql as QualityLoopConfig;
}

export function getOutputContract(meta: unknown): OutputContractConfig | null {
  if (!meta || typeof meta !== 'object') return null;
  const record = meta as Record<string, unknown>;
  const oc = record.outputContract;
  if (!oc || typeof oc !== 'object') return null;
  return oc as OutputContractConfig;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

import {
  getOutputContract,
  getQualityLoopConfig,
  sha256,
} from './promptops-utils';

describe('promptops-utils', () => {
  it('sha256 should be stable', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abcd'));
  });

  it('getQualityLoopConfig should parse object', () => {
    expect(getQualityLoopConfig(null)).toBe(null);
    expect(getQualityLoopConfig({})).toBe(null);

    const cfg = getQualityLoopConfig({
      qualityLoop: {
        enable: true,
        maxAttempts: 2,
        checkPromptId: 'c1',
        repairPromptId: 'r1',
      },
    });
    expect(cfg?.enable).toBe(true);
    expect(cfg?.maxAttempts).toBe(2);
    expect(cfg?.checkPromptId).toBe('c1');
    expect(cfg?.repairPromptId).toBe('r1');
  });

  it('getOutputContract should parse object', () => {
    expect(getOutputContract(null)).toBe(null);
    expect(getOutputContract({})).toBe(null);

    const cfg = getOutputContract({
      outputContract: {
        schemaVersion: 'v1',
        schemaRef: 'PLAN@v1',
      },
    });
    expect(cfg?.schemaVersion).toBe('v1');
    expect(cfg?.schemaRef).toBe('PLAN@v1');
  });
});

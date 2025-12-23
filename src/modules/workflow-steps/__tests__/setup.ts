import 'reflect-metadata';

// Mock environment variables
process.env.OPENROUTER_API_KEY = 'test-api-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock external dependencies
jest.mock('ai', () => ({
  generateObject: jest.fn().mockResolvedValue({
    object: { test: 'mock-result' },
  }),
  createOpenAI: jest.fn().mockReturnValue({
    chat: jest.fn().mockReturnValue({
      completions: jest.fn(),
    }),
  }),
}));

jest.mock('fluent-ffmpeg', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    input: jest.fn().mockReturnThis(),
    inputFormat: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'end') callback();
      if (event === 'error') callback(null);
      return jest.fn().mockReturnThis();
    }),
    save: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('@ffmpeg-installer/ffmpeg', () => ({
  path: '/usr/bin/ffmpeg',
}));

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn().mockResolvedValue({}),
        waitForLoadState: jest.fn().mockResolvedValue({}),
        screenshot: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
      }),
      close: jest.fn().mockResolvedValue({}),
    }),
  },
}));

// Mock Bunny Storage
jest.mock('../../../utils/bunny-storage', () => ({
  uploadBufferToBunny: jest.fn().mockResolvedValue({
    publicUrl: 'https://test.bunnycdn.com/test-file',
    storageUrl: 'https://storage.bunnycdn.com/test-file',
  }),
  uploadJsonToBunny: jest.fn().mockResolvedValue({
    publicUrl: 'https://test.bunnycdn.com/test-file.json',
    storageUrl: 'https://storage.bunnycdn.com/test-file.json',
  }),
}));

// Mock promptops utils
jest.mock('../../../utils/promptops-utils', () => ({
  sha256: jest.fn().mockReturnValue('test-hash'),
  getOutputContract: jest.fn().mockReturnValue({}),
  getQualityLoopConfig: jest.fn().mockReturnValue({ enable: false }),
}));

// Global test utilities
global.createMockPrismaService = () => ({
  job: {
    upsert: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
  artifact: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
  approval: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
  },
  promptStageConfig: {
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
  promptStageActive: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
});

global.createMockPromptopsService = () => ({
  getActiveConfig: jest.fn().mockResolvedValue({
    id: 'test-config',
    model: 'z-ai/glm-4.6',

    prompt: 'Test prompt',
    tools: null,
    schema: null,
    meta: null,
  }),
  bootstrap: jest.fn().mockResolvedValue({
    activeConfig: {
      id: 'test-config',
      model: 'z-ai/glm-4.6',

      prompt: 'Test prompt',
      tools: null,
      schema: null,
      meta: null,
    },
  }),
  validateStepConfig: jest.fn().mockReturnValue({
    isValid: true,
    errors: [],
  }),
});

// Increase timeout for async operations
jest.setTimeout(30000);

// Console override to reduce noise in tests
const originalConsole = global.console;
beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});

export interface ServerEnv {
  port: number;
  dataDir: string;
  storageProvider: 'file' | 'sqlite';
  sqliteDbFile: string;
  videoProvider: 'stub' | 'seedance-http';
  deepseekApiKey?: string;
  deepseekBaseUrl: string;
  deepseekFlashModel: string;
  deepseekProModel: string;
  deepseekReasoningEffort: 'low' | 'medium' | 'high';
  deepseekThinkingEnabled: boolean;
  deepseekTimeoutMs: number;
  deepseekMaxRetries: number;
  seedanceApiKey?: string;
  seedanceBaseUrl?: string;
  seedanceCreatePath: string;
  seedanceStatusPathTemplate: string;
  seedanceModel: string;
  openaiApiKey?: string;
  openaiImageBaseUrl: string;
  openaiImageModel: string;
  firebaseProjectId?: string;
  demoStudentId: string;
  demoModeEnabled: boolean;
  authTestSecret?: string;
  agentJobPollMs: number;
}

export const getServerEnv = (): ServerEnv => ({
  port: parseBoundedNumber(process.env.MOBIUS_SERVER_PORT || process.env.PORT, 3000, 1, 65_535),
  dataDir: process.env.MOBIUS_DATA_DIR || 'server/data',
  storageProvider: process.env.MOBIUS_STORAGE_PROVIDER === 'file' ? 'file' : 'sqlite',
  sqliteDbFile: process.env.MOBIUS_SQLITE_DB_FILE || 'server/data/mobius.sqlite',
  videoProvider: process.env.MOBIUS_VIDEO_PROVIDER === 'seedance-http' ? 'seedance-http' : 'stub',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  deepseekFlashModel: process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-v4-flash',
  deepseekProModel: process.env.DEEPSEEK_PRO_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
  deepseekReasoningEffort: parseDeepSeekReasoningEffort(process.env.DEEPSEEK_REASONING_EFFORT),
  deepseekThinkingEnabled: process.env.DEEPSEEK_THINKING_ENABLED !== 'false',
  deepseekTimeoutMs: parseBoundedNumber(process.env.DEEPSEEK_TIMEOUT_MS, 30_000, 1000, 120_000),
  deepseekMaxRetries: parseBoundedNumber(process.env.DEEPSEEK_MAX_RETRIES, 1, 0, 3),
  seedanceApiKey: process.env.SEEDANCE_API_KEY,
  seedanceBaseUrl: process.env.SEEDANCE_BASE_URL,
  seedanceCreatePath: process.env.SEEDANCE_CREATE_PATH || '/v1/videos/generations',
  seedanceStatusPathTemplate: process.env.SEEDANCE_STATUS_PATH_TEMPLATE || '/v1/videos/generations/:jobId',
  seedanceModel: process.env.SEEDANCE_MODEL || 'seedance-1-0-lite',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiImageBaseUrl: process.env.OPENAI_IMAGE_BASE_URL || 'https://api.openai.com',
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
  firebaseProjectId: process.env.MOBIUS_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  demoStudentId: process.env.MOBIUS_DEMO_STUDENT_ID || 'demo-student',
  demoModeEnabled: parseDemoModeEnabled(process.env.MOBIUS_DEMO_MODE_ENABLED),
  authTestSecret: process.env.MOBIUS_AUTH_TEST_SECRET,
  agentJobPollMs: Number(process.env.MOBIUS_AGENT_JOB_POLL_MS || 1500),
});

const parseDeepSeekReasoningEffort = (value: string | undefined): 'low' | 'medium' | 'high' => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'high';
};

const parseBoundedNumber = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const parseDemoModeEnabled = (value: string | undefined): boolean => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return process.env.NODE_ENV !== 'production';
};

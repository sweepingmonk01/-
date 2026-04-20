export interface ServerEnv {
  port: number;
  dataDir: string;
  storageProvider: 'file' | 'sqlite';
  sqliteDbFile: string;
  videoProvider: 'stub' | 'seedance-http';
  geminiApiKey?: string;
  seedanceApiKey?: string;
  seedanceBaseUrl?: string;
  seedanceCreatePath: string;
  seedanceStatusPathTemplate: string;
  seedanceModel: string;
}

export const getServerEnv = (): ServerEnv => ({
  port: Number(process.env.MOBIUS_SERVER_PORT || process.env.PORT || 8787),
  dataDir: process.env.MOBIUS_DATA_DIR || 'server/data',
  storageProvider: process.env.MOBIUS_STORAGE_PROVIDER === 'file' ? 'file' : 'sqlite',
  sqliteDbFile: process.env.MOBIUS_SQLITE_DB_FILE || 'server/data/mobius.sqlite',
  videoProvider: process.env.MOBIUS_VIDEO_PROVIDER === 'seedance-http' ? 'seedance-http' : 'stub',
  geminiApiKey: process.env.GEMINI_API_KEY,
  seedanceApiKey: process.env.SEEDANCE_API_KEY,
  seedanceBaseUrl: process.env.SEEDANCE_BASE_URL,
  seedanceCreatePath: process.env.SEEDANCE_CREATE_PATH || '/v1/videos/generations',
  seedanceStatusPathTemplate: process.env.SEEDANCE_STATUS_PATH_TEMPLATE || '/v1/videos/generations/:jobId',
  seedanceModel: process.env.SEEDANCE_MODEL || 'seedance-1-0-lite',
});

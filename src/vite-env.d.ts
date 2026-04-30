interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_AI_DIAGNOSIS_CLIENT?: 'mock' | 'http';
  readonly VITE_AI_DIAGNOSIS_ENDPOINT?: string;
  readonly VITE_EXPLORE_API_BASE?: string;
  readonly VITE_EXPLORE_SYNC_CLIENT?: string;
  readonly VITE_EXPLORE_SYNC_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

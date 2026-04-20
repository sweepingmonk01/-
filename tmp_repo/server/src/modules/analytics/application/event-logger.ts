export interface EventLogger {
  track(input: {
    name: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}

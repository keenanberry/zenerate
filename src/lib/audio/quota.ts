export type QuotaConfig = {
  perUserCap: number;
  globalCap: number;
};

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer (got "${raw}")`);
  }
  return parsed;
}

export function getQuotaConfig(): QuotaConfig {
  return {
    perUserCap: readPositiveInt("PER_USER_MONTHLY_AUDIO_LIMIT", 3),
    globalCap: readPositiveInt("MAX_GLOBAL_AUDIO_GENERATIONS_PER_MONTH", 500),
  };
}

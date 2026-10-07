// All credentials come from the environment — nothing hardcoded.
export const config = {
  apiKey: process.env.API_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://localhost:5432/app',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};

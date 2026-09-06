export const settings = {
  httpPort: Number(process.env.HTTP_PORT || 6080),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://propfirm:propfirm_dev@127.0.0.1:15433/propfirm',
  jwtKey: process.env.JWT_KEY || 'propfirm-dev-signing-key-32chars!!',
  jwtIssuer: process.env.JWT_ISSUER || 'propfirm',
  jwtAudience: process.env.JWT_AUDIENCE || 'propfirm-clients',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3100',
  smtpHost: process.env.SMTP_HOST || '127.0.0.1',
  smtpPort: Number(process.env.SMTP_PORT || 2525),
  smtpFrom: process.env.SMTP_FROM || 'noreply@propfirm.local',
};

export function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'propfirm',
  };
}

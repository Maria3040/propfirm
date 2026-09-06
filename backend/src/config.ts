export const settings = {
  httpPort: Number(process.env.HTTP_PORT || 6080),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://propfirm:propfirm_dev@127.0.0.1:15433/propfirm',
  jwtKey: process.env.JWT_KEY || 'propfirm-dev-signing-key-32chars!!',
  jwtIssuer: process.env.JWT_ISSUER || 'propfirm',
  jwtAudience: process.env.JWT_AUDIENCE || 'propfirm-clients',
  /** Comma-separated browser origins (localhost vs 127.0.0.1 both needed). */
  corsOrigin:
    process.env.CORS_ORIGIN || 'http://localhost:3100,http://127.0.0.1:3100',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'propfirm_access',
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

export interface AppConfig {
  app: {
    nodeEnv: string;
    isProduction: boolean;
    port: number;
    apiPrefix: string;
    frontendUrl: string;
    trustedOrigins: string[];
    uploadDir: string;
    maxFileSize: number;
  };
  auth: {
    secret: string;
    baseUrl: string;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    enabled: boolean;
  };
}

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const splitCsv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default (): AppConfig => {
  const env = process.env;
  const frontendUrl = env.FRONTEND_URL ?? 'http://localhost:3000';
  const trustedOrigins = Array.from(new Set([frontendUrl, ...splitCsv(env.TRUSTED_ORIGINS)]));
  const mailHost = env.SMTP_HOST ?? '';
  const mailUser = env.SMTP_USER ?? '';
  const mailPass = env.SMTP_PASS ?? '';

  return {
    app: {
      nodeEnv: env.NODE_ENV ?? 'development',
      isProduction: env.NODE_ENV === 'production',
      port: toNumber(env.PORT, 4000),
      apiPrefix: env.API_PREFIX ?? 'api/v1',
      frontendUrl,
      trustedOrigins,
      uploadDir: env.UPLOAD_DIR ?? 'uploads',
      maxFileSize: toNumber(env.MAX_FILE_SIZE, 5 * 1024 * 1024),
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET ?? '',
      baseUrl: env.BETTER_AUTH_URL ?? `http://localhost:${toNumber(env.PORT, 4000)}`,
    },
    mail: {
      host: mailHost,
      port: toNumber(env.SMTP_PORT, 587),
      secure: env.SMTP_SECURE === 'true',
      user: mailUser,
      pass: mailPass,
      from: env.EMAIL_FROM ?? 'Tabark <no-reply@tabark.local>',
      enabled: Boolean(mailHost && mailUser && mailPass),
    },
  };
};

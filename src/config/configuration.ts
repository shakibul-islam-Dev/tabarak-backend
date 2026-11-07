import { join } from 'node:path';
import { tmpdir } from 'node:os';

export type UploadDriver = 'local' | 'vercel-blob';
export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface AppConfig {
  app: {
    nodeEnv: string;
    isProduction: boolean;
    isVercel: boolean;
    port: number;
    apiPrefix: string;
    frontendUrl: string;
    trustedOrigins: string[];
    uploadDir: string;
    uploadDriver: UploadDriver;
    maxFileSize: number;
  };
  auth: {
    secret: string;
    baseUrl: string;
    cookieSameSite: CookieSameSite;
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

const uploadDriver = (env: NodeJS.ProcessEnv, isVercel: boolean): UploadDriver => {
  const explicit = env.UPLOAD_DRIVER?.trim().toLowerCase();

  if (explicit === 'vercel-blob' || explicit === 'local') {
    return explicit;
  }

  // On Vercel, a connected Blob store injects BLOB_READ_WRITE_TOKEN. Prefer
  // durable object storage automatically so uploads survive cold starts.
  return isVercel && Boolean(env.BLOB_READ_WRITE_TOKEN) ? 'vercel-blob' : 'local';
};

export default (): AppConfig => {
  const env = process.env;
  const isVercel = Boolean(env.VERCEL);
  const frontendUrl = env.FRONTEND_URL ?? 'http://localhost:3000';
  const trustedOrigins = Array.from(new Set([frontendUrl, ...splitCsv(env.TRUSTED_ORIGINS)]));
  const mailHost = env.SMTP_HOST ?? '';
  const mailUser = env.SMTP_USER ?? '';
  const mailPass = env.SMTP_PASS ?? env.SMTP_PASSWORD ?? '';
  // Vercel's only writable path is /tmp, and it is not shared between
  // instances. This fallback keeps local-disk mode usable for smoke tests,
  // but durable uploads on Vercel require UPLOAD_DRIVER=vercel-blob.
  const defaultUploadDir = isVercel ? join(tmpdir(), 'tabark-uploads') : 'uploads';

  return {
    app: {
      nodeEnv: env.NODE_ENV ?? 'development',
      isProduction: env.NODE_ENV === 'production',
      isVercel,
      port: toNumber(env.PORT, 4000),
      apiPrefix: env.API_PREFIX ?? 'api/v1',
      frontendUrl,
      trustedOrigins,
      uploadDir: env.UPLOAD_DIR ?? defaultUploadDir,
      uploadDriver: uploadDriver(env, isVercel),
      maxFileSize: toNumber(env.MAX_FILE_SIZE, 5 * 1024 * 1024),
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET ?? '',
      baseUrl:
        env.BETTER_AUTH_URL ??
        (env.VERCEL_URL
          ? `https://${env.VERCEL_URL}`
          : `http://localhost:${toNumber(env.PORT, 4000)}`),
      cookieSameSite: (env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase() ?? 'lax') as CookieSameSite,
    },
    mail: {
      host: mailHost,
      port: toNumber(env.SMTP_PORT, 587),
      secure: env.SMTP_SECURE === 'true',
      user: mailUser,
      pass: mailPass,
      from: env.EMAIL_FROM ?? env.SMTP_FROM ?? 'Tabark <no-reply@tabark.local>',
      enabled: Boolean(mailHost && mailUser && mailPass),
    },
  };
};

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

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

/**
 * Vercel exposes the deployment hosts without a protocol. They are added to
 * the trusted origins so preview deployments can use the API and Better Auth
 * cookies without extra configuration.
 */
const vercelOrigins = (env: NodeJS.ProcessEnv): string[] =>
  [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => (host.startsWith('http') ? host : `https://${host}`));

const vercelBaseUrl = (env: NodeJS.ProcessEnv): string | undefined => {
  const host = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  return host ? (host.startsWith('http') ? host : `https://${host}`) : undefined;
};

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
  const trustedOrigins = Array.from(
    new Set(
      [frontendUrl, ...vercelOrigins(env), ...splitCsv(env.TRUSTED_ORIGINS)].map(trimTrailingSlash),
    ),
  );
  const mailHost = env.SMTP_HOST ?? '';
  const mailUser = env.SMTP_USER ?? '';
  const mailPass = env.SMTP_PASS ?? env.SMTP_PASSWORD ?? '';
  // Vercel's only writable path is /tmp, and it is not shared between
  // instances. This fallback keeps local-disk mode usable for smoke tests,
  // but durable uploads on Vercel require UPLOAD_DRIVER=vercel-blob.
  const defaultUploadDir = isVercel ? join(tmpdir(), 'tabarak-uploads') : 'uploads';

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
      // Vercel Functions reject request bodies above 4.5 MB before the app is
      // invoked, so keep the default below that limit on Vercel.
      maxFileSize: toNumber(env.MAX_FILE_SIZE, isVercel ? 4 * 1024 * 1024 : 5 * 1024 * 1024),
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET ?? '',
      baseUrl: trimTrailingSlash(
        env.BETTER_AUTH_URL ?? vercelBaseUrl(env) ?? `http://localhost:${toNumber(env.PORT, 4000)}`,
      ),
      cookieSameSite: (env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase() ?? 'lax') as CookieSameSite,
    },
    mail: {
      host: mailHost,
      port: toNumber(env.SMTP_PORT, 587),
      secure: env.SMTP_SECURE === 'true',
      user: mailUser,
      pass: mailPass,
      from: env.EMAIL_FROM ?? env.SMTP_FROM ?? 'tabarak <no-reply@tabarak.local>',
      enabled: Boolean(mailHost && mailUser && mailPass),
    },
  };
};

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import configuration from './configuration';

const MANAGED_KEYS = [
  'NODE_ENV',
  'PORT',
  'API_PREFIX',
  'FRONTEND_URL',
  'TRUSTED_ORIGINS',
  'BETTER_AUTH_URL',
  'AUTH_COOKIE_SAME_SITE',
  'UPLOAD_DRIVER',
  'UPLOAD_DIR',
  'BLOB_READ_WRITE_TOKEN',
  'MAX_FILE_SIZE',
  'VERCEL',
  'VERCEL_URL',
  'VERCEL_BRANCH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
] as const;

describe('configuration', () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of MANAGED_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of MANAGED_KEYS) {
      const value = saved.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('uses local development defaults', () => {
    const config = configuration();

    expect(config.app.isVercel).toBe(false);
    expect(config.app.uploadDriver).toBe('local');
    expect(config.app.maxFileSize).toBe(5 * 1024 * 1024);
    expect(config.app.trustedOrigins).toEqual(['http://localhost:3000']);
    expect(config.auth.baseUrl).toBe('http://localhost:4000');
    expect(config.auth.cookieSameSite).toBe('lax');
  });

  it('selects Blob storage and a safe upload limit on Vercel', () => {
    process.env.VERCEL = '1';
    process.env.VERCEL_URL = 'tabarak-abc123.vercel.app';
    process.env.VERCEL_BRANCH_URL = 'tabarak-git-main.vercel.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'tabarak.vercel.app';
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token';
    process.env.FRONTEND_URL = 'https://tabarak.com/';
    process.env.TRUSTED_ORIGINS = 'https://admin.tabarak.com/, https://extra.example';

    const config = configuration();

    expect(config.app.isVercel).toBe(true);
    expect(config.app.uploadDriver).toBe('vercel-blob');
    expect(config.app.uploadDir).toBe(join(tmpdir(), 'tabarak-uploads'));
    expect(config.app.maxFileSize).toBe(4 * 1024 * 1024);
    expect(config.app.trustedOrigins).toEqual(
      expect.arrayContaining([
        'https://tabarak.com',
        'https://admin.tabarak.com',
        'https://extra.example',
        'https://tabarak-abc123.vercel.app',
        'https://tabarak-git-main.vercel.app',
        'https://tabarak.vercel.app',
      ]),
    );
    expect(config.auth.baseUrl).toBe('https://tabarak.vercel.app');
  });

  it('prefers an explicit auth URL and cookie policy', () => {
    process.env.VERCEL = '1';
    process.env.VERCEL_URL = 'tabarak-abc123.vercel.app';
    process.env.BETTER_AUTH_URL = 'https://api.tabarak.com/';
    process.env.AUTH_COOKIE_SAME_SITE = 'none';

    const config = configuration();

    expect(config.auth.baseUrl).toBe('https://api.tabarak.com');
    expect(config.auth.cookieSameSite).toBe('none');
  });

  it('honours an explicit local upload driver even when Blob is configured', () => {
    process.env.VERCEL = '1';
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token';
    process.env.UPLOAD_DRIVER = 'local';
    process.env.UPLOAD_DIR = '/var/tabarak/uploads';

    const config = configuration();

    expect(config.app.uploadDriver).toBe('local');
    expect(config.app.uploadDir).toBe('/var/tabarak/uploads');
  });

  it('falls back to local disk on Vercel when no Blob token is present', () => {
    process.env.VERCEL = '1';

    const config = configuration();

    expect(config.app.uploadDriver).toBe('local');
    expect(config.app.uploadDir).toBe(join(tmpdir(), 'tabarak-uploads'));
  });
});

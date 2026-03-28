import fs from 'fs';
import path from 'path';

const defaultUploadsDir = path.resolve(__dirname, '..', '..', 'data', 'uploads');

export function getUploadsRootDir(): string {
  const configuredDir = process.env.UPLOADS_DIR;
  if (!configuredDir) return defaultUploadsDir;
  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.resolve(process.cwd(), configuredDir);
}

export function getUploadsSubdirPath(subfolder: string): string {
  return path.join(getUploadsRootDir(), subfolder);
}

export function ensureUploadsDirExists(): void {
  fs.mkdirSync(getUploadsRootDir(), { recursive: true });
}

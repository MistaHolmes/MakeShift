import { prisma } from './config/prisma';
import { s3 } from './config/s3';
import { ListBucketsCommand } from '@aws-sdk/client-s3';

export async function runPreBootChecks() {
  console.log('[INFO] Running pre-boot system checks...');

  // 1. Check ENVs
  const requiredEnvs = [
    'DATABASE_URL',
    'ELEVENLABS_API_KEY',
    'R2_ENDPOINT',
    'R2_PUBLIC_URL',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY'
  ];

  let missingEnvs = false;
  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      console.error(`[ERROR] Missing required environment variable: ${env}`);
      missingEnvs = true;
    }
  }
  
  if (missingEnvs) {
    process.exit(1);
  }
  
  console.log('[INFO] All required environment variables are loaded.');

  // 2. Check DB Connection
  try {
    // A simple query to ensure DB is reachable
    await prisma.$queryRaw`SELECT 1`;
    console.log('[INFO] Database connected successfully.');
  } catch (error) {
    console.error('[ERROR] Database connection failed:', error);
    process.exit(1);
  }

  // 3. Check ElevenLabs Access
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! }
    });
    if (!response.ok) {
      throw new Error(`Invalid API Key or API unreachable (Status: ${response.status})`);
    }
    console.log('[INFO] ElevenLabs API is accessible.');
  } catch (error) {
    console.error('[ERROR] ElevenLabs check failed:', error);
    process.exit(1);
  }

  // 4. Check R2 Access (Optional but recommended)
  try {
    await s3.send(new ListBucketsCommand({}));
    console.log('[INFO] Cloudflare R2 is accessible.');
  } catch (error) {
    console.warn('[WARN] Cloudflare R2 check failed (Permissions might be bucket-specific):', (error as any).message);
  }

  console.log('[INFO] System pre-boot checks passed.');
}

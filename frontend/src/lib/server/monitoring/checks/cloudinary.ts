// Admin monitoring — Cloudinary check. Uses the Admin API's `ping` resource
// (verified present in the installed `cloudinary` SDK's type defs) —
// zero side effects, no file is uploaded or touched, unlike a real upload
// probe would be.
import 'server-only';
import { v2 as cloudinary } from 'cloudinary';
import { withTimeout, errorMessage, sanitizeCheckError } from '../sanitize';
import type { CheckResult } from '../types';

export async function checkCloudinary(): Promise<CheckResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      ok: false,
      unverified: true,
      latencyMs: 0,
      error: 'CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not configured',
    };
  }

  const t0 = Date.now();
  try {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    await withTimeout(cloudinary.api.ping());
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: sanitizeCheckError(errorMessage(err)),
    };
  }
}

import type { PagesFunction } from '@cloudflare/workers-types';

/**
 * Admin Images Page - Basic Auth Protection
 *
 * This function protects the /admin/images page with HTTP Basic Authentication.
 * Credentials are checked against environment variables:
 * - ADMIN_USERNAME (default: admin)
 * - ADMIN_PASSWORD (default: changeme)
 *
 * To set credentials in production:
 * npx wrangler pages secret put ADMIN_USERNAME
 * npx wrangler pages secret put ADMIN_PASSWORD
 */

export const onRequest: PagesFunction<{
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
}> = async (context) => {
  const { request, env, next } = context;

  // Get credentials from environment variables with defaults
  const validUsername = env.ADMIN_USERNAME || 'admin';
  const validPassword = env.ADMIN_PASSWORD || 'admin123';

  // Check Authorization header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  // Decode credentials
  const base64Credentials = authHeader.slice(6); // Remove "Basic "
  let credentials: string;

  try {
    credentials = atob(base64Credentials);
  } catch {
    return unauthorizedResponse();
  }

  const [username, password] = credentials.split(':');

  // Validate credentials (timing-safe comparison)
  const isValidUsername = await timingSafeEqual(username, validUsername);
  const isValidPassword = await timingSafeEqual(password, validPassword);

  if (!isValidUsername || !isValidPassword) {
    return unauthorizedResponse();
  }

  // Credentials valid, proceed to the page
  return next();
};

/**
 * Return 401 Unauthorized response
 */
function unauthorizedResponse(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Area"',
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) {
    // Still compare to avoid leaking length info, but with a dummy value
    const encoder = new TextEncoder();
    const aBuf = encoder.encode(a);
    const bBuf = encoder.encode(b);

    // Use SubtleCrypto for constant-time comparison
    try {
      await crypto.subtle.digest('SHA-256', new Uint8Array(Math.max(aBuf.length, bBuf.length)));
    } catch {
      // Ignore
    }
    return false;
  }

  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  // Use SubtleCrypto to compare in constant time
  try {
    const aHash = await crypto.subtle.digest('SHA-256', aBuf);
    const bHash = await crypto.subtle.digest('SHA-256', bBuf);

    const aArray = new Uint8Array(aHash);
    const bArray = new Uint8Array(bHash);

    let result = 0;
    for (let i = 0; i < aArray.length; i++) {
      result |= aArray[i] ^ bArray[i];
    }

    return result === 0;
  } catch {
    // Fallback to simple comparison (less secure but functional)
    return a === b;
  }
}

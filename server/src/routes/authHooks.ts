import express, { Router } from 'express';
import type { SmsSender } from '../modules/auth/application/sms-sender.js';
import {
  parseSmsHookSecret,
  SmsHookError,
  verifyAndParseSmsHook,
} from '../modules/auth/application/verify-supabase-sms-hook.js';

interface SmsHookRouterOptions {
  /** Supabase Send-SMS hook secret (`v1,whsec_...`). When absent the hook is disabled. */
  hookSecret?: string;
  sender: SmsSender;
}

// A request authenticated by an invalid/expired signature or missing secret.
const UNAUTHORIZED_CODES = new Set([
  'headers_missing',
  'timestamp_invalid',
  'timestamp_out_of_tolerance',
  'signature_mismatch',
]);

/**
 * Supabase "Send SMS" auth hook receiver. Supabase calls this endpoint with the
 * generated OTP; we authenticate the call by its webhook signature and relay the
 * code through the configured SMS gateway. Mounted outside the bearer-auth
 * middleware and with its own raw body parser (the signature covers raw bytes).
 */
export const createSmsHookRouter = ({ hookSecret, sender }: SmsHookRouterOptions) => {
  const router = Router();

  router.post('/send-sms', express.raw({ type: '*/*', limit: '64kb' }), async (req, res) => {
    if (!hookSecret) {
      res.status(503).json({ error: { message: 'SMS hook is not configured.' } });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

    let parsed;
    try {
      parsed = verifyAndParseSmsHook({
        secret: parseSmsHookSecret(hookSecret),
        headers: {
          id: req.header('webhook-id'),
          timestamp: req.header('webhook-timestamp'),
          signature: req.header('webhook-signature'),
        },
        rawBody,
      });
    } catch (error) {
      if (error instanceof SmsHookError) {
        const status = UNAUTHORIZED_CODES.has(error.code) ? 401 : 400;
        res.status(status).json({ error: { message: error.message } });
        return;
      }
      throw error;
    }

    try {
      await sender.sendOtp({ phone: parsed.phone, otp: parsed.otp });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SMS delivery failed.';
      console.warn('[auth.sms-hook] delivery failed', message);
      res.status(502).json({ error: { message: 'SMS delivery failed.', http_code: 502 } });
      return;
    }

    res.status(200).json({});
  });

  return router;
};

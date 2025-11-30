import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { SECURITY_CONFIG } from '../config/security';

const { issuer } = SECURITY_CONFIG.twoFactor;

export interface TOTPSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
}

export async function generateTOTPSecret(email: string): Promise<TOTPSetupResult> {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const otpauthUrl = totp.toString();

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return {
    secret,
    qrCodeDataUrl,
    manualEntryKey: secret,
  };
}

export function verifyTOTPCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Allow 1 period window (30 seconds) in either direction
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

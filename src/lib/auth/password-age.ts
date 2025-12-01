import { SECURITY_CONFIG } from '@/lib/config/security';

export interface PasswordAgeStatus {
  isExpired: boolean;
  isWarning: boolean;
  daysUntilExpiry: number;
  daysSinceChange: number;
}

/**
 * Check the age of a user's password and determine if it needs to be changed
 * @param passwordChangedAt - When the password was last changed
 * @returns Status object with expiry information
 */
export function checkPasswordAge(passwordChangedAt: Date | null): PasswordAgeStatus {
  const { maxAgeDays, warningDays } = SECURITY_CONFIG.passwordPolicy;

  // If no password change date, treat as very old (needs change)
  if (!passwordChangedAt) {
    return {
      isExpired: true,
      isWarning: true,
      daysUntilExpiry: 0,
      daysSinceChange: maxAgeDays + 1,
    };
  }

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceChange = Math.floor((now.getTime() - passwordChangedAt.getTime()) / msPerDay);
  const daysUntilExpiry = maxAgeDays - daysSinceChange;

  return {
    isExpired: daysSinceChange >= maxAgeDays,
    isWarning: daysUntilExpiry <= warningDays && daysUntilExpiry > 0,
    daysUntilExpiry: Math.max(0, daysUntilExpiry),
    daysSinceChange,
  };
}

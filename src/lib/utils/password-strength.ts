export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4; // 0 = very weak, 4 = very strong
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
  suggestions: string[];
  requirements: PasswordRequirement[];
}

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

const COMMON_PASSWORDS = [
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  'letmein',
  'dragon',
  '111111',
  'baseball',
  'iloveyou',
  'trustno1',
  'sunshine',
  'master',
  'welcome',
  'shadow',
  'ashley',
  'football',
  'jesus',
  'michael',
  'ninja',
  'password1',
  'password123',
  'admin',
  'admin123',
  'root',
  'toor',
  'pass',
];

export function calculatePasswordStrength(password: string): PasswordStrength {
  const requirements: PasswordRequirement[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains number', met: /[0-9]/.test(password) },
    {
      label: 'Contains special character',
      met: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    },
  ];

  const suggestions: string[] = [];
  let score: 0 | 1 | 2 | 3 | 4 = 0;

  // Empty password
  if (!password) {
    return {
      score: 0,
      label: 'Very Weak',
      color: 'bg-gray-200',
      suggestions: ['Enter a password'],
      requirements,
    };
  }

  // Check for common passwords
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return {
      score: 0,
      label: 'Very Weak',
      color: 'bg-red-500',
      suggestions: [
        'This is a commonly used password. Please choose something unique.',
      ],
      requirements,
    };
  }

  // Calculate base score from requirements
  const metRequirements = requirements.filter((r) => r.met).length;
  let rawScore = Math.min(metRequirements, 4);

  // Bonus for longer passwords
  if (password.length >= 12) rawScore = Math.min(rawScore + 1, 4);
  if (password.length >= 16) rawScore = Math.min(rawScore + 1, 4);

  // Penalty for patterns
  if (/(.)\1{2,}/.test(password)) {
    rawScore = Math.max(rawScore - 1, 0);
    suggestions.push('Avoid repeating characters');
  }

  if (/^[a-zA-Z]+$/.test(password)) {
    rawScore = Math.max(rawScore - 1, 0);
  }

  if (/^[0-9]+$/.test(password)) {
    rawScore = Math.max(rawScore - 1, 0);
  }

  // Sequential characters penalty
  if (
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      password
    )
  ) {
    rawScore = Math.max(rawScore - 1, 0);
    suggestions.push('Avoid sequential characters like "abc" or "123"');
  }

  // Clamp score to valid range
  score = Math.max(0, Math.min(4, rawScore)) as 0 | 1 | 2 | 3 | 4;

  // Add suggestions based on unmet requirements
  if (!requirements[0].met) suggestions.push('Make it at least 8 characters');
  if (!requirements[1].met) suggestions.push('Add an uppercase letter');
  if (!requirements[2].met) suggestions.push('Add a lowercase letter');
  if (!requirements[3].met) suggestions.push('Add a number');
  if (!requirements[4].met)
    suggestions.push('Add a special character (!@#$%^&*)');

  if (password.length < 12 && score < 4) {
    suggestions.push('Consider making it longer (12+ characters)');
  }

  const labels: Record<number, PasswordStrength['label']> = {
    0: 'Very Weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Strong',
    4: 'Very Strong',
  };

  const colors: Record<number, string> = {
    0: 'bg-red-500',
    1: 'bg-orange-500',
    2: 'bg-yellow-500',
    3: 'bg-lime-500',
    4: 'bg-green-500',
  };

  return {
    score,
    label: labels[score],
    color: colors[score],
    suggestions: suggestions.slice(0, 3), // Limit to 3 suggestions
    requirements,
  };
}

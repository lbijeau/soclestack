export interface DeviceInfo {
  browser: string;
  os: string;
}

export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown' };
  }

  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect browser (order matters - check more specific first)
  if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  return { browser, os };
}

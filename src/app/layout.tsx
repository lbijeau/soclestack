import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ImpersonationBannerWrapper } from '@/components/admin/impersonation-banner-wrapper';
import { SessionTimeoutWarning } from '@/components/session/session-timeout-warning';
import { getBranding, getLayout } from '@/lib/branding';
import { darken, lighten } from '@/lib/color-utils';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = getBranding();
  return {
    title: `${branding.name} - User Management`,
    description: `${branding.name} - Enterprise-grade user management`,
    icons: {
      icon: branding.faviconUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = getBranding();
  const layout = getLayout();

  const brandStyles = {
    '--brand-primary': branding.primaryColor,
    '--brand-primary-hover': darken(branding.primaryColor, 10),
    '--brand-primary-light': lighten(branding.primaryColor, 40),
  } as React.CSSProperties;

  return (
    <html lang="en" style={brandStyles}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        data-density={layout.density}
      >
        <ImpersonationBannerWrapper />
        {children}
        <SessionTimeoutWarning />
      </body>
    </html>
  );
}

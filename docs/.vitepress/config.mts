import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: "SocleStack",
    description: "Enterprise-grade Next.js User Management System",
    base: '/soclestack/',
    cleanUrls: true,
    ignoreDeadLinks: 'localhostLinks',
    themeConfig: {
      logo: '/logo.svg',
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Guide', link: '/PROGRESS' },
        { text: 'Architecture', link: '/TECHNICAL_ARCHITECTURE' }
      ],
      sidebar: [
        {
          text: 'Getting Started',
          items: [
            { text: 'Progress', link: '/PROGRESS' },
            { text: 'Documentation Status', link: '/DOCUMENTATION_STATUS' },
            { text: 'Environment Variables', link: '/ENVIRONMENT' },
          ]
        },
              {
                text: 'Architecture',
                items: [
                  { text: 'Technical Architecture', link: '/TECHNICAL_ARCHITECTURE' },
                  { text: 'Database Schema', link: '/DATABASE' },
                  { text: 'Migrations', link: '/MIGRATIONS' },
                ]
              },
                    {
                      text: 'API',
                      items: [
                        { text: 'API Reference', link: '/API_REFERENCE' },
                      ]
                    },
                    {
                      text: 'Library',
                      items: [
                        { text: 'Modules', link: '/api-generated/modules' },
                        { text: 'Auth', link: '/api-generated/lib/auth/README' },
                        { text: 'Security', link: '/api-generated/lib/security/README' },
                        { text: 'Database', link: '/api-generated/lib/db/README' },
                      ]
                    },
                    {
                      text: 'Testing',
                        items: [
            { text: 'Overview', link: '/testing/README' },
            { text: 'Strategy', link: '/testing/TEST-STRATEGY' },
          ]
        },
        {
          text: 'Design Plans',
          collapsed: true,
          items: [
            { text: 'API Keys', link: '/plans/2025-11-30-api-keys-design' },
            { text: 'Audit Log Viewer', link: '/plans/2025-11-30-audit-log-viewer-design' },
            { text: 'Email Notifications', link: '/plans/2025-11-30-email-notifications-design' },
            { text: 'OAuth Social Login', link: '/plans/2025-11-30-oauth-social-login-design' },
            { text: 'Organizations', link: '/plans/2025-11-30-organizations-design' },
            { text: 'Security UX Hardening', link: '/plans/2025-11-30-security-ux-hardening-design' },
            { text: 'Two-Factor Auth', link: '/plans/2025-11-30-two-factor-auth-design' },
            { text: 'User Impersonation', link: '/plans/2025-11-30-user-impersonation-design' },
            { text: 'Konsole LCB Profile', link: '/plans/2026-01-01-konsole-lcb-profile-design' },
          ]
        }
      ],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/lbijeau/soclestack' }
      ]
    }
  })
)

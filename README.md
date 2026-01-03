# SocleStack - Next.js User Management Application

> **Warning**
> **NOT PRODUCTION READY** - This project is under active development and has known security vulnerabilities and incomplete implementations. Do not deploy to production without addressing critical issues documented in the GitHub issues.

[![Status](https://img.shields.io/badge/status-development-orange)](#known-limitations)
[![Security](https://img.shields.io/badge/security-needs%20review-red)](#known-limitations)

A complete Next.js 14 application with Enterprise-grade user management features, built with TypeScript, Prisma, and modern React components. "SocleStack" is the foundational block upon which your SaaS application is built.

## Features

### 🔐 Complete Authentication System
- User registration with email verification
- Secure login/logout functionality
- Password reset workflow
- Session management with iron-session
- JWT tokens for API authentication

### 👥 Role-Based Access Control
- Three user roles: USER, MODERATOR, ADMIN
- Protected routes and middleware
- Role-based UI components
- Permission hierarchy system

### 🛡️ Security Features
- Password hashing with bcrypt
- Rate limiting on authentication endpoints (in-memory - not production ready)
- CSRF token generation (validation not yet implemented)
- Input validation with Zod
- Security headers and CSP (needs hardening)
- Password history tracking

> **Note**: See [Known Limitations](#known-limitations) for security issues that need to be addressed before production use.

### 📱 Modern UI/UX
- Responsive design with Tailwind CSS
- Beautiful dashboard with "Hello World" content
- User profile management
- Admin panel for user management
- Form validation and error handling

## Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** iron-session + JWT
- **Styling:** Tailwind CSS
- **UI Components:** Custom components with Lucide React icons
- **Validation:** Zod
- **Security:** bcryptjs, rate limiting, security headers

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone and install dependencies:**
```bash
git clone https://github.com/yourusername/soclestack.git
cd soclestack
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Update `.env.local` with your configuration:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/soclestack"

# JWT Secrets (change these in production!)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"

# Session Secret
SESSION_SECRET="your-super-secret-session-key-change-this-in-production"

# App Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-change-this-in-production"

# Security
CSRF_SECRET="your-csrf-secret-change-this-in-production"
```

3. **Set up the database:**
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# (Optional) Seed the database
npx prisma db seed
```

4. **Start the development server:**
```bash
npm run dev
```

5. **Open your browser:**
Visit [http://localhost:3000](http://localhost:3000)

## Usage

### User Registration & Authentication

1. **Register a new account** at `/register`
2. **Verify your email** (check console logs for verification token in development)
3. **Log in** at `/login`
4. **Access your dashboard** at `/dashboard`

### Admin Features

1. **Create an admin user** by directly updating the database:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your-email@example.com';
```

2. **Access admin panel** at `/admin` (Admin/Moderator only)
3. **Manage users:** view, edit roles, activate/deactivate, delete

### User Management

- **Profile management** at `/profile`
- **Change password** with security checks
- **View account information** and session details

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### User Management
- `GET /api/users` - List users (Moderator+)
- `GET /api/users/[id]` - Get user details
- `PATCH /api/users/[id]` - Update user role/status (Admin)
- `DELETE /api/users/[id]` - Delete user (Admin)
- `PATCH /api/users/profile` - Update profile/password

## Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Protected dashboard
│   ├── profile/           # User profile management
│   ├── admin/            # Admin panel
│   └── (auth)/           # Authentication pages
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── auth/             # Authentication forms
│   ├── admin/            # Admin panel components
│   └── navigation/       # Navigation components
├── lib/                  # Utility libraries
│   ├── auth.ts           # Authentication utilities
│   ├── security.ts       # Security functions
│   ├── validations.ts    # Zod validation schemas
│   └── db.ts            # Database connection
├── types/                # TypeScript type definitions
└── middleware.ts         # Next.js middleware
```

## Security Features

### Password Security
- Minimum 8 characters with complexity requirements
- bcrypt hashing with salt rounds
- Password history tracking (prevents reuse of last 3 passwords)
- Secure password reset flow

### Session Security
- iron-session for encrypted session cookies
- JWT tokens with short expiration (15 minutes)
- Refresh token rotation
- Session cleanup on password change

### Rate Limiting
- Login attempts: 5 per 15 minutes per IP
- Registration: 3 per hour per IP
- Password reset: 3 per hour per IP

### Additional Security
- CSRF protection
- XSS protection with security headers
- Input sanitization
- SQL injection prevention with Prisma
- Time-safe string comparison

## Development

### Database Management
```bash
# View database in Prisma Studio
npx prisma studio

# Reset database
npx prisma db push --force-reset

# Generate new migration
npx prisma migrate dev --name description
```

### Testing
```bash
# Run type checking
npm run build

# Run linting
npm run lint
```

## Known Limitations

> **Warning**: The following issues must be addressed before production deployment.

### Critical Security Issues

| Issue | Status | Description |
|-------|--------|-------------|
| CSP Policy | Needs Fix | `unsafe-eval` and `unsafe-inline` defeat XSS protection |
| CSRF Protection | Incomplete | Tokens generated but never validated |
| Rate Limiting | In-Memory | Lost on restart; doesn't scale horizontally |
| Database | SQLite | Cannot handle concurrent writes; use PostgreSQL |
| Fallback Secrets | Insecure | Hardcoded fallbacks if env vars missing |

### Incomplete Features

| Feature | Status | Description |
|---------|--------|-------------|
| Email System | TODO | Verification and password reset emails not sent |
| Unit Tests | Missing | No unit tests for auth/security functions |
| CSRF Validation | Missing | Middleware not implemented |
| Organization Auth | Incomplete | Cross-org access not properly blocked |

### Technical Debt

- No service layer (business logic in route handlers)
- Session management duplicated across files
- Dual JWT libraries (`jose` and `jsonwebtoken`)
- No structured logging

See GitHub Issues for full tracking of all known problems.

## Production Deployment

> **Warning**: Do not deploy without addressing [Known Limitations](#known-limitations).

### Prerequisites for Production

1. **Database:** Switch from SQLite to PostgreSQL
2. **Rate Limiting:** Implement Redis-backed rate limiting
3. **CSRF:** Implement token validation middleware
4. **CSP:** Remove `unsafe-eval` and `unsafe-inline`
5. **Email:** Configure Resend or alternative email provider
6. **Secrets:** Ensure all environment variables are set (no fallbacks)

### Deployment Checklist

- [ ] All critical security issues resolved
- [ ] Unit tests for auth functions passing
- [ ] PostgreSQL configured and migrated
- [ ] Redis configured for rate limiting
- [ ] Email service configured and tested
- [ ] All environment variables set
- [ ] HTTPS enabled
- [ ] Security headers reviewed
- [ ] Error monitoring configured

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
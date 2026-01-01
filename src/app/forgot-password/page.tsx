import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We&apos;ll send you a link to reset your password
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Reset Password - SocleStack',
  description: 'Reset your SocleStack account password',
};

'use client';

import Link from 'next/link';
import { TrustedDevices } from '@/components/profile/trusted-devices';
import { ArrowLeft } from 'lucide-react';

export default function DevicesPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href="/profile"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Profile
          </Link>
        </div>

        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          Trusted Devices
        </h1>

        <TrustedDevices />
      </div>
    </div>
  );
}

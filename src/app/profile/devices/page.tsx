'use client'

import Link from 'next/link'
import { TrustedDevices } from '@/components/profile/trusted-devices'
import { ArrowLeft } from 'lucide-react'

export default function DevicesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/profile"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Profile
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Trusted Devices</h1>

        <TrustedDevices />
      </div>
    </div>
  )
}

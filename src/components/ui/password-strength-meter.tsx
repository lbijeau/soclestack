'use client'

import { useMemo } from 'react'
import { calculatePasswordStrength } from '@/lib/utils/password-strength'
import { Check, X } from 'lucide-react'

interface PasswordStrengthMeterProps {
  password: string
  showRequirements?: boolean
  showSuggestions?: boolean
}

export function PasswordStrengthMeter({
  password,
  showRequirements = true,
  showSuggestions = true,
}: PasswordStrengthMeterProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password])

  if (!password) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Password Strength</span>
          <span
            className={`text-xs font-medium ${
              strength.score <= 1
                ? 'text-red-600'
                : strength.score === 2
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}
          >
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= strength.score ? strength.color : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1">
          {strength.requirements.map((req, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 text-xs ${
                req.met ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {req.met ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && strength.suggestions.length > 0 && strength.score < 4 && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          <p className="font-medium mb-1">Suggestions:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {strength.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

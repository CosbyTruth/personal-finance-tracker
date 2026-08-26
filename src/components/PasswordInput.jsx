import { useState } from 'react'

export default function PasswordInput({
  label = 'Password',
  value,
  onChange,
  autoComplete = 'current-password',
  minLength,
  maxLength,
  required = true,
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <label>
      {label}

      <div className="password-input-wrapper">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
        />

        <button
          type="button"
          className="password-eye-button"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <svg
              viewBox="0 0 24 24"
              width="21"
              height="21"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 4.2A10.5 10.5 0 0112 4c5 0 9 5 9 8a10 10 0 01-2 3.3" />
              <path d="M6.6 6.6C4.4 8 3 10.2 3 12c0 3 4 8 9 8a9 9 0 004.3-1.1" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="21"
              height="21"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  )
}
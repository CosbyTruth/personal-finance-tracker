export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 15

export function passwordChecks(password) {
  const value = String(password || '')
  return {
    length: value.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-z0-9\s]/.test(value),
    maxLength: value.length <= PASSWORD_MAX_LENGTH,
  }
}

export function validatePassword(password) {
  const checks = passwordChecks(password)
  const valid = Object.values(checks).every(Boolean)
  return {
    valid,
    checks,
    message: `Use ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters with uppercase, lowercase, a number and a special character.`,
  }
}

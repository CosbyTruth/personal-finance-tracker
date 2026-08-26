export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 72

export function passwordChecks(password) {
  const value = String(password || '')
  return {
    length: value.length >= PASSWORD_MIN_LENGTH,
    letter: /[A-Za-z]/.test(value),
    variety: /[^A-Za-z]/.test(value),
    maxLength: value.length <= PASSWORD_MAX_LENGTH,
  }
}

export function validatePassword(password) {
  const checks = passwordChecks(password)
  const valid = Object.values(checks).every(Boolean)
  return {
    valid,
    checks,
    message: `Use ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and combine letters with numbers, spaces or symbols.`,
  }
}

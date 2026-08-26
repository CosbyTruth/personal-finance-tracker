export function safeCsvCell(value) {
  let text = String(value ?? '')
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function daysInMonthUtc(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

export function advanceRecurringDate(value, frequency, anchorDay = null) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid recurrence date')

  if (frequency === 'Weekly') date.setUTCDate(date.getUTCDate() + 7)
  else if (frequency === 'Biweekly') date.setUTCDate(date.getUTCDate() + 14)
  else {
    const months = frequency === 'Monthly' ? 1 : frequency === 'Quarterly' ? 3 : frequency === 'Yearly' ? 12 : 0
    if (!months) return toIsoDate(date)
    const targetMonthIndex = date.getUTCMonth() + months
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12)
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12
    const desiredDay = Number(anchorDay || date.getUTCDate())
    date.setTime(Date.UTC(targetYear, targetMonth, Math.min(desiredDay, daysInMonthUtc(targetYear, targetMonth))))
  }
  return toIsoDate(date)
}

export function recurringOccurrencesInRange({
  nextDueDate,
  frequency,
  endDate = null,
  from,
  to,
  anchorDay = null,
}) {
  const occurrences = []
  let cursor = String(nextDueDate).slice(0, 10)
  const end = endDate ? String(endDate).slice(0, 10) : null

  for (let guard = 0; guard < 400 && cursor <= to && (!end || cursor <= end); guard += 1) {
    if (cursor >= from) occurrences.push(cursor)
    const next = advanceRecurringDate(cursor, frequency, anchorDay)
    if (next <= cursor) break
    cursor = next
  }
  return occurrences
}

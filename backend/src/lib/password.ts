import { z } from 'zod'

export function hasSequentialDigits(pw: string): boolean {
  for (let i = 0; i < pw.length - 3; i++) {
    const a = pw.charCodeAt(i)
    if (a < 48 || a > 57) continue
    if (
      pw.charCodeAt(i + 1) === a + 1 &&
      pw.charCodeAt(i + 2) === a + 2 &&
      pw.charCodeAt(i + 3) === a + 3
    ) return true
  }
  return false
}

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(pw => /[A-Z]/.test(pw), 'Password must contain at least 1 capital letter')
  .refine(pw => /[^a-zA-Z0-9]/.test(pw), 'Password must contain at least 1 special character')
  .refine(pw => !hasSequentialDigits(pw), 'Password must not contain sequential numbers (e.g. 1234)')

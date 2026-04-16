export function ageFromBirthDate(birthDate: string, today: Date): number {
  const birth = new Date(birthDate);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1;
  }
  return Math.max(0, age);
}

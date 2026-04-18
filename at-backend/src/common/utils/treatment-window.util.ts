export function calculateEndDate(startDate: string, treatmentDays?: number): string | undefined {
  if (!treatmentDays || treatmentDays <= 0) {
    return undefined;
  }

  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + treatmentDays - 1);
  return date.toISOString().slice(0, 10);
}

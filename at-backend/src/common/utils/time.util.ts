export function hhmmToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToHhmm(total: number): string {
  let normalized = total % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;

  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

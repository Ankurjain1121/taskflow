import { RecurrencePattern } from '../../../core/services/recurring.service';

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function toDate(dateString: string): Date {
  return new Date(dateString);
}

export function getPatternLabel(pattern: RecurrencePattern): string {
  const labels: Record<RecurrencePattern, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    custom: 'Custom',
    yearly: 'Yearly',
    weekdays: 'Weekdays',
    custom_weekly: 'Custom Weekly',
  };
  return labels[pattern] || pattern;
}

export function getDropdownSelectOptions(
  options: unknown,
): { label: string; value: string }[] {
  const opts = Array.isArray(options) ? options : [];
  return opts.map((opt: string) => ({ label: opt, value: opt }));
}

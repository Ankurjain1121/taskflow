/**
 * Reusable SVG chart helper functions for Reports view.
 * All charts rendered as inline SVG - no external dependencies.
 */

export interface PieSegment {
  value: number;
  color: string;
  label: string;
}

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface BarData {
  label: string;
  value: number;
  color: string;
  secondaryValue?: number;
  secondaryColor?: string;
}

/**
 * Create SVG pie chart data (stroke-dasharray approach on a circle).
 * Returns segments with dasharray/dashoffset for each arc.
 */
export function createPieSegments(
  segments: PieSegment[],
  radius: number = 40
): { dashArray: string; dashOffset: string; color: string; label: string; percentage: number }[] {
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return [];

  let offset = 0;
  return segments.map((seg) => {
    const percentage = (seg.value / total) * 100;
    const segmentLength = (seg.value / total) * circumference;
    const gap = circumference - segmentLength;
    const result = {
      dashArray: `${segmentLength} ${gap}`,
      dashOffset: `${-offset}`,
      color: seg.color,
      label: seg.label,
      percentage,
    };
    offset += segmentLength;
    return result;
  });
}

/**
 * Create a linear scale function mapping domain to range.
 */
export function scaleLinear(
  domain: [number, number],
  range: [number, number]
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const domainSpan = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / domainSpan) * (r1 - r0);
}

/**
 * Create polyline points string from data points.
 */
export function createPolylinePoints(points: DataPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/**
 * Create filled area path (polyline + bottom edge for area chart).
 */
export function createAreaPath(
  points: DataPoint[],
  baselineY: number
): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  const linePoints = points.map((p) => `L ${p.x} ${p.y}`).join(' ');
  return `M ${first.x} ${baselineY} ${linePoints} L ${last.x} ${baselineY} Z`;
}

/**
 * Generate nice axis tick values for a given range.
 */
export function generateTicks(min: number, max: number, count: number = 5): number[] {
  if (max === min) return [min];
  const step = Math.ceil((max - min) / count);
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) {
    ticks.push(v);
  }
  if (ticks[ticks.length - 1] < max) {
    ticks.push(max);
  }
  return ticks;
}

/**
 * Priority colors matching the existing app theme.
 */
export const CHART_PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

/**
 * General chart color palette.
 */
export const CHART_COLORS = [
  'var(--chart-1)', // primary
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f43f5e', // rose
];

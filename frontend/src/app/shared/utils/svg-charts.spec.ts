import { describe, it, expect } from 'vitest';
import {
  createPieSegments,
  scaleLinear,
  createPolylinePoints,
  createAreaPath,
  generateTicks,
  CHART_PRIORITY_COLORS,
  CHART_COLORS,
  PieSegment,
  DataPoint,
} from './svg-charts';

describe('svg-charts', () => {
  describe('createPieSegments', () => {
    it('should return empty array when total is zero', () => {
      const segments: PieSegment[] = [
        { value: 0, color: '#f00', label: 'A' },
        { value: 0, color: '#0f0', label: 'B' },
      ];
      expect(createPieSegments(segments)).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      expect(createPieSegments([])).toEqual([]);
    });

    it('should compute percentages that sum to 100', () => {
      const segments: PieSegment[] = [
        { value: 25, color: '#f00', label: 'A' },
        { value: 50, color: '#0f0', label: 'B' },
        { value: 25, color: '#00f', label: 'C' },
      ];

      const result = createPieSegments(segments);
      const totalPercentage = result.reduce((sum, s) => sum + s.percentage, 0);

      expect(totalPercentage).toBeCloseTo(100, 5);
    });

    it('should preserve colors and labels', () => {
      const segments: PieSegment[] = [
        { value: 10, color: '#ff0000', label: 'Red' },
        { value: 20, color: '#00ff00', label: 'Green' },
      ];

      const result = createPieSegments(segments);

      expect(result[0].color).toBe('#ff0000');
      expect(result[0].label).toBe('Red');
      expect(result[1].color).toBe('#00ff00');
      expect(result[1].label).toBe('Green');
    });

    it('should compute correct percentages for each segment', () => {
      const segments: PieSegment[] = [
        { value: 30, color: '#f00', label: 'A' },
        { value: 70, color: '#0f0', label: 'B' },
      ];

      const result = createPieSegments(segments);

      expect(result[0].percentage).toBeCloseTo(30, 5);
      expect(result[1].percentage).toBeCloseTo(70, 5);
    });

    it('should use default radius of 40 for dashArray calculation', () => {
      const segments: PieSegment[] = [
        { value: 100, color: '#f00', label: 'Full' },
      ];

      const result = createPieSegments(segments);
      const circumference = 2 * Math.PI * 40;

      // Single segment should have dashArray equal to full circumference + 0 gap
      expect(result[0].dashArray).toBe(`${circumference} ${0}`);
    });

    it('should accept custom radius', () => {
      const segments: PieSegment[] = [
        { value: 100, color: '#f00', label: 'Full' },
      ];
      const radius = 60;

      const result = createPieSegments(segments, radius);
      const circumference = 2 * Math.PI * radius;

      expect(result[0].dashArray).toBe(`${circumference} ${0}`);
    });

    it('should start first segment at offset 0', () => {
      const segments: PieSegment[] = [
        { value: 50, color: '#f00', label: 'A' },
        { value: 50, color: '#0f0', label: 'B' },
      ];

      const result = createPieSegments(segments);

      expect(result[0].dashOffset).toBe('0');
    });

    it('should accumulate offsets for subsequent segments', () => {
      const segments: PieSegment[] = [
        { value: 50, color: '#f00', label: 'A' },
        { value: 50, color: '#0f0', label: 'B' },
      ];
      const radius = 40;
      const circumference = 2 * Math.PI * radius;
      const halfCircumference = circumference / 2;

      const result = createPieSegments(segments, radius);

      // First segment offset is 0
      expect(result[0].dashOffset).toBe('0');
      // Second segment offset is negative of first segment's length
      expect(result[1].dashOffset).toBe(`${-halfCircumference}`);
    });
  });

  describe('scaleLinear', () => {
    it('should map domain values to range values', () => {
      const scale = scaleLinear([0, 100], [0, 500]);

      expect(scale(0)).toBe(0);
      expect(scale(50)).toBe(250);
      expect(scale(100)).toBe(500);
    });

    it('should handle inverted ranges', () => {
      // SVG y-axis is inverted: domain [0, 100] maps to range [500, 0]
      const scale = scaleLinear([0, 100], [500, 0]);

      expect(scale(0)).toBe(500);
      expect(scale(100)).toBe(0);
      expect(scale(50)).toBe(250);
    });

    it('should handle same domain values (avoid division by zero)', () => {
      const scale = scaleLinear([5, 5], [0, 100]);

      // domainSpan becomes 1 (fallback), so (value - d0) / 1 * (r1 - r0)
      const result = scale(5);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should interpolate values outside domain', () => {
      const scale = scaleLinear([0, 10], [0, 100]);

      // Extrapolation: value 20 should map to 200
      expect(scale(20)).toBe(200);
      expect(scale(-5)).toBe(-50);
    });

    it('should handle negative domain and range', () => {
      const scale = scaleLinear([-50, 50], [-100, 100]);

      expect(scale(0)).toBe(0);
      expect(scale(-50)).toBe(-100);
      expect(scale(50)).toBe(100);
    });
  });

  describe('createPolylinePoints', () => {
    it('should return empty string for empty array', () => {
      expect(createPolylinePoints([])).toBe('');
    });

    it('should format single point', () => {
      const points: DataPoint[] = [{ x: 10, y: 20 }];
      expect(createPolylinePoints(points)).toBe('10,20');
    });

    it('should format multiple points separated by spaces', () => {
      const points: DataPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      expect(createPolylinePoints(points)).toBe('0,0 10,20 30,40');
    });

    it('should handle decimal values', () => {
      const points: DataPoint[] = [
        { x: 1.5, y: 2.7 },
        { x: 3.14, y: 6.28 },
      ];
      expect(createPolylinePoints(points)).toBe('1.5,2.7 3.14,6.28');
    });

    it('should ignore label property in output', () => {
      const points: DataPoint[] = [
        { x: 5, y: 10, label: 'Jan' },
        { x: 15, y: 20, label: 'Feb' },
      ];
      expect(createPolylinePoints(points)).toBe('5,10 15,20');
    });
  });

  describe('createAreaPath', () => {
    it('should return empty string for empty points', () => {
      expect(createAreaPath([], 100)).toBe('');
    });

    it('should create closed path for single point', () => {
      const points: DataPoint[] = [{ x: 10, y: 50 }];
      const baselineY = 100;
      const path = createAreaPath(points, baselineY);

      // M first.x baselineY L first.x first.y L last.x baselineY Z
      expect(path).toBe('M 10 100 L 10 50 L 10 100 Z');
    });

    it('should create closed area path for multiple points', () => {
      const points: DataPoint[] = [
        { x: 0, y: 80 },
        { x: 50, y: 30 },
        { x: 100, y: 60 },
      ];
      const baselineY = 100;
      const path = createAreaPath(points, baselineY);

      expect(path).toBe('M 0 100 L 0 80 L 50 30 L 100 60 L 100 100 Z');
    });

    it('should use the provided baseline Y', () => {
      const points: DataPoint[] = [
        { x: 0, y: 20 },
        { x: 100, y: 40 },
      ];
      const path = createAreaPath(points, 200);

      expect(path).toContain('M 0 200');
      expect(path).toContain('L 100 200 Z');
    });
  });

  describe('generateTicks', () => {
    it('should return single value when min equals max', () => {
      expect(generateTicks(5, 5)).toEqual([5]);
    });

    it('should generate ticks from 0 to max', () => {
      const ticks = generateTicks(0, 100, 5);

      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
    });

    it('should include max if not already at a step boundary', () => {
      const ticks = generateTicks(0, 7, 3);

      // step = ceil(7/3) = 3, ticks = [0, 3, 6, 7]
      expect(ticks).toContain(7);
    });

    it('should not duplicate max if it falls on a step boundary', () => {
      const ticks = generateTicks(0, 10, 5);

      // step = ceil(10/5) = 2, ticks = [0, 2, 4, 6, 8, 10]
      expect(ticks[ticks.length - 1]).toBe(10);
      // No duplicate
      const unique = [...new Set(ticks)];
      expect(unique.length).toBe(ticks.length);
    });

    it('should use default count of 5', () => {
      const ticks = generateTicks(0, 100);

      // step = ceil(100/5) = 20, ticks = [0, 20, 40, 60, 80, 100]
      expect(ticks).toEqual([0, 20, 40, 60, 80, 100]);
    });

    it('should handle small ranges', () => {
      const ticks = generateTicks(0, 3, 5);

      // step = ceil(3/5) = 1, ticks = [0, 1, 2, 3]
      expect(ticks).toEqual([0, 1, 2, 3]);
    });
  });

  describe('CHART_PRIORITY_COLORS', () => {
    it('should define colors for urgent, high, medium, low', () => {
      expect(CHART_PRIORITY_COLORS).toHaveProperty('urgent');
      expect(CHART_PRIORITY_COLORS).toHaveProperty('high');
      expect(CHART_PRIORITY_COLORS).toHaveProperty('medium');
      expect(CHART_PRIORITY_COLORS).toHaveProperty('low');
    });

    it('should use hex color format', () => {
      for (const color of Object.values(CHART_PRIORITY_COLORS)) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe('CHART_COLORS', () => {
    it('should be a non-empty array', () => {
      expect(CHART_COLORS.length).toBeGreaterThan(0);
    });

    it('should contain hex color strings or CSS variable references', () => {
      for (const color of CHART_COLORS) {
        expect(color).toMatch(/^(#[0-9a-fA-F]{6}|var\(--[\w-]+\))$/);
      }
    });

    it('should have 8 colors in the palette', () => {
      expect(CHART_COLORS).toHaveLength(8);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { FileSizePipe } from './file-size.pipe';

describe('FileSizePipe', () => {
  const pipe = new FileSizePipe();

  describe('null/undefined handling', () => {
    it('should return empty string for null', () => {
      expect(pipe.transform(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(pipe.transform(undefined)).toBe('');
    });
  });

  describe('zero bytes', () => {
    it('should return "0 Bytes" for 0', () => {
      expect(pipe.transform(0)).toBe('0 Bytes');
    });
  });

  describe('negative values', () => {
    it('should return "Invalid size" for negative numbers', () => {
      expect(pipe.transform(-1)).toBe('Invalid size');
      expect(pipe.transform(-100)).toBe('Invalid size');
    });
  });

  describe('bytes', () => {
    it('should display small values in Bytes', () => {
      expect(pipe.transform(1)).toBe('1 Bytes');
      expect(pipe.transform(500)).toBe('500 Bytes');
      expect(pipe.transform(1023)).toBe('1023 Bytes');
    });
  });

  describe('kilobytes', () => {
    it('should convert 1024 bytes to 1 KB', () => {
      expect(pipe.transform(1024)).toBe('1 KB');
    });

    it('should convert 1500 bytes to KB with decimals', () => {
      expect(pipe.transform(1500)).toBe('1.46 KB');
    });
  });

  describe('megabytes', () => {
    it('should convert to MB', () => {
      const oneMB = 1024 * 1024;
      expect(pipe.transform(oneMB)).toBe('1 MB');
    });

    it('should convert 1.5 MB with decimals', () => {
      const onePointFiveMB = 1.5 * 1024 * 1024;
      expect(pipe.transform(onePointFiveMB)).toBe('1.5 MB');
    });
  });

  describe('gigabytes', () => {
    it('should convert to GB', () => {
      const oneGB = 1024 * 1024 * 1024;
      expect(pipe.transform(oneGB)).toBe('1 GB');
    });
  });

  describe('terabytes', () => {
    it('should convert to TB', () => {
      const oneTB = 1024 * 1024 * 1024 * 1024;
      expect(pipe.transform(oneTB)).toBe('1 TB');
    });
  });

  describe('custom decimals', () => {
    it('should respect 0 decimal places', () => {
      expect(pipe.transform(1500, 0)).toBe('1 KB');
    });

    it('should respect 1 decimal place', () => {
      expect(pipe.transform(1500, 1)).toBe('1.5 KB');
    });

    it('should respect 3 decimal places', () => {
      expect(pipe.transform(1500, 3)).toBe('1.465 KB');
    });

    it('should treat negative decimals as 0', () => {
      expect(pipe.transform(1500, -1)).toBe('1 KB');
    });
  });
});

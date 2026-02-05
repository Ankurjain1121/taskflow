import { Pipe, PipeTransform } from '@angular/core';

/**
 * Transforms a number of bytes into a human-readable file size string.
 * Examples:
 *   1500 -> '1.46 KB'
 *   1572864 -> '1.5 MB'
 *   234 -> '234 Bytes'
 */
@Pipe({
  name: 'fileSize',
  standalone: true,
})
export class FileSizePipe implements PipeTransform {
  private readonly units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  transform(bytes: number | null | undefined, decimals: number = 2): string {
    if (bytes === null || bytes === undefined) {
      return '';
    }

    if (bytes === 0) {
      return '0 Bytes';
    }

    if (bytes < 0) {
      return 'Invalid size';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Ensure we don't go beyond our units array
    const unitIndex = Math.min(i, this.units.length - 1);

    return (
      parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm)) +
      ' ' +
      this.units[unitIndex]
    );
  }
}

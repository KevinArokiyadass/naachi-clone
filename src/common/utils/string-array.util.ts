/**
 * Converts a string or array of strings to an array of strings
 * @param value - String or array of strings
 * @returns Array of strings
 */
export function toStringArray(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    // Split by comma and trim whitespace
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
  
  return [];
}

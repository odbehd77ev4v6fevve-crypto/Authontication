export function extractEntityId(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '';
  if (typeof val === 'object') {
    const record = val as { _id?: unknown; id?: unknown; toString?: () => string };
    if ('_id' in record && record._id !== undefined && record._id !== null) {
      return extractEntityId(record._id);
    }
    if ('id' in record && record.id !== undefined && record.id !== null) {
      return extractEntityId(record.id);
    }
    if (typeof record.toString === 'function') {
      const str = record.toString();
      if (str && str !== '[object Object]') {
        return str;
      }
    }
  }
  return '';
}

export function extractEntityIds(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => extractEntityId(item)).filter(Boolean);
}

export function toOptionalNumberInput(val?: number | string | null): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? String(num) : '';
}

export function toDatetimeLocalInput(val?: string | Date | null): string {
  if (!val) return '';
  const date = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

import type { ColumnInfo } from '../../shared/types';

export function exportToCSV(
  columns: ColumnInfo[],
  rows: Record<string, unknown>[],
  filename: string = 'export.csv'
): void {
  const headers = columns.map((col) => escapeCSV(col.name)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSV(formatValue(row[col.name]))).join(',')
  );

  const csv = [headers, ...dataRows].join('\n');
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

export function exportToJSON(
  rows: Record<string, unknown>[],
  filename: string = 'export.json'
): void {
  const json = JSON.stringify(rows, null, 2);
  downloadFile(json, filename, 'application/json');
}

export function copyToClipboard(
  columns: ColumnInfo[],
  rows: Record<string, unknown>[]
): Promise<void> {
  const headers = columns.map((col) => col.name).join('\t');
  const dataRows = rows.map((row) =>
    columns.map((col) => formatValue(row[col.name])).join('\t')
  );

  const text = [headers, ...dataRows].join('\n');
  return navigator.clipboard.writeText(text);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

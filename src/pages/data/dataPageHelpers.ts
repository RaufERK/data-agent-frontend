import { MOCK_DIFFS } from '../../data/mockData';
import type { CleaningDiff, QualityIssue } from '../../types';

export const diffConfirmKey = (diff: CleaningDiff) => `diff:${diff.id}`;
export const issueConfirmKey = (issue: QualityIssue) => `issue:${issue.id}`;
export const cellKey = (row: number, col: number) => `${row}:${col}`;

export const PREVIEW_VIEWPORT_HEIGHT = 560;
export const PREVIEW_ROW_HEIGHT = 42;
export const PREVIEW_OVERSCAN = 10;

export const CLEANUP_INSIGHT_IDS = new Set([
  'duplicate_requests',
  'date_conflicts',
  'approval_gaps',
  'quality_cleanup',
]);

export const isBlankPreviewValue = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'n/a' || normalized === '(пусто)';
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const matrixFromQueryResult = (columns: string[], data: Record<string, unknown>[]) => (
  [columns, ...data.map(row => columns.map(column => String(row[column] ?? '')))]
);

export const getColumnIndex = (table: string[][], columnName: string) => table[0]?.findIndex(col => col === columnName) ?? -1;

const isSameDiffTarget = (diff: CleaningDiff, issue: QualityIssue) => (
  diff.file === issue.file &&
  diff.sheet === issue.sheet &&
  diff.column === issue.column &&
  diff.severity === issue.severity
);

export const findDiffsForIssue = (issue: QualityIssue) => MOCK_DIFFS.filter(diff => isSameDiffTarget(diff, issue));

export const findIssueForDiff = (diff: CleaningDiff, issues: QualityIssue[]) => (
  issues.find(issue => isSameDiffTarget(diff, issue)) ?? null
);

const isNumericValue = (value: string) => {
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  return normalized !== '' && !Number.isNaN(Number(normalized));
};

export const collectIssueTargetCells = (issue: QualityIssue, table: string[][]) => {
  const markers: Array<{ row: number; col: number }> = [];
  const diffMarkers = findDiffsForIssue(issue);

  if (diffMarkers.length > 0) {
    const colIndex = getColumnIndex(table, issue.column);
    if (colIndex >= 0) {
      diffMarkers.forEach(diff => {
        markers.push({ row: diff.row, col: colIndex });
      });
    }
    return markers;
  }

  const colIndex = getColumnIndex(table, issue.column);
  if (colIndex < 0) return markers;

  const rows = table.slice(1);

  if (/пустые значения/i.test(issue.description)) {
    rows.forEach((row, idx) => {
      const value = (row[colIndex] ?? '').trim();
      if (!value || value === 'N/A') {
        markers.push({ row: idx + 1, col: colIndex });
      }
    });
    return markers;
  }

  if (/нечислов/i.test(issue.description)) {
    rows.forEach((row, idx) => {
      const value = (row[colIndex] ?? '').trim();
      if (value && !isNumericValue(value)) {
        markers.push({ row: idx + 1, col: colIndex });
      }
    });
    return markers;
  }

  if (/дубликат/i.test(issue.description)) {
    const counts = new Map<string, number>();
    rows.forEach(row => {
      const value = (row[colIndex] ?? '').trim();
      if (!value) return;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });

    rows.forEach((row, idx) => {
      const value = (row[colIndex] ?? '').trim();
      if (value && (counts.get(value) ?? 0) > 1) {
        markers.push({ row: idx + 1, col: colIndex });
      }
    });
  }

  return markers;
};

export const isIssueResolved = (issue: QualityIssue, confirmedDiffs: Record<string, boolean>) => {
  if (issue.fixed) return true;
  if (confirmedDiffs[issueConfirmKey(issue)]) return true;
  return findDiffsForIssue(issue).some(diff => confirmedDiffs[diffConfirmKey(diff)]);
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Chip, Button, IconButton, Tooltip,
  LinearProgress, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, InputBase, Menu, MenuItem, Checkbox, ListItemText, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import FilterListIcon from '@mui/icons-material/FilterList';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useProject } from '../store/ProjectContext';
import { MOCK_DIFFS } from '../data/mockData';
import { api } from '../api';
import type { QualityIssue, UploadedFile, DataVersion } from '../types';
import type { MockChart } from '../types';

const VIEWPORT_HEIGHT = 460;
const ROW_HEIGHT = 36;
const OVERSCAN = 8;

// ── severity config ──────────────────────────────────────────────────────────
const SEV: Record<string, { icon: React.ReactNode; color: string; bg: string; colBg: string; colBorder: string }> = {
  error: {
    icon: <ErrorOutlineIcon sx={{ fontSize: 15 }} />,
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    colBg: 'rgba(248,113,113,0.06)',
    colBorder: 'rgba(248,113,113,0.35)',
  },
  warning: {
    icon: <WarningAmberIcon sx={{ fontSize: 15 }} />,
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)',
    colBg: 'rgba(251,191,36,0.06)',
    colBorder: 'rgba(251,191,36,0.35)',
  },
  info: {
    icon: <InfoOutlinedIcon sx={{ fontSize: 15 }} />,
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    colBg: 'rgba(96,165,250,0.05)',
    colBorder: 'rgba(96,165,250,0.3)',
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────
const diffKey = (d: { id: number }) => `diff:${d.id}`;
const issueKey = (i: QualityIssue) => `issue:${i.id}`;

const findDiffsForIssue = (issue: QualityIssue) =>
  MOCK_DIFFS.filter(d =>
    d.file === issue.file && d.sheet === issue.sheet &&
    d.column === issue.column && d.severity === issue.severity,
  );

const isIssueResolved = (issue: QualityIssue, confirmed: Record<string, boolean>) => {
  if (issue.fixed) return true;
  if (confirmed[issueKey(issue)]) return true;
  return findDiffsForIssue(issue).some(d => confirmed[diffKey(d)]);
};

const isNumeric = (v: string) => {
  const n = v.replace(/\s+/g, '').replace(',', '.');
  return n !== '' && !Number.isNaN(Number(n));
};

const parseDateValue = (value: string) => {
  const normalized = value.trim().replace(/\s+0?:00:00$/, '');
  if (!normalized || normalized === 'N/A' || normalized === '(пусто)' || normalized === '-') return null;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

// Shortened department names known from the CRM scenario
const SHORTENED_DEPT_NAMES = new Set([
  'Цифровые каналы', 'Деп-т цифровых каналов', 'Деп-т корпоративных продаж',
  'Сопровождение клиентов', 'департамент корпоративных продаж',
]);

// Подсветка ячеек по issue
const getIssueCellSet = (issue: QualityIssue, preview: string[][]): Set<string> => {
  const result = new Set<string>();
  const colIdx = preview[0]?.findIndex(c => c === issue.column) ?? -1;
  if (colIdx < 0) return result;
  const rows = preview.slice(1);

  if (issue.rows && issue.rows.length > 0) {
    issue.rows.forEach(row => {
      if (row >= 1 && row <= rows.length) result.add(`${row}:${colIdx}`);
    });
    return result;
  }

  // Empty cell detection: "пустые", "пусто", "не заполнен", "не указана"
  const isEmptyCheck = /пустые|пустой|пустое|пусто|не заполнен|не указан/i.test(issue.description);
  // Non-numeric
  const isNonNumericCheck = /нечислов/i.test(issue.description);
  const isInvalidDateCheck = /некорректн.*дат/i.test(issue.description);
  const isDateOrderCheck = /раньше даты выдачи|окончания раньше/i.test(issue.description);
  // Shortened names (Подразделение column)
  const isShortenedCheck = /сокращённ/i.test(issue.description);

  rows.forEach((row, ri) => {
    const v = (row[colIdx] ?? '').trim();
    const key = `${ri + 1}:${colIdx}`;
    if (isEmptyCheck && (!v || v === 'N/A' || v === '(пусто)' || v === '-')) { result.add(key); return; }
    if (isNonNumericCheck && v && !isNumeric(v)) { result.add(key); return; }
    if (isInvalidDateCheck && v && !parseDateValue(v)) { result.add(key); return; }
    if (isDateOrderCheck) {
      const issuedIdx = preview[0]?.findIndex(c => c === 'Дата выдачи') ?? -1;
      const issuedAt = issuedIdx >= 0 ? parseDateValue(row[issuedIdx] ?? '') : null;
      const expiresAt = parseDateValue(v);
      if (issuedAt !== null && expiresAt !== null && expiresAt < issuedAt) { result.add(key); return; }
    }
    if (isShortenedCheck && v && SHORTENED_DEPT_NAMES.has(v)) { result.add(key); return; }
  });

  // Duplicate detection
  if (/дубликат/i.test(issue.description)) {
    const counts = new Map<string, number>();
    rows.forEach(row => { const v = (row[colIdx] ?? '').trim(); if (v) counts.set(v, (counts.get(v) ?? 0) + 1); });
    rows.forEach((row, ri) => { const v = (row[colIdx] ?? '').trim(); if (v && (counts.get(v) ?? 0) > 1) result.add(`${ri + 1}:${colIdx}`); });
  }
  if (/разный регистр/i.test(issue.description)) {
    const variants = new Map<string, Set<string>>();
    rows.forEach(row => {
      const v = (row[colIdx] ?? '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      variants.set(key, new Set([...(variants.get(key) ?? []), v]));
    });
    rows.forEach((row, ri) => {
      const v = (row[colIdx] ?? '').trim();
      if (v && (variants.get(v.toLowerCase())?.size ?? 0) > 1) result.add(`${ri + 1}:${colIdx}`);
    });
  }
  return result;
};

// ── Fix preview generation ────────────────────────────────────────────────────
interface FixRow { rowNum: number; before: string; after: string; skip: boolean; edited: boolean; }

function generateFixPreview(issue: QualityIssue, preview: string[][]): FixRow[] {
  const headers = preview[0] ?? [];
  const dataRows = preview.slice(1);
  const colIdx = headers.findIndex(h => h === issue.column);
  if (colIdx < 0) return [];

  const affectedNums = new Set(issue.rows ?? []);
  const desc = issue.description.toLowerCase();
  const toFix: FixRow[] = [];

  if (desc.includes('регистр') || desc.includes('case') || (issue as { issue_type?: string }).issue_type === 'case_mismatch') {
    // Build frequency map: lowercase → Map<original, count>
    const freq = new Map<string, Map<string, number>>();
    dataRows.forEach(row => {
      const v = (row[colIdx] ?? '').trim();
      if (!v) return;
      const lo = v.toLowerCase();
      if (!freq.has(lo)) freq.set(lo, new Map());
      freq.get(lo)!.set(v, (freq.get(lo)!.get(v) ?? 0) + 1);
    });

    // For each lowercase group with >1 variant, pick the most frequent as canonical
    const canonical = new Map<string, string>(); // lowercase → best variant
    freq.forEach((variants, lo) => {
      if (variants.size <= 1) return; // no mismatch in this group
      let best = ''; let bestCount = 0;
      variants.forEach((count, v) => { if (count > bestCount) { bestCount = count; best = v; } });
      canonical.set(lo, best);
    });

    dataRows.forEach((row, ri) => {
      const rowNum = ri + 1;
      if (affectedNums.size > 0 && !affectedNums.has(rowNum)) return;
      const val = (row[colIdx] ?? '').trim();
      if (!val) return;
      const lo = val.toLowerCase();
      const target = canonical.get(lo);
      if (!target) return; // this group has no mismatch
      if (val === target) return; // already canonical — no change needed
      toFix.push({ rowNum, before: val, after: target, skip: false, edited: false });
    });

  } else if (desc.includes('пуст') || desc.includes('не заполнен') || desc.includes('null')) {
    dataRows.forEach((row, ri) => {
      const rowNum = ri + 1;
      if (affectedNums.size > 0 && !affectedNums.has(rowNum)) return;
      const val = (row[colIdx] ?? '').trim();
      toFix.push({ rowNum, before: val, after: '—', skip: false, edited: false });
    });

  } else if (desc.includes('дат') || desc.includes('date')) {
    dataRows.forEach((row, ri) => {
      const rowNum = ri + 1;
      if (affectedNums.size > 0 && !affectedNums.has(rowNum)) return;
      const val = (row[colIdx] ?? '').trim();
      const fixed = val.replace(/\s+0?:00:00$/, '').trim();
      if (fixed !== val) toFix.push({ rowNum, before: val, after: fixed, skip: false, edited: false });
    });

  } else {
    // Generic: show all affected rows as-is so user can edit manually
    dataRows.forEach((row, ri) => {
      const rowNum = ri + 1;
      if (affectedNums.size > 0 && !affectedNums.has(rowNum)) return;
      const val = (row[colIdx] ?? '').trim();
      toFix.push({ rowNum, before: val, after: val, skip: false, edited: false });
    });
  }

  return toFix.slice(0, 200);
}

// ── FixPreviewDialog ──────────────────────────────────────────────────────────
interface FixPreviewDialogProps {
  open: boolean;
  issue: QualityIssue | null;
  rows: FixRow[];
  onRowChange: (idx: number, field: 'after' | 'skip', value: string | boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const FixPreviewDialog: React.FC<FixPreviewDialogProps> = ({ open, issue, rows, onRowChange, onConfirm, onCancel }) => {
  if (!issue) return null;
  const activeRows = rows.filter(r => !r.skip);
  const s = SEV[issue.severity] ?? SEV.warning;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth
      PaperProps={{ className: 'triplex-night-app', sx: { bgcolor: 'var(--app-panel)', border: '1px solid var(--app-border)', maxHeight: '85vh' } }}>
      <DialogTitle sx={{ pb: 1, borderBottom: '1px solid var(--app-border)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: s.color, display: 'flex' }}>{s.icon}</Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--app-text)' }}>
              Предпросмотр исправления
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--app-subtle-text)' }}>
              Колонка: <strong style={{ color: s.color }}>{issue.column}</strong> · {issue.description}
            </Typography>
          </Box>
          <IconButton size="small" aria-label="Закрыть предпросмотр исправления" onClick={onCancel} sx={{ ml: 'auto', color: 'var(--app-subtle-text)' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ color: 'var(--app-subtle-text)' }}>Нет строк для исправления</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: 'var(--app-panel)', color: 'var(--app-subtle-text)', fontSize: '0.68rem', fontWeight: 700, width: 48, borderBottom: '1px solid var(--app-border)' }}>
                    Стр.
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'var(--app-panel)', color: '#f87171', fontSize: '0.68rem', fontWeight: 700, borderBottom: '1px solid var(--app-border)' }}>
                    Было
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'var(--app-panel)', color: '#3fb950', fontSize: '0.68rem', fontWeight: 700, borderBottom: '1px solid var(--app-border)' }}>
                    Станет
                  </TableCell>
                  <TableCell sx={{ bgcolor: 'var(--app-panel)', color: 'var(--app-subtle-text)', fontSize: '0.68rem', fontWeight: 700, width: 72, textAlign: 'center', borderBottom: '1px solid var(--app-border)' }}>
                    Пропустить
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx} sx={{
                    opacity: row.skip ? 0.35 : 1,
                    bgcolor: row.skip ? 'transparent' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                    '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.04)' },
                  }}>
                    <TableCell sx={{ py: 0.5, px: 1, fontSize: '0.7rem', color: 'var(--app-subtle-text)', borderBottom: '1px solid rgba(86,91,98,0.2)' }}>
                      {row.rowNum}
                    </TableCell>
                    <TableCell sx={{ py: 0.5, px: 1.25, fontSize: '0.78rem', color: '#f87171', borderBottom: '1px solid rgba(86,91,98,0.2)', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.before || <span style={{ opacity: 0.4, fontStyle: 'italic' }}>(пусто)</span>}
                    </TableCell>
                    <TableCell sx={{ py: 0.4, px: 1, borderBottom: '1px solid rgba(86,91,98,0.2)', maxWidth: 260 }}>
                      <TextField
                        size="small"
                        variant="standard"
                        value={row.after}
                        disabled={row.skip}
                        onChange={e => onRowChange(idx, 'after', e.target.value)}
                        sx={{
                          width: '100%',
                          '& input': { fontSize: '0.78rem', color: row.edited ? '#60a5fa' : '#3fb950', py: 0.25 },
                          '& .MuiInput-underline:before': { borderColor: 'transparent' },
                          '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderColor: 'var(--app-border)' },
                          '& .MuiInput-underline:after': { borderColor: '#3fb950' },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.5, textAlign: 'center', borderBottom: '1px solid rgba(86,91,98,0.2)' }}>
                      <Checkbox
                        size="small"
                        checked={row.skip}
                        onChange={e => onRowChange(idx, 'skip', e.target.checked)}
                        sx={{ p: 0.25, color: 'var(--app-subtle-text)', '&.Mui-checked': { color: 'var(--app-subtle-text)' } }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, borderTop: '1px solid var(--app-border)', gap: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)', flex: 1 }}>
          {activeRows.length} из {rows.length} строк будут изменены
          {rows.some(r => r.skip) ? ` · ${rows.filter(r => r.skip).length} пропущено` : ''}
        </Typography>
        <Button onClick={onCancel} variant="outlined" size="small"
          sx={{ fontSize: '0.78rem', px: 1.5, textTransform: 'none', borderColor: 'var(--app-border)', color: 'var(--app-subtle-text)' }}>
          Отмена
        </Button>
        <Button onClick={onConfirm} variant="contained" size="small" disabled={activeRows.length === 0}
          startIcon={<AutoFixHighIcon sx={{ fontSize: 14 }} />}
          sx={{ fontSize: '0.78rem', px: 1.5, textTransform: 'none' }}>
          Исправить {activeRows.length > 0 ? `(${activeRows.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── IssueRow ─────────────────────────────────────────────────────────────────
const activateOnKeyboard = (event: React.KeyboardEvent, action: () => void) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
};

interface IssueRowProps {
  issue: QualityIssue;
  resolved: boolean;
  active: boolean;
  onSelect: () => void;
  onFix: () => void;
}
const IssueRow: React.FC<IssueRowProps> = ({ issue, resolved, active, onSelect, onFix }) => {
  const s = SEV[issue.severity] ?? SEV.info;
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Проблема качества: ${issue.column}. ${issue.description}`}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={event => activateOnKeyboard(event, onSelect)}
      sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 1.5, py: 0.9,
      borderRadius: 1.5, cursor: 'pointer',
      bgcolor: active ? s.bg : resolved ? 'rgba(63,185,80,0.05)' : 'transparent',
      border: `1px solid ${active ? s.color : resolved ? 'rgba(63,185,80,0.2)' : 'transparent'}`,
      opacity: resolved ? 0.5 : 1,
      transition: 'all 0.15s',
      '&:hover': { bgcolor: resolved ? 'rgba(63,185,80,0.05)' : s.bg },
      '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 },
    }}>
      <Box sx={{ color: resolved ? '#3fb950' : s.color, flexShrink: 0, display: 'flex' }}>
        {resolved ? <CheckCircleOutlineIcon sx={{ fontSize: 15 }} /> : s.icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: resolved ? 'var(--app-subtle-text)' : 'var(--app-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {issue.column}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {issue.description}
        </Typography>
      </Box>
      <Chip label={issue.affected} size="small" sx={{ height: 17, fontSize: '0.63rem', bgcolor: resolved ? 'rgba(63,185,80,0.1)' : s.bg, color: resolved ? '#3fb950' : s.color, border: 'none', minWidth: 24 }} />
      {!resolved && issue.autofix && (
        <Tooltip title="Исправить автоматически">
          <IconButton size="small" aria-label={`Исправить автоматически: ${issue.column}`} onClick={e => { e.stopPropagation(); onFix(); }}
            sx={{ color: 'var(--app-accent)', p: 0.4, '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.1)' } }}>
            <AutoFixHighIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

// ── FileTab ───────────────────────────────────────────────────────────────────
const FileTab: React.FC<{ file: UploadedFile; active: boolean; issueCount: number; onClick: () => void }> = ({ file, active, issueCount, onClick }) => (
  <Box
    role="button"
    tabIndex={0}
    aria-label={`Открыть файл ${file.name}`}
    aria-current={active ? 'page' : undefined}
    onClick={onClick}
    onKeyDown={event => activateOnKeyboard(event, onClick)}
    sx={{
    display: 'flex', alignItems: 'center', gap: 0.75,
    px: 1.25, py: 0.6, borderRadius: 1.5, cursor: 'pointer',
    bgcolor: active ? 'rgba(var(--app-accent-rgb),0.1)' : 'transparent',
    border: `1px solid ${active ? 'rgba(var(--app-accent-rgb),0.35)' : 'transparent'}`,
    transition: 'all 0.15s',
    '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.06)' },
    '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 },
  }}>
    <InsertDriveFileOutlinedIcon sx={{ fontSize: 13, color: active ? 'var(--app-accent)' : 'var(--app-subtle-text)' }} />
    <Typography sx={{ fontSize: '0.75rem', fontWeight: active ? 700 : 400, color: active ? 'var(--app-text)' : 'var(--app-subtle-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
      {file.name}
    </Typography>
    {issueCount > 0 && (
      <Chip label={issueCount} size="small" sx={{ height: 15, fontSize: '0.6rem', bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'none', minWidth: 20 }} />
    )}
  </Box>
);

// ── Main ──────────────────────────────────────────────────────────────────────
interface DataViewProps { onContinue: () => void; }

const DataView: React.FC<DataViewProps> = ({ onContinue }) => {
  const { project, sessionId, fixIssue, confirmDiff, confirmedDiffs, setPetalStatus, updateFileSheet, sendIssueMessage, reloadPreviews, dataActionRef } = useProject();

  const files = project?.files ?? [];
  const issues = project?.issues ?? [];
  const dataVersions = project?.dataVersions ?? [];
  const [fixAllDialogOpen, setFixAllDialogOpen] = useState(false);

  // ── Витрина: сводная таблица из данных дашборда ───────────────────────────
  const vitrina = useMemo(() => {
    const charts = project?.dashboardCharts ?? [];
    if (!charts.length) return null;

    // Собираем плоскую таблицу: строка = категория/сегмент, столбцы = метрики виджетов
    const columnDefs: Array<{ key: string; label: string }> = [{ key: '__cat', label: 'Категория' }];
    const rowMap = new Map<string, Record<string, string>>();

    const ensureRow = (cat: string) => {
      if (!rowMap.has(cat)) rowMap.set(cat, { __cat: cat });
      return rowMap.get(cat)!;
    };

    charts.forEach((chart: MockChart) => {
      const title = chart.title || 'Виджет';
      if (chart.type === 'kpi') {
        columnDefs.push({ key: `kpi_${chart.title}`, label: title });
        ensureRow('KPI')[`kpi_${chart.title}`] = String(chart.value ?? '—');
      } else if ((chart.type === 'bar' || chart.type === 'line' || chart.type === 'hbar' || chart.type === 'bar-horizontal') && chart.categories?.length && chart.series?.length) {
        chart.series.forEach((s, si) => {
          const colKey = `${chart.title}_${si}`;
          const colLabel = chart.series!.length > 1 ? `${title} · ${s.name}` : title;
          if (!columnDefs.find(c => c.key === colKey)) columnDefs.push({ key: colKey, label: colLabel });
          chart.categories!.forEach((cat, ci) => {
            ensureRow(cat)[colKey] = String(s.values[ci] ?? '');
          });
        });
      } else if ((chart.type === 'pie' || chart.type === 'donut') && chart.slices?.length) {
        const colKey = `${chart.title}_val`;
        const colPct = `${chart.title}_pct`;
        if (!columnDefs.find(c => c.key === colKey)) {
          columnDefs.push({ key: colKey, label: `${title} · значение` });
          columnDefs.push({ key: colPct, label: `${title} · %` });
        }
        chart.slices.forEach(sl => {
          const row = ensureRow(sl.label);
          row[colKey] = String(sl.value);
          row[colPct] = sl.displayValue || '';
        });
      } else if (chart.type === 'table' && chart.table) {
        chart.table.columns.forEach((col, ci) => {
          const colKey = `tbl_${chart.title}_${ci}`;
          if (!columnDefs.find(c => c.key === colKey)) columnDefs.push({ key: colKey, label: `${title} · ${col}` });
        });
        chart.table.rows.forEach(row => {
          const cat = String(row[0] ?? `Строка ${rowMap.size + 1}`);
          const r = ensureRow(cat);
          chart.table!.columns.forEach((_col, ci) => {
            r[`tbl_${chart.title}_${ci}`] = String(row[ci] ?? '');
          });
        });
      }
    });

    const rows = Array.from(rowMap.values());
    return { columns: columnDefs, rows };
  }, [project?.dashboardCharts]);

  useEffect(() => {
    const hasEmptyPreview = files.length === 0 && issues.length > 0
      ? true
      : files.some(f => f.sheets.every(s => s.preview.length <= 1));
    if (hasEmptyPreview) reloadPreviews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register dataActionRef handler so external callers can switch to vitrina
  useEffect(() => {
    const prev = dataActionRef.current;
    dataActionRef.current = (action: string) => {
      if (action === 'view:vitrina') { setActiveTabKey('vitrina'); return; }
      prev?.(action);
    };
    return () => { dataActionRef.current = prev ?? null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataActionRef]);

  // Auto-select newest version tab when a new data version is created
  const prevVersionCountRef = React.useRef(dataVersions.length);
  useEffect(() => {
    if (dataVersions.length > prevVersionCountRef.current) {
      const newest = dataVersions[dataVersions.length - 1];
      if (newest) selectVersionTab(newest);
    }
    prevVersionCountRef.current = dataVersions.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersions.length]);

  // activeTabKey: 'file:N' or 'version:id'
  const [activeTabKey, setActiveTabKey] = useState<string>('file:0');
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // Data version preview state
  const [activeVersion, setActiveVersion] = useState<DataVersion | null>(null);
  const [versionPreview, setVersionPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);

  const selectFileTab = (idx: number) => {
    setActiveTabKey(`file:${idx}`);
    setActiveFileIdx(idx);
    setActiveSheetIdx(0);
    setSelectedIssueId(null);
    setEditMode(false);
    setEditData(null);
    setSortCol(null);
    setColFilters({});
    setActiveVersion(null);
    setVersionPreview(null);
  };

  const selectVersionTab = async (version: DataVersion) => {
    setActiveTabKey(`version:${version.version_id}`);
    setActiveVersion(version);
    setVersionPreview(null);
    setSelectedIssueId(null);
    setEditMode(false);
    setEditData(null);
    setSortCol(null);
    setColFilters({});
    if (!sessionId) return;
    setVersionLoading(true);
    try {
      const result = await api.getDataVersionPreview(sessionId, version.version_id, 1000);
      setVersionPreview({
        headers: result.columns,
        rows: result.data.map(row => result.columns.map(col => String(row[col] ?? ''))),
      });
    } catch {
      setVersionPreview({ headers: [], rows: [] });
    } finally {
      setVersionLoading(false);
    }
  };

  const isVersionTab = activeVersion !== null;

  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

  // Fix preview dialog
  const [fixDialogIssue, setFixDialogIssue] = useState<QualityIssue | null>(null);
  const [fixDialogRows, setFixDialogRows] = useState<FixRow[]>([]);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<string[][] | null>(null);

  // Track which issues were just fixed (for green flash)
  const [justFixedIds, setJustFixedIds] = useState<Set<number>>(new Set());

  const [filterQuery, setFilterQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [scrollTop, setScrollTop] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  // Sort state
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Column filter state: colIdx → Set of selected values (null = all)
  const [colFilters, setColFilters] = useState<Record<number, Set<string>>>({});
  // Filter menu anchor
  const [filterMenu, setFilterMenu] = useState<{ anchor: HTMLElement; colIdx: number } | null>(null);
  // Temp search inside filter dropdown
  const [filterSearch, setFilterSearch] = useState('');

  const activeFile = files[activeFileIdx] ?? null;
  const activeSheet = activeFile?.sheets[activeSheetIdx] ?? null;
  const basePreview = activeSheet?.preview ?? [];
  const displayData = editMode && editData ? editData : basePreview;

  const headers = displayData[0] ?? [];
  const allDataRows = displayData.slice(1);
  const dataRows = useMemo(() => {
    let rows = allDataRows;
    // Global text filter
    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      rows = rows.filter(row => row.some(cell => cell.toLowerCase().includes(q)));
    }
    // Column filters
    Object.entries(colFilters).forEach(([ci, vals]) => {
      if (!vals || vals.size === 0) return;
      const idx = Number(ci);
      rows = rows.filter(row => vals.has(row[idx] ?? ''));
    });
    // Sort
    if (sortCol !== null) {
      const col = sortCol;
      rows = [...rows].sort((a, b) => {
        const av = a[col] ?? '';
        const bv = b[col] ?? '';
        // Try numeric sort
        const an = parseFloat(av.replace(/\s/g, '').replace(',', '.'));
        const bn = parseFloat(bv.replace(/\s/g, '').replace(',', '.'));
        let cmp = 0;
        if (!isNaN(an) && !isNaN(bn)) {
          cmp = an - bn;
        } else {
          // Try date sort
          const ad = Date.parse(av);
          const bd = Date.parse(bv);
          if (!isNaN(ad) && !isNaN(bd)) {
            cmp = ad - bd;
          } else {
            cmp = av.localeCompare(bv, 'ru');
          }
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [allDataRows, filterQuery, colFilters, sortCol, sortDir]);

  // Unique values per column (for filter dropdown), computed from allDataRows
  const colUniqueValues = useMemo(() => {
    const result: Record<number, string[]> = {};
    headers.forEach((_, ci) => {
      const vals = Array.from(new Set(allDataRows.map(r => r[ci] ?? ''))).sort((a, b) => a.localeCompare(b, 'ru'));
      result[ci] = vals;
    });
    return result;
  }, [allDataRows, headers]);

  const handleSortClick = (ci: number) => {
    if (sortCol === ci) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(ci);
      setSortDir('asc');
    }
    setScrollTop(0);
    if (tableRef.current) tableRef.current.scrollTop = 0;
  };

  const handleFilterIconClick = (e: React.MouseEvent<HTMLElement>, ci: number) => {
    e.stopPropagation();
    setFilterSearch('');
    setFilterMenu({ anchor: e.currentTarget, ci } as unknown as { anchor: HTMLElement; colIdx: number });
    setFilterMenu({ anchor: e.currentTarget, colIdx: ci });
  };

  const toggleColFilterValue = (ci: number, val: string) => {
    setColFilters(prev => {
      const cur = new Set(prev[ci] ?? []);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      if (cur.size === 0) {
        const next = { ...prev };
        delete next[ci];
        return next;
      }
      return { ...prev, [ci]: cur };
    });
    setScrollTop(0);
    if (tableRef.current) tableRef.current.scrollTop = 0;
  };

  const clearColFilter = (ci: number) => {
    setColFilters(prev => { const next = { ...prev }; delete next[ci]; return next; });
  };

  const activeFilterCount = Object.keys(colFilters).length;

  // Current issue
  const fileIssues = useMemo(
    () => issues.filter(i => i.file === activeFile?.name && i.sheet === (activeSheet?.name ?? '')),
    [issues, activeFile, activeSheet],
  );
  const selectedIssue = fileIssues.find(i => i.id === selectedIssueId) ?? null;

  // Cells to highlight
  const highlightCells = useMemo(() => {
    if (!selectedIssue || displayData.length === 0) return new Set<string>();
    return getIssueCellSet(selectedIssue, displayData);
  }, [selectedIssue, displayData]);

  const highlightColor = selectedIssue ? (SEV[selectedIssue.severity]?.color ?? '#fbbf24') : '#fbbf24';

  // Column-level coloring: map col name → severity (worst) — used only for header tinting
  const colSeverity = useMemo(() => {
    const map = new Map<string, string>();
    fileIssues.forEach(i => {
      if (isIssueResolved(i, confirmedDiffs)) return;
      const cur = map.get(i.column);
      const order = ['error', 'warning', 'info'];
      if (!cur || order.indexOf(i.severity) < order.indexOf(cur)) map.set(i.column, i.severity);
    });
    return map;
  }, [fileIssues, confirmedDiffs]);

  // Cell-level issue map: "rowIdx:colIdx" → { severity, description }
  // Only cells that actually match the issue condition are included
  const issueCellMap = useMemo(() => {
    const map = new Map<string, { severity: string; description: string }>();
    if (displayData.length === 0) return map;
    fileIssues.forEach(i => {
      if (isIssueResolved(i, confirmedDiffs)) return;
      const cells = getIssueCellSet(i, displayData);
      cells.forEach(key => {
        const existing = map.get(key);
        const order = ['error', 'warning', 'info'];
        if (!existing || order.indexOf(i.severity) < order.indexOf(existing.severity)) {
          map.set(key, { severity: i.severity, description: i.description });
        }
      });
    });
    return map;
  }, [fileIssues, confirmedDiffs, displayData]);

  // Virtualisation
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const endIdx = Math.min(dataRows.length, startIdx + visibleCount);
  const visibleRows = dataRows.slice(startIdx, endIdx);

  // Stats
  const totalIssues = issues.length;
  const resolvedCount = issues.filter(i => isIssueResolved(i, confirmedDiffs)).length;
  const remaining = totalIssues - resolvedCount;

  // Scroll to first row of an issue
  const scrollToIssue = useCallback((issue: QualityIssue) => {
    if (!tableRef.current || displayData.length === 0) return;
    const cells = getIssueCellSet(issue, displayData);
    if (cells.size === 0) return;
    const firstRow = Math.min(...[...cells].map(k => parseInt(k.split(':')[0], 10)));
    const targetScrollTop = Math.max(0, (firstRow - 1) * ROW_HEIGHT - ROW_HEIGHT * 2);
    tableRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
  }, [displayData]);

  // Handlers
  const handleFix = useCallback((issue: QualityIssue) => {
    // Open preview dialog instead of fixing immediately
    const preview = activeSheet?.preview ?? [];
    const rows = generateFixPreview(issue, preview);
    setFixDialogIssue(issue);
    setFixDialogRows(rows);
  }, [activeSheet]);

  const handleFixDialogRowChange = useCallback((idx: number, field: 'after' | 'skip', value: string | boolean) => {
    setFixDialogRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      if (field === 'skip') return { ...r, skip: value as boolean };
      return { ...r, after: value as string, edited: true };
    }));
  }, []);

  const handleFixConfirm = useCallback(() => {
    if (!fixDialogIssue || !activeFile || !activeSheet) return;

    // Apply changes to preview data
    const preview = activeSheet.preview.map(row => [...row]);
    const headers = preview[0] ?? [];
    const colIdx = headers.findIndex(h => h === fixDialogIssue.column);

    fixDialogRows.filter(r => !r.skip).forEach(r => {
      if (colIdx >= 0 && r.rowNum < preview.length) {
        preview[r.rowNum][colIdx] = r.after;
      }
    });

    updateFileSheet(activeFile.name, activeSheetIdx, preview);
    findDiffsForIssue(fixDialogIssue).forEach(d => confirmDiff(diffKey(d)));
    fixIssue(fixDialogIssue.id);
    confirmDiff(issueKey(fixDialogIssue));
    setJustFixedIds(prev => new Set([...prev, fixDialogIssue.id]));
    setTimeout(() => setJustFixedIds(prev => { const next = new Set(prev); next.delete(fixDialogIssue.id); return next; }), 2000);

    setFixDialogIssue(null);
    setFixDialogRows([]);
  }, [fixDialogIssue, fixDialogRows, activeFile, activeSheet, activeSheetIdx, updateFileSheet, fixIssue, confirmDiff]);

  const handleFixAll = useCallback(() => {
    const toFix = issues.filter(i => !isIssueResolved(i, confirmedDiffs));
    const ids = new Set(toFix.map(i => i.id));
    toFix.forEach(issue => {
      findDiffsForIssue(issue).forEach(d => confirmDiff(diffKey(d)));
      fixIssue(issue.id);
      confirmDiff(issueKey(issue));
    });
    setJustFixedIds(ids);
    setTimeout(() => setJustFixedIds(new Set()), 2500);
    setFixAllDialogOpen(false);
  }, [issues, confirmedDiffs, fixIssue, confirmDiff]);

  const handleContinue = () => {
    setPetalStatus('data', 'green');
    onContinue();
  };

  const issueCountForFile = (file: UploadedFile) =>
    issues.filter(i => i.file === file.name && !isIssueResolved(i, confirmedDiffs)).length;

  // Edit
  const startEdit = () => {
    setEditData(basePreview.map(row => [...row]));
    setEditMode(true);
  };
  const cancelEdit = () => { setEditMode(false); setEditData(null); };
  const saveEdit = () => {
    if (editData && activeFile) updateFileSheet(activeFile.name, activeSheetIdx, editData);
    if (selectedIssue) { fixIssue(selectedIssue.id); confirmDiff(issueKey(selectedIssue)); }
    setEditMode(false);
    setEditData(null);
  };
  const handleCellEdit = (rowIdx: number, colIdx: number, val: string) => {
    if (!editData) return;
    setEditData(editData.map((row, ri) => ri === rowIdx ? row.map((c, ci) => ci === colIdx ? val : c) : [...row]));
  };

  // Set of column names that belong to just-fixed issues
  // Set of cell keys that belong to just-fixed issues
  const justFixedCells = useMemo(() => {
    const cells = new Set<string>();
    fileIssues.forEach(i => {
      if (justFixedIds.has(i.id)) {
        getIssueCellSet(i, displayData).forEach(key => cells.add(key));
      }
    });
    return cells;
  }, [fileIssues, justFixedIds, displayData]);

  const justFixedCols = useMemo(() => {
    const cols = new Set<string>();
    fileIssues.forEach(i => {
      if (justFixedIds.has(i.id)) cols.add(i.column);
    });
    return cols;
  }, [fileIssues, justFixedIds]);

  const DATE_COLS = new Set(['Дата выдачи', 'Дата окончания', 'Дата создания']);
  const isBlankValue = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized === '' || normalized === 'n/a' || normalized === '(пусто)';
  };

  // Column width config: narrow for IDs/dates/short fields, wide for text
  const COL_WIDTHS: Record<string, number> = {
    'request_id':        90,
    'Дата создания':     100,
    'Дата выдачи':       100,
    'Дата окончания':    100,
    'Тип':               90,
    'Источник':          80,
    'Стадия':            110,
    'Тип доступа':       140,
    'Владелец':          130,
    'Согласование СЭБ':  130,
    'Подразделение':     200,
    'Название':          240,
    'Организация':       160,
    'Комментарий':       200,
  };
  const getColWidth = (h: string) => COL_WIDTHS[h] ?? 120;
  const totalWidth = 38 + headers.reduce((sum, h) => sum + getColWidth(h), 0);

  const getCellStyle = (rowAbsIdx: number, colIdx: number, cellVal: string): React.CSSProperties & { sx?: object } => {
    const cellK = `${rowAbsIdx + 1}:${colIdx}`;
    const isHighlighted = highlightCells.has(cellK);
    const colName = headers[colIdx] ?? '';
    const isDateCol = DATE_COLS.has(colName);
    const isEmpty = !editMode && !isDateCol && isBlankValue(cellVal);
    const isJustFixed = justFixedCells.has(cellK);
    const issueCell = issueCellMap.get(cellK);

    if (isHighlighted) {
      return {
        background: `${highlightColor}22`,
        outline: `1.5px solid ${highlightColor}88`,
        outlineOffset: -1,
        color: highlightColor,
        fontWeight: 600,
      };
    }
    if (isJustFixed) {
      return {
        background: 'rgba(63,185,80,0.10)',
        outline: '1.5px solid rgba(63,185,80,0.4)',
        outlineOffset: -1,
        color: '#3fb950',
        fontWeight: 600,
      };
    }
    if (isEmpty) return { color: '#94a3b8', background: 'rgba(148,163,184,0.08)', fontStyle: 'italic' };
    if (issueCell) {
      const s = SEV[issueCell.severity];
      return {
        background: s.colBg,
        outline: `1.5px solid ${s.colBorder}`,
        outlineOffset: -1,
        color: s.color,
        fontWeight: 600,
      };
    }
    return {};
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <Box sx={{
        px: 3, py: 1.25, borderBottom: '1px solid var(--app-border)',
        display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
        bgcolor: 'rgba(var(--app-surface-rgb),0.92)',
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--app-text)', flexShrink: 0 }}>
          Качество данных
        </Typography>

        {totalIssues > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LinearProgress variant="determinate"
              value={totalIssues > 0 ? (resolvedCount / totalIssues) * 100 : 0}
              sx={{ width: 120, borderRadius: 1, height: 5 }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--app-subtle-text)', whiteSpace: 'nowrap' }}>
              {resolvedCount} / {totalIssues}
            </Typography>
          </Box>
        )}

        {/* severity chips */}
        {(['error', 'warning', 'info'] as const).map(sev => {
          const count = issues.filter(i => i.severity === sev && !isIssueResolved(i, confirmedDiffs)).length;
          if (count === 0) return null;
          const s = SEV[sev];
          return (
            <Chip key={sev} icon={<Box sx={{ color: s.color, display: 'flex', pl: 0.5 }}>{s.icon}</Box>}
              label={count} size="small"
              sx={{ height: 20, fontSize: '0.7rem', bgcolor: s.bg, color: s.color, border: 'none' }} />
          );
        })}

        <Box sx={{ flex: 1 }} />

        {/* Edit toggle */}
        {!editMode ? (
          <Tooltip title="Ручное редактирование">
            <Button size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />} onClick={startEdit}
              sx={{ fontSize: '0.75rem', px: 1.25, py: 0.35, color: 'var(--app-subtle-text)', border: '1px solid var(--app-border)', '&:hover': { color: 'var(--app-text)', borderColor: 'var(--app-accent)' } }}>
              Редактировать
            </Button>
          </Tooltip>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Button size="small" startIcon={<CloseIcon sx={{ fontSize: 14 }} />} onClick={cancelEdit}
              sx={{ fontSize: '0.75rem', px: 1.25, py: 0.35, color: 'var(--app-subtle-text)', border: '1px solid var(--app-border)' }}>
              Отмена
            </Button>
            <Button size="small" startIcon={<CheckIcon sx={{ fontSize: 14 }} />} onClick={saveEdit} variant="contained"
              sx={{ fontSize: '0.75rem', px: 1.25, py: 0.35, bgcolor: '#3fb950', '&:hover': { bgcolor: '#2ea043' }, boxShadow: 'none' }}>
              Сохранить
            </Button>
          </Box>
        )}

        {/* Fix all */}
        {remaining > 0 && !editMode && (
          <Button size="small" startIcon={<AutoFixHighIcon sx={{ fontSize: 14 }} />}
            onClick={() => setFixAllDialogOpen(true)}
            sx={{ fontSize: '0.75rem', px: 1.25, py: 0.35, color: 'var(--app-accent)', border: '1px solid rgba(var(--app-accent-rgb),0.3)', bgcolor: 'rgba(var(--app-accent-rgb),0.06)', '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.12)' } }}>
            Исправить всё
          </Button>
        )}

        {/* Skip / Continue */}
        <Button size="small" endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
          variant={remaining === 0 ? 'contained' : 'outlined'}
          onClick={handleContinue}
          sx={{
            fontSize: '0.75rem', px: 1.5, py: 0.35,
            ...(remaining === 0
              ? { background: 'linear-gradient(135deg, var(--app-accent-strong) 0%, var(--app-accent) 100%)', boxShadow: 'none' }
              : { borderColor: 'var(--app-border)', color: 'var(--app-subtle-text)' }),
          }}>
          {remaining === 0 ? 'К модели данных' : 'Пропустить →'}
        </Button>
      </Box>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: issues panel */}
        <Box sx={{ width: 264, flexShrink: 0, borderRight: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'var(--app-surface)' }}>

          {/* File tabs */}
          <Box sx={{ px: 1.25, py: 1, borderBottom: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 0.4, flexShrink: 0 }}>
            {files.map((file, idx) => (
              <FileTab key={file.name} file={file} active={idx === activeFileIdx}
                issueCount={issueCountForFile(file)}
                onClick={() => { setActiveFileIdx(idx); setActiveSheetIdx(0); setSelectedIssueId(null); setEditMode(false); setEditData(null); setSortCol(null); setColFilters({}); }} />
            ))}
          </Box>

          {/* Sheet selector */}
          {activeFile && activeFile.sheets.length > 1 && (
            <Box sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid var(--app-border)', display: 'flex', gap: 0.5, flexWrap: 'wrap', flexShrink: 0 }}>
              {activeFile.sheets.map((sh, si) => (
                <Box
                  key={sh.name}
                  role="button"
                  tabIndex={0}
                  aria-label={`Открыть лист ${sh.name}`}
                  aria-current={si === activeSheetIdx ? 'page' : undefined}
                  onClick={() => { setActiveSheetIdx(si); setSelectedIssueId(null); setSortCol(null); setColFilters({}); }}
                  onKeyDown={event => activateOnKeyboard(event, () => { setActiveSheetIdx(si); setSelectedIssueId(null); setSortCol(null); setColFilters({}); })}
                  sx={{ px: 1.1, py: 0.25, borderRadius: 1, cursor: 'pointer', fontSize: '0.7rem', fontWeight: si === activeSheetIdx ? 700 : 400, color: si === activeSheetIdx ? 'var(--app-accent)' : 'var(--app-subtle-text)', bgcolor: si === activeSheetIdx ? 'rgba(var(--app-accent-rgb),0.1)' : 'transparent', '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.06)' }, '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 } }}>
                  {sh.name}
                </Box>
              ))}
            </Box>
          )}

          {/* Severity filter */}
          {fileIssues.length > 0 && (
            <Box sx={{ px: 1.25, py: 0.6, borderBottom: '1px solid var(--app-border)', display: 'flex', gap: 0.5, flexShrink: 0, bgcolor: 'var(--app-surface)' }}>
              {(['all', 'error', 'warning', 'info'] as const).map(sev => {
                const labels = { all: 'Все', error: 'Ошибки', warning: 'Предупр.', info: 'Инфо' };
                const colors = { all: 'var(--app-subtle-text)', error: '#f87171', warning: '#fbbf24', info: '#60a5fa' };
                const active = severityFilter === sev;
                const count = sev === 'all' ? fileIssues.length : fileIssues.filter(i => i.severity === sev).length;
                if (sev !== 'all' && count === 0) return null;
                return (
                  <Box
                    key={sev}
                    role="button"
                    tabIndex={0}
                    aria-label={`Фильтр качества: ${labels[sev]}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setSeverityFilter(sev)}
                    onKeyDown={event => activateOnKeyboard(event, () => setSeverityFilter(sev))}
                    sx={{
                    px: 0.9, py: 0.3, borderRadius: 1, cursor: 'pointer', fontSize: '0.68rem', fontWeight: active ? 700 : 400,
                    color: active ? (sev === 'all' ? 'var(--app-text)' : colors[sev]) : 'var(--app-subtle-text)',
                    bgcolor: active ? (sev === 'all' ? 'rgba(255,255,255,0.06)' : `${colors[sev]}18`) : 'transparent',
                    border: `1px solid ${active ? (sev === 'all' ? 'var(--app-border)' : `${colors[sev]}55`) : 'transparent'}`,
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: sev === 'all' ? 'rgba(255,255,255,0.06)' : `${colors[sev]}12` },
                    '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 },
                  }}>
                    {labels[sev]}{sev !== 'all' && ` (${count})`}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Issues list */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 1.25, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {fileIssues.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 26, color: '#3fb950', mb: 0.75 }} />
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--app-subtle-text)' }}>Проблем не найдено</Typography>
              </Box>
            ) : fileIssues.filter(i => severityFilter === 'all' || i.severity === severityFilter).map(issue => (
              <IssueRow key={issue.id} issue={issue}
                resolved={isIssueResolved(issue, confirmedDiffs)}
                active={selectedIssueId === issue.id}
                onSelect={() => {
                  const isDeselecting = selectedIssueId === issue.id;
                  setSelectedIssueId(isDeselecting ? null : issue.id);
                  if (editMode && !editData) startEdit();
                  if (!isDeselecting) {
                    sendIssueMessage(issue.id);
                    scrollToIssue(issue);
                  }
                }}
                onFix={() => handleFix(issue)} />
            ))}
          </Box>

          {/* Legend */}
          <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid var(--app-border)', display: 'flex', gap: 1.5, flexShrink: 0 }}>
            {[{ color: '#f87171', label: 'Ошибка' }, { color: '#fbbf24', label: 'Предупреждение' }].map(({ color, label }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                <Typography sx={{ fontSize: '0.65rem', color: 'var(--app-subtle-text)' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right: table */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* VS Code-style horizontal tabs */}
          <Box sx={{
            display: 'flex', flexDirection: 'row', alignItems: 'stretch',
            borderBottom: '1px solid var(--app-border)', flexShrink: 0,
            bgcolor: 'var(--app-surface)', overflowX: 'auto',
            '&::-webkit-scrollbar': { height: 3 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'var(--app-border)' },
          }}>
            {files.map((file, idx) => {
              const key = `file:${idx}`;
              const active = activeTabKey === key;
              const rowCount = file.sheets[0]?.rows ?? 0;
              return (
                <Box
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Открыть файл ${file.name}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectFileTab(idx)}
                  onKeyDown={event => activateOnKeyboard(event, () => selectFileTab(idx))}
                  sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1.5, py: 0.75, cursor: 'pointer', whiteSpace: 'nowrap',
                  borderRight: '1px solid var(--app-border)',
                  borderBottom: active ? '2px solid var(--app-accent)' : '2px solid transparent',
                  bgcolor: active ? 'rgba(var(--app-accent-rgb),0.06)' : 'transparent',
                  color: active ? 'var(--app-text)' : 'var(--app-subtle-text)',
                  fontSize: '0.78rem', fontWeight: active ? 600 : 400,
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: active ? 'rgba(var(--app-accent-rgb),0.08)' : 'rgba(255,255,255,0.04)', color: 'var(--app-text)' },
                  '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: -2 },
                }}>
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 13 }} />
                  {file.name}
                  {rowCount > 0 && (
                    <Typography component="span" sx={{ fontSize: '0.65rem', color: active ? 'var(--app-accent)' : 'var(--app-subtle-text)', ml: 0.25 }}>
                      {rowCount.toLocaleString('ru')}
                    </Typography>
                  )}
                </Box>
              );
            })}
            {dataVersions.map(ver => {
              const key = `version:${ver.version_id}`;
              const active = activeTabKey === key;
              return (
                <Box
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Открыть версию данных ${ver.name}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => selectVersionTab(ver)}
                  onKeyDown={event => activateOnKeyboard(event, () => selectVersionTab(ver))}
                  sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1.5, py: 0.75, cursor: 'pointer', whiteSpace: 'nowrap',
                  borderRight: '1px solid var(--app-border)',
                  borderBottom: active ? '2px solid #a78bfa' : '2px solid transparent',
                  bgcolor: active ? 'rgba(167,139,250,0.06)' : 'transparent',
                  color: active ? '#c4b5fd' : 'var(--app-subtle-text)',
                  fontSize: '0.78rem', fontWeight: active ? 600 : 400,
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: active ? 'rgba(167,139,250,0.09)' : 'rgba(255,255,255,0.04)', color: '#c4b5fd' },
                  '&:focus-visible': { outline: '2px solid #a78bfa', outlineOffset: -2 },
                }}>
                  <ArrowForwardIcon sx={{ fontSize: 12 }} />
                  {ver.name}
                  <Typography component="span" sx={{ fontSize: '0.65rem', color: active ? '#a78bfa' : 'var(--app-subtle-text)', ml: 0.25 }}>
                    {ver.row_count.toLocaleString('ru')}
                  </Typography>
                </Box>
              );
            })}
            {vitrina && (() => {
              const active = activeTabKey === 'vitrina';
              return (
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label="Открыть витрину"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setActiveTabKey('vitrina');
                    setActiveVersion(null);
                    setSelectedIssueId(null);
                    setEditMode(false);
                    setEditData(null);
                  }}
                  onKeyDown={event => activateOnKeyboard(event, () => {
                    setActiveTabKey('vitrina');
                    setActiveVersion(null);
                    setSelectedIssueId(null);
                    setEditMode(false);
                    setEditData(null);
                  })}
                  sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1.5, py: 0.75, cursor: 'pointer', whiteSpace: 'nowrap',
                  borderRight: '1px solid var(--app-border)',
                  borderBottom: active ? '2px solid #34d399' : '2px solid transparent',
                  bgcolor: active ? 'rgba(52,211,153,0.07)' : 'transparent',
                  color: active ? '#34d399' : 'var(--app-subtle-text)',
                  fontSize: '0.78rem', fontWeight: active ? 700 : 400,
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: 'rgba(52,211,153,0.05)', color: '#34d399' },
                  '&:focus-visible': { outline: '2px solid #34d399', outlineOffset: -2 },
                }}>
                  <TableChartIcon sx={{ fontSize: 13 }} />
                  Витрина
                  <Typography component="span" sx={{ fontSize: '0.65rem', color: active ? '#34d399' : 'var(--app-subtle-text)', ml: 0.25 }}>
                    {vitrina.rows.length}
                  </Typography>
                </Box>
              );
            })()}
          </Box>

          {/* Issue banner */}
          {!isVersionTab && selectedIssue && (
            <Box sx={{
              px: 2.5, py: 0.85, borderBottom: '1px solid var(--app-border)', flexShrink: 0,
              bgcolor: SEV[selectedIssue.severity]?.bg,
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}>
              <Box sx={{ color: SEV[selectedIssue.severity]?.color, display: 'flex' }}>{SEV[selectedIssue.severity]?.icon}</Box>
              <Typography sx={{ flex: 1, fontSize: '0.8rem', color: 'var(--app-text)' }}>
                <strong>{selectedIssue.column}:</strong> {selectedIssue.description}
                {highlightCells.size > 0 && (
                  <Typography component="span" sx={{ ml: 1, fontSize: '0.72rem', color: 'var(--app-subtle-text)' }}>
                    — {highlightCells.size} {highlightCells.size === 1 ? 'ячейка' : 'ячеек'}
                  </Typography>
                )}
              </Typography>
              {selectedIssue.autofix && !isIssueResolved(selectedIssue, confirmedDiffs) && (
                <Button size="small" startIcon={<AutoFixHighIcon sx={{ fontSize: 13 }} />}
                  onClick={() => handleFix(selectedIssue)}
                  sx={{ fontSize: '0.72rem', color: 'var(--app-accent)', border: '1px solid rgba(var(--app-accent-rgb),0.3)', px: 1.1, py: 0.25 }}>
                  Исправить
                </Button>
              )}
              {editMode && (
                <Typography sx={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 600 }}>
                  ✏ Режим редактирования
                </Typography>
              )}
            </Box>
          )}

          {/* Edit mode hint */}
          {!isVersionTab && editMode && !selectedIssue && (
            <Box sx={{ px: 2.5, py: 0.75, borderBottom: '1px solid var(--app-border)', flexShrink: 0, bgcolor: 'rgba(96,165,250,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon sx={{ fontSize: 14, color: '#60a5fa' }} />
              <Typography sx={{ fontSize: '0.78rem', color: '#60a5fa' }}>
                Режим редактирования — кликайте на ячейки для правки
              </Typography>
            </Box>
          )}

          {/* Filter bar */}
          {!isVersionTab && <Box sx={{
            px: 1.5, py: 0.75, borderBottom: '1px solid var(--app-border)', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 1,
          }}>
            <SearchIcon sx={{ fontSize: 15, color: 'var(--app-subtle-text)', flexShrink: 0 }} />
            <InputBase
              value={filterQuery}
              onChange={e => { setFilterQuery(e.target.value); setScrollTop(0); if (tableRef.current) tableRef.current.scrollTop = 0; }}
              placeholder="Фильтр по значению…"
              sx={{
                flex: 1, fontSize: '0.78rem', color: 'var(--app-text)',
                '& input::placeholder': { color: 'var(--app-subtle-text)', opacity: 1 },
              }}
            />
            {(filterQuery || activeFilterCount > 0) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)', whiteSpace: 'nowrap' }}>
                  {dataRows.length} из {allDataRows.length} стр.
                </Typography>
                {filterQuery && (
                  <IconButton size="small" aria-label="Очистить фильтр таблицы" onClick={() => setFilterQuery('')}
                    sx={{ p: 0.25, color: 'var(--app-subtle-text)', '&:hover': { color: 'var(--app-text)' } }}>
                    <CloseIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                )}
              </Box>
            )}
          </Box>}

          {/* Active filters row */}
          {!isVersionTab && activeFilterCount > 0 && (
            <Box sx={{ px: 1.5, py: 0.6, borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', flexShrink: 0, bgcolor: 'rgba(var(--app-accent-rgb),0.04)' }}>
              <Typography sx={{ fontSize: '0.68rem', color: 'var(--app-subtle-text)', mr: 0.5 }}>Фильтры:</Typography>
              {Object.entries(colFilters).map(([ci, vals]) => (
                <Chip
                  key={ci}
                  label={`${headers[Number(ci)]}: ${Array.from(vals).slice(0, 2).join(', ')}${vals.size > 2 ? ` +${vals.size - 2}` : ''}`}
                  size="small"
                  onDelete={() => clearColFilter(Number(ci))}
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(var(--app-accent-rgb),0.12)', color: 'var(--app-accent)', border: 'none' }}
                />
              ))}
              <Button size="small" onClick={() => setColFilters({})}
                sx={{ fontSize: '0.65rem', px: 0.75, py: 0.2, color: 'var(--app-subtle-text)', textTransform: 'none', minWidth: 0 }}>
                Сбросить все
              </Button>
            </Box>
          )}

          {/* Column filter Menu */}
          <Menu
            open={!!filterMenu}
            anchorEl={filterMenu?.anchor}
            onClose={() => setFilterMenu(null)}
            slotProps={{ paper: { className: 'triplex-night-app', sx: { bgcolor: '#1f1f22', border: '1px solid #565b62', minWidth: 200, maxHeight: 340 } } }}
          >
            <Box sx={{ px: 1.5, py: 0.75 }}>
              <InputBase
                autoFocus
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Поиск…"
                startAdornment={<SearchIcon sx={{ fontSize: 14, mr: 0.5, color: 'var(--app-subtle-text)' }} />}
                sx={{ fontSize: '0.78rem', color: 'var(--app-text)', width: '100%', '& input::placeholder': { color: 'var(--app-subtle-text)', opacity: 1 } }}
              />
            </Box>
            <Divider sx={{ borderColor: 'var(--app-border)' }} />
            {filterMenu && (colUniqueValues[filterMenu.colIdx] ?? [])
              .filter(v => !filterSearch || v.toLowerCase().includes(filterSearch.toLowerCase()))
              .slice(0, 60)
              .map(val => {
                const selected = colFilters[filterMenu.colIdx]?.has(val) ?? false;
                return (
                  <MenuItem key={val} dense onClick={() => toggleColFilterValue(filterMenu.colIdx, val)}
                    sx={{ fontSize: '0.78rem', color: 'var(--app-text)', py: 0.4, gap: 0.5 }}>
                    <Checkbox checked={selected} size="small" sx={{ p: 0.25, color: 'var(--app-subtle-text)', '&.Mui-checked': { color: 'var(--app-accent)' } }} />
                    <ListItemText primary={val || '(пусто)'} primaryTypographyProps={{ fontSize: '0.78rem', color: val ? 'var(--app-text)' : 'var(--app-subtle-text)' }} />
                  </MenuItem>
                );
              })}
            {filterMenu && (colFilters[filterMenu.colIdx]?.size ?? 0) > 0 && (
              <>
                <Divider sx={{ borderColor: 'var(--app-border)' }} />
                <MenuItem dense onClick={() => { clearColFilter(filterMenu.colIdx); setFilterMenu(null); }}
                  sx={{ fontSize: '0.75rem', color: 'var(--app-subtle-text)', py: 0.5 }}>
                  Сбросить фильтр
                </MenuItem>
              </>
            )}
          </Menu>

          {/* Table */}
          <Box sx={{ flex: 1, overflow: 'hidden', p: 1.25 }}>
            {activeTabKey === 'vitrina' && vitrina ? (
              <Box sx={{ borderRadius: 2, border: '1px solid rgba(52,211,153,0.3)', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ px: 2, py: 0.75, borderBottom: '1px solid rgba(52,211,153,0.2)', bgcolor: 'rgba(52,211,153,0.04)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <TableChartIcon sx={{ fontSize: 14, color: '#34d399' }} />
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399' }}>
                    Витрина данных дашборда
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)', ml: 1 }}>
                    {vitrina.rows.length} строк · {vitrina.columns.length} столбцов
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <TableContainer sx={{ bgcolor: 'transparent' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 38, bgcolor: 'rgba(var(--app-panel-rgb),0.98)', color: 'var(--app-subtle-text)', fontSize: '0.68rem', fontWeight: 700, py: 0.75, px: 1, borderBottom: '1px solid rgba(52,211,153,0.25)' }}>#</TableCell>
                          {vitrina.columns.map(col => (
                            <TableCell key={col.key} sx={{ bgcolor: 'rgba(var(--app-panel-rgb),0.98)', color: '#34d399', fontSize: '0.7rem', fontWeight: 700, py: 0.75, px: 1.25, borderBottom: '1px solid rgba(52,211,153,0.25)', whiteSpace: 'nowrap' }}>
                              {col.label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {vitrina.rows.map((row, ri) => (
                          <TableRow key={ri} sx={{ bgcolor: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', '&:hover': { bgcolor: 'rgba(52,211,153,0.04)' } }}>
                            <TableCell sx={{ py: 0.4, px: 1, fontSize: '0.68rem', color: 'var(--app-subtle-text)', borderBottom: '1px solid rgba(86,91,98,0.2)' }}>{ri + 1}</TableCell>
                            {vitrina.columns.map(col => (
                              <TableCell key={col.key} sx={{ py: 0.4, px: 1.25, fontSize: '0.76rem', color: 'var(--app-text)', borderBottom: '1px solid rgba(86,91,98,0.2)', whiteSpace: 'nowrap' }}>
                                {row[col.key] ?? '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Box>
            ) : isVersionTab ? (
              versionLoading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LinearProgress sx={{ width: 200 }} />
                </Box>
              ) : versionPreview && versionPreview.headers.length > 0 ? (
                <Box sx={{ borderRadius: 2, border: '1px solid var(--app-border)', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', borderColor: 'rgba(167,139,250,0.3)' }}>
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    <TableContainer sx={{ bgcolor: 'transparent' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 38, bgcolor: 'rgba(var(--app-panel-rgb),0.98)', color: 'var(--app-subtle-text)', fontSize: '0.68rem', fontWeight: 700, py: 0.75, px: 1, borderBottom: '1px solid var(--app-border)' }}>#</TableCell>
                            {versionPreview.headers.map((h, ci) => (
                              <TableCell key={ci} sx={{ bgcolor: 'rgba(var(--app-panel-rgb),0.98)', color: '#c4b5fd', fontSize: '0.7rem', fontWeight: 700, py: 0.75, px: 1.25, borderBottom: '1px solid rgba(167,139,250,0.3)', whiteSpace: 'nowrap' }}>
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {versionPreview.rows.map((row, ri) => (
                            <TableRow key={ri} sx={{ bgcolor: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', '&:hover': { bgcolor: 'rgba(167,139,250,0.04)' } }}>
                              <TableCell sx={{ py: 0.4, px: 1, fontSize: '0.68rem', color: 'var(--app-subtle-text)', borderBottom: '1px solid rgba(86,91,98,0.25)' }}>{ri + 1}</TableCell>
                              {row.map((val, ci) => (
                                <TableCell key={ci} sx={{ py: 0.4, px: 1.25, fontSize: '0.76rem', color: 'var(--app-text)', borderBottom: '1px solid rgba(86,91,98,0.25)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                                  {val === '' || val === 'null' || val === 'None'
                                    ? <Typography component="span" sx={{ color: 'var(--app-subtle-text)', fontSize: '0.7rem', fontStyle: 'italic' }}>(пусто)</Typography>
                                    : val}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                  <Box sx={{ px: 2, py: 0.6, borderTop: '1px solid rgba(167,139,250,0.2)', display: 'flex', gap: 2, flexShrink: 0, bgcolor: 'rgba(var(--app-panel-rgb),0.6)' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#a78bfa' }}>{activeVersion?.name}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)' }}>{activeVersion?.row_count.toLocaleString('ru')} строк</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)' }}>{activeVersion?.column_count} столбцов</Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.88rem' }}>Нет данных для отображения</Typography>
                </Box>
              )
            ) : displayData.length > 0 ? (
              <Box sx={{ borderRadius: 2, border: '1px solid var(--app-border)', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box ref={tableRef}
                  onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
                  sx={{ flex: 1, overflow: 'auto', overflowX: 'auto', overflowY: 'auto' }}>
                  <TableContainer sx={{ bgcolor: 'transparent', minWidth: totalWidth }}>
                    <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', minWidth: totalWidth }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{
                            width: 38, bgcolor: 'rgba(var(--app-panel-rgb),0.98)', color: 'var(--app-subtle-text)',
                            fontSize: '0.68rem', fontWeight: 700, py: 0.75, px: 1, borderBottom: '1px solid var(--app-border)',
                          }}>#</TableCell>
                          {headers.map((h, ci) => {
                            const sev = colSeverity.get(h);
                            const s = sev ? SEV[sev] : null;
                            const fixed = justFixedCols.has(h);
                            const isSorted = sortCol === ci;
                            const hasFilter = !!colFilters[ci];
                            return (
                              <TableCell key={ci} sx={{
                                bgcolor: fixed ? 'rgba(63,185,80,0.10)' : s ? `${s.colBg}` : 'rgba(var(--app-panel-rgb),0.98)',
                                color: fixed ? '#3fb950' : s ? s.color : 'var(--app-subtle-text)',
                                fontSize: '0.7rem', fontWeight: 700,
                                py: 0.75, px: 1.25,
                                borderBottom: fixed ? '2px solid rgba(63,185,80,0.5)' : s ? `2px solid ${s.colBorder}` : '1px solid var(--app-border)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                width: getColWidth(h),
                                transition: 'background 0.3s, color 0.3s',
                                cursor: 'pointer',
                                userSelect: 'none',
                                '&:hover': { bgcolor: fixed ? 'rgba(63,185,80,0.15)' : s ? s.colBg : 'rgba(var(--app-accent-rgb),0.08)' },
                              }}
                                onClick={() => handleSortClick(ci)}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                    {h}
                                    {fixed && <Box component="span" sx={{ ml: 0.5, fontSize: '0.6rem' }}>✓</Box>}
                                    {!fixed && s && <Box component="span" sx={{ ml: 0.5, fontSize: '0.6rem', opacity: 0.8 }}>▲</Box>}
                                  </Box>
                                  {isSorted && (
                                    sortDir === 'asc'
                                      ? <ArrowUpwardIcon sx={{ fontSize: 11, opacity: 0.8, flexShrink: 0 }} />
                                      : <ArrowDownwardIcon sx={{ fontSize: 11, opacity: 0.8, flexShrink: 0 }} />
                                  )}
                                  <Tooltip title="Фильтр по колонке">
                                    <Box
                                      component="span"
                                      onClick={e => handleFilterIconClick(e, ci)}
                                      sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: hasFilter ? 1 : 0.35, '&:hover': { opacity: 1 } }}
                                    >
                                      <FilterListIcon sx={{ fontSize: 12, color: hasFilter ? 'var(--app-accent)' : 'inherit' }} />
                                    </Box>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {startIdx > 0 && (
                          <TableRow sx={{ height: startIdx * ROW_HEIGHT }}>
                            <TableCell colSpan={headers.length + 1} sx={{ p: 0, border: 'none' }} />
                          </TableRow>
                        )}
                        {visibleRows.map((row, relIdx) => {
                          const absIdx = startIdx + relIdx;
                          return (
                            <TableRow key={absIdx} sx={{
                              minHeight: ROW_HEIGHT,
                              bgcolor: absIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                              '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.04)' },
                            }}>
                              <TableCell sx={{ py: 0.4, px: 1, fontSize: '0.68rem', color: 'var(--app-subtle-text)', borderBottom: '1px solid rgba(86,91,98,0.25)' }}>
                                {absIdx + 1}
                              </TableCell>
                              {headers.map((_, ci) => {
                                const val = row[ci] ?? '';
                                const cs = getCellStyle(absIdx, ci, val);
                                const cellKey = `${absIdx + 1}:${ci}`;
                                const isHighlighted = highlightCells.has(cellKey);
                                const colName = headers[ci] ?? '';
                                const issueCell = issueCellMap.get(cellKey);
                                const tooltipText = isHighlighted
                                  ? (selectedIssue?.description ?? issueCell?.description)
                                  : issueCell?.description;
                                const cell = (
                                  <TableCell key={ci} sx={{
                                    py: 0.4, px: 1.25,
                                    fontSize: '0.76rem',
                                    color: (cs as React.CSSProperties).color ?? 'var(--app-text)',
                                    background: (cs as React.CSSProperties).background,
                                    outline: (cs as React.CSSProperties).outline,
                                    outlineOffset: (cs as React.CSSProperties).outlineOffset,
                                    fontStyle: (cs as React.CSSProperties).fontStyle,
                                    fontWeight: (cs as React.CSSProperties).fontWeight,
                                    borderBottom: '1px solid rgba(86,91,98,0.25)',
                                    whiteSpace: getColWidth(headers[ci] ?? '') >= 160 ? 'normal' : 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: getColWidth(headers[ci] ?? '') >= 160 ? 'unset' : 'ellipsis',
                                    width: getColWidth(headers[ci] ?? ''),
                                    lineHeight: 1.35,
                                    verticalAlign: 'top',
                                    transition: 'background 0.15s',
                                    p: editMode ? 0 : undefined,
                                    cursor: tooltipText ? 'help' : 'default',
                                  }}>
                                    {editMode ? (
                                      <input
                                        value={val}
                                        onChange={e => handleCellEdit(absIdx + 1, ci, e.target.value)}
                                        style={{
                                          width: '100%', background: highlightCells.has(`${absIdx + 1}:${ci}`) ? `${highlightColor}18` : 'transparent',
                                          border: `1px solid ${highlightCells.has(`${absIdx + 1}:${ci}`) ? highlightColor : '#30363d'}`,
                                          borderRadius: 3, color: '#e6edf3',
                                          padding: '3px 8px', fontSize: '0.76rem',
                                          fontFamily: 'inherit', outline: 'none',
                                        }}
                                      />
                                    ) : (
                                      (() => {
                                        const isDate = DATE_COLS.has(headers[ci] ?? '');
                                        if (isBlankValue(val)) return isDate
                                          ? <Typography component="span" sx={{ color: 'var(--app-subtle-text)', fontSize: '0.76rem' }}>—</Typography>
                                          : <Typography component="span" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontStyle: 'italic' }}>(пусто)</Typography>;
                                        if (isDate) return val.replace(/\s+0?:00:00$/, '');
                                        return val;
                                      })()
                                    )}
                                  </TableCell>
                                );
                                return tooltipText ? (
                                  <Tooltip key={ci} title={
                                    <Box>
                                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, mb: 0.3, color: isHighlighted ? highlightColor : (SEV[issueCell?.severity ?? 'warning']?.color ?? '#fbbf24') }}>
                                        {colName}
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.45 }}>{tooltipText}</Typography>
                                    </Box>
                                  } placement="top" arrow
                                    slotProps={{ tooltip: { sx: { bgcolor: 'var(--app-panel)', border: '1px solid var(--app-border)', maxWidth: 280, p: 1.25 } }, arrow: { sx: { color: 'var(--app-panel)' } } }}
                                  >
                                    {cell}
                                  </Tooltip>
                                ) : cell;
                              })}
                            </TableRow>
                          );
                        })}
                        {endIdx < dataRows.length && (
                          <TableRow sx={{ height: (dataRows.length - endIdx) * ROW_HEIGHT }}>
                            <TableCell colSpan={headers.length + 1} sx={{ p: 0, border: 'none' }} />
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Footer */}
                {activeSheet && (
                  <Box sx={{ px: 2, py: 0.6, borderTop: '1px solid var(--app-border)', display: 'flex', gap: 2, flexShrink: 0, bgcolor: 'rgba(var(--app-panel-rgb),0.6)' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)' }}>{activeSheet.rows.toLocaleString('ru')} строк</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)' }}>{activeSheet.cols} столбцов</Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)' }}>{activeSheet.name}</Typography>
                    {editMode && <Typography sx={{ fontSize: '0.7rem', color: '#60a5fa', ml: 'auto' }}>✏ Редактирование активно</Typography>}
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.88rem' }}>Выберите файл</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Fix preview dialog */}
      <FixPreviewDialog
        open={fixDialogIssue !== null}
        issue={fixDialogIssue}
        rows={fixDialogRows}
        onRowChange={handleFixDialogRowChange}
        onConfirm={handleFixConfirm}
        onCancel={() => { setFixDialogIssue(null); setFixDialogRows([]); }}
      />

      <Dialog
        open={fixAllDialogOpen}
        onClose={() => setFixAllDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ className: 'triplex-night-app', sx: { bgcolor: 'var(--app-panel)', border: '1px solid var(--app-border)' } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid var(--app-border)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFixHighIcon sx={{ color: 'var(--app-accent)', fontSize: 20 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, color: 'var(--app-text)' }}>Подтвердите массовое исправление</Typography>
              <Typography sx={{ fontSize: '0.76rem', color: 'var(--app-subtle-text)' }}>
                Будут отмечены исправленными все текущие нерешённые проблемы качества.
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.25 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, mb: 2 }}>
            <Box sx={{ p: 1.25, border: '1px solid var(--app-border)', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--app-text)' }}>{remaining}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)' }}>всего проблем</Typography>
            </Box>
            <Box sx={{ p: 1.25, border: '1px solid rgba(248,113,113,0.35)', borderRadius: 1.5, bgcolor: 'rgba(248,113,113,0.06)' }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171' }}>
                {issues.filter(i => i.severity === 'error' && !isIssueResolved(i, confirmedDiffs)).length}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)' }}>ошибок</Typography>
            </Box>
            <Box sx={{ p: 1.25, border: '1px solid rgba(251,191,36,0.35)', borderRadius: 1.5, bgcolor: 'rgba(251,191,36,0.06)' }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                {issues.filter(i => i.severity === 'warning' && !isIssueResolved(i, confirmedDiffs)).length}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)' }}>предупреждений</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.84rem', color: 'var(--app-subtle-text)', lineHeight: 1.55 }}>
            Для точечного контроля используйте иконку исправления рядом с конкретной проблемой: там доступен построчный предпросмотр и ручное изменение значений.
            Массовое исправление быстро закрывает список и сохраняет текущую таблицу как рабочую версию в интерфейсе.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setFixAllDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button variant="contained" startIcon={<AutoFixHighIcon />} onClick={handleFixAll} disabled={remaining === 0} sx={{ textTransform: 'none' }}>
            Исправить {remaining}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataView;

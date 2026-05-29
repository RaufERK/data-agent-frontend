import { api } from '../api';
import type { QualityResult } from '../api';
import { DEFAULT_PETAL_ENABLED } from '../components/Layout/petalFlow';
import type {
  MockChartTable,
  MockChart,
  PetalKey,
  PetalStatus,
  PetalStatuses,
  Project,
  QualityIssue,
  UploadedFile,
} from '../types';

export type ImageWidgetMeta = Record<string, {
  title: string;
  type: string;
  color: string | null;
  stacked?: boolean;
  is_horizontal?: boolean;
  position?: { left: number; top: number; width: number; height: number } | null;
  series_colors?: string[] | null;
  gauge_value?: number | null;
  gauge_max?: number | null;
}>;

export type ImageKpiPayload = Array<{
  metric_name: string;
  value: number | null;
  unit: string | null;
  note?: string | null;
  sparkline?: number[];
  sparkline_type?: 'bar' | 'line';
  breakdown?: Array<{ label: string; value: string }>;
  position?: { left: number; top: number; width: number; height: number } | null;
  visual_type?: string;
  progress_max?: number | null;
}>;

export type ImageFactDashboardRow = {
  widget_id: number;
  widget_title: string;
  widget_type: string;
  category: string | null;
  series: string | null;
  value: number | null;
};

export const DEFAULT_PETALS: PetalStatuses = {
  data: 'grey',
  detail: 'grey',
  mart: 'grey',
  model: 'grey',
  mockup: 'grey',
  dashboard: 'grey',
};

export const withPetalStatus = (statuses: PetalStatuses, key: PetalKey, status: PetalStatus): PetalStatuses => ({
  ...statuses,
  [key]: status,
});

const generateId = () => 'proj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const makeNewProject = (name: string): Project => ({
  id: generateId(),
  name,
  createdAt: new Date().toISOString(),
  files: [],
  imageFile: null,
  issues: [],
  detailTables: [],
  selectedERDModel: 'star',
  erdGenerated: false,
  dashboardBuilt: false,
  widgets: [],
  dashboardCharts: [],
  dataVersions: [],
  status: 'empty',
  petalStatuses: { ...DEFAULT_PETALS },
  petalEnabled: { ...DEFAULT_PETAL_ENABLED },
});

export const STORAGE_KEY = 'data_agent_projects_v1';
export const SESSION_STORAGE_KEY = 'data_agent_session_v1';

export function loadFromStorage(): { projects: Project[]; activeProjectId: string | null; sessionId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { projects: [], activeProjectId: null, sessionId };
    const { projects, activeProjectId } = JSON.parse(raw);
    const normalizedProjects = (projects ?? []).map((project: Project) => {
      const dashboardCharts = Array.isArray(project?.dashboardCharts) ? project.dashboardCharts : [];
      return {
        ...project,
        widgets: Array.isArray(project?.widgets) ? project.widgets : [],
        dashboardBuilt: Boolean(project?.dashboardBuilt),
        dashboardCharts,
        dataVersions: Array.isArray(project?.dataVersions) ? project.dataVersions : [],
      };
    });
    return { projects: normalizedProjects, activeProjectId: activeProjectId ?? null, sessionId };
  } catch {
    return { projects: [], activeProjectId: null, sessionId: null };
  }
}

export function saveToStorage(projects: Project[], activeProjectId: string | null) {
  try {
    const clean = projects.map(p => ({
      ...p,
      files: p.files.map(f => ({ ...f, _rawFile: undefined })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: clean, activeProjectId }));
  } catch { /* quota exceeded - ignore */ }
}

export const tableNameFromFileName = (fileName: string) => fileName.replace(/\.[^.]+$/, '').replace(/\s+/g, '_').replace(/-/g, '_');

const findUploadedFileForTable = (files: UploadedFile[], tableName: string) => (
  files.find(file => tableNameFromFileName(file.name) === tableName || file.name === tableName) ?? null
);

const describeQualityIssue = (type: QualityResult['columns'][number]['issues'][number]['type'], count: number, pct?: number) => {
  switch (type) {
    case 'null':
      return `Пустые значения: ${count} строк (${pct?.toFixed(1) ?? '?'}%)`;
    case 'duplicate':
      return `Дубликаты: ${count} строк`;
    case 'case_mismatch':
      return `Разный регистр: ${count} вариантов`;
    case 'invalid_date':
      return `Некорректные даты: ${count} строк`;
    case 'date_order':
      return `Дата окончания раньше даты выдачи: ${count} строк`;
    case 'non_numeric':
      return `Нечисловые значения: ${count} строк`;
    case 'missing_required_approval':
      return `Требуется СЭБ, но поле пустое: ${count} строк`;
    case 'reference_mismatch':
      return `Не найдено в справочнике: ${count} строк`;
    default:
      return `Проблема качества: ${count} строк`;
  }
};

export const matrixFromQueryResult = (columns: string[], data: Record<string, unknown>[]) => (
  [columns, ...data.map(row => columns.map(column => String(row[column] ?? '')))]
);

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const fileFromPreviewMatrix = (fileName: string, preview: string[][]) => {
  const csv = preview.map(row => row.map(csvEscape).join(',')).join('\n');
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'dataset';
  return new File([`\uFEFF${csv}`], `${baseName}.csv`, { type: 'text/csv;charset=utf-8' });
};

export const uploadedFileFromBackendPreview = async (
  sessionId: string,
  file: File,
  tableName: string,
  rowCount: number,
  fallbackColumns: string[],
): Promise<UploadedFile> => {
  try {
    const preview = await api.getTablePreview(sessionId, tableName, 200);
    const matrix = matrixFromQueryResult(preview.columns, preview.data);
    return {
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)} KB`,
      sheets: [{
        name: tableName,
        rows: rowCount,
        cols: preview.columns.length,
        preview: matrix,
      }],
      status: 'done',
      _rawFile: file,
    };
  } catch (error) {
    console.warn('Backend preview fetch failed for', file.name, error);
    return {
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)} KB`,
      sheets: [{
        name: tableName,
        rows: rowCount,
        cols: fallbackColumns.length,
        preview: [fallbackColumns],
      }],
      status: 'done',
      _rawFile: file,
    };
  }
};

export const buildIssuesFromQualityResults = (
  currentFiles: UploadedFile[],
  results: QualityResult[],
): QualityIssue[] => {
  let issueId = 1;
  const issues: QualityIssue[] = [];
  for (const result of results) {
    const matchedFile = findUploadedFileForTable(currentFiles, result.table_name);
    const fileName = matchedFile?.name ?? result.table_name;
    const sheetName = matchedFile?.sheets[0]?.name ?? result.table_name;
    for (const col of result.columns) {
      for (const qi of col.issues) {
        issues.push({
          id: issueId++,
          severity: qi.severity,
          file: fileName,
          sheet: sheetName,
          column: col.column,
          description: describeQualityIssue(qi.type, qi.count, qi.pct),
          affected: qi.count,
          rows: qi.rows,
          autofix: true,
        });
      }
    }
  }
  return issues;
};

export const normalizeImageDashboardWidgetType = (type: string) => {
  if (type === 'bar_horizontal') return 'hbar';
  if (type === 'big_number') return 'kpi';
  if (type === 'mosaic_map') return 'country_map';
  if (type === 'pivot_table' || type === 'pivot_table_v2') return 'table';
  return type;
};

export const shouldRenderImageChartAsStackedHbar = (
  _title: string,
  type: string,
  rows: Array<{ category: string | null; series: string | null; value: number | null }>,
  stacked?: boolean,
) => {
  if (type === 'hbar') return true;
  if (type === 'table') return false;
  if (stacked) return true;
  const categories = new Set(rows.map(row => row.category).filter(Boolean));
  const series = new Set(rows.map(row => row.series).filter(Boolean));
  return categories.size >= 2 && series.size >= 2;
};

const formatImageDashboardCell = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

export const formatImageKpiValue = (value: number | null, unit?: string | null) => {
  if (value === null || value === undefined) return '—';
  const formatted = Number.isInteger(value)
    ? value.toLocaleString('ru-RU')
    : value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
};

export const buildImageDashboardTable = (
  title: string,
  rows: Array<{ category: string | null; series: string | null; value: number | null }>,
): MockChartTable => {
  if (rows.length === 0) {
    return {
      columns: ['Показатель', 'Значение'],
      rows: [[title, 'Строки не распознаны']],
    };
  }

  const hasSeries = rows.some(row => row.series !== null && row.series !== undefined && String(row.series).trim() !== '');
  const hasValue = rows.some(row => row.value !== null && row.value !== undefined);

  if (hasSeries) {
    const seriesNames = Array.from(new Set(rows.map(r => r.series).filter((s): s is string => s !== null && s !== undefined && s.trim() !== '')));
    const categoryNames = Array.from(new Set(rows.map(r => r.category).filter((c): c is string => c !== null && c !== undefined && c.trim() !== '')));
    if (seriesNames.length > 1 && categoryNames.length > 0) {
      const tableColumns = [title || 'Показатель', ...seriesNames];
      const tableRows = categoryNames.map(cat => {
        const cells: string[] = [cat];
        for (const col of seriesNames) {
          const match = rows.find(r => r.category === cat && r.series === col);
          cells.push(formatImageDashboardCell(match?.value ?? null));
        }
        return cells;
      });
      return { columns: tableColumns, rows: tableRows };
    }
    return {
      columns: ['Показатель', 'Группа', 'Значение'],
      rows: rows.map((row, index) => [
        formatImageDashboardCell(row.category || `Строка ${index + 1}`),
        formatImageDashboardCell(row.series),
        formatImageDashboardCell(row.value),
      ]),
    };
  }

  if (hasValue) {
    return {
      columns: ['Показатель', 'Значение'],
      rows: rows.map((row, index) => [
        formatImageDashboardCell(row.category || `Строка ${index + 1}`),
        formatImageDashboardCell(row.value),
      ]),
    };
  }

  return {
    columns: ['Показатель'],
    rows: rows.map((row, index) => [
      formatImageDashboardCell(row.category || row.series || `Строка ${index + 1}`),
    ]),
  };
};

export const buildImageDashboardCharts = (
  widgetMeta: ImageWidgetMeta,
  kpis: ImageKpiPayload,
  factDashboard?: ImageFactDashboardRow[],
): MockChart[] => {
  const palette = ['#7b5ea7', '#ef6a5b', '#f5c842', '#2f89ff', '#18b6b2', '#f0a04b', '#3cb371', '#7a5bd1'];
  const charts: MockChart[] = [];

  for (const kpi of kpis) {
    const visualType = String(kpi.visual_type || '').trim().toLowerCase();
    charts.push({
      title: kpi.metric_name,
      type: 'kpi',
      description: '',
      metrics: [kpi.metric_name],
      sourceLabel: 'mockup',
      value: formatImageKpiValue(kpi.value, kpi.unit),
      subtitle: undefined,
      trend: kpi.note ?? undefined,
      sparkline: kpi.sparkline,
      sparklineType: kpi.sparkline_type,
      kpiBreakdown: kpi.breakdown,
      position: kpi.position ?? null,
      colSpan: 3,
      rowSpan: 2,
      visualType: visualType || undefined,
      progressMax: visualType === 'progress' ? (kpi.progress_max ?? 100) : null,
    });
  }

  for (const [widId, widget] of Object.entries(widgetMeta)) {
    const widgetId = Number(widId);
    const rows = factDashboard?.filter(row => row.widget_id === widgetId) ?? [];
    const rawType = normalizeImageDashboardWidgetType(widget.is_horizontal ? 'bar_horizontal' : widget.type);
    const type = shouldRenderImageChartAsStackedHbar(widget.title, rawType, rows, widget.stacked) ? 'hbar' : rawType;

    const chart: MockChart = {
      title: widget.title,
      type,
      description: '',
      metrics: [widget.title],
      sourceLabel: 'mockup',
      color: widget.color ?? undefined,
      colSpan: 6,
      rowSpan: 3,
      position: widget.position ?? null,
      seriesColors: widget.series_colors ?? null,
      stacked: Boolean(widget.stacked) || type === 'hbar',
    };

    if (type === 'gauge') {
      const gaugeValue = widget.gauge_value;
      chart.value = gaugeValue != null ? formatImageKpiValue(gaugeValue, null) : widget.title;
      chart.colSpan = 3;
      chart.rowSpan = 3;
      chart.progressMax = widget.gauge_max ?? null;
    } else if (type === 'table') {
      chart.table = buildImageDashboardTable(widget.title, rows);
      chart.colSpan = 6;
      const tableRowCount = chart.table.rows.length;
      chart.rowSpan = tableRowCount > 10 ? 4 : tableRowCount > 5 ? 3 : tableRowCount > 0 ? 2 : 1;
    } else if (rows.length > 0) {
      const categories = Array.from(new Set(rows.map(row => row.category ?? '').filter(Boolean)));
      const seriesNames = Array.from(new Set(rows.map(row => row.series ?? '').filter(Boolean)));
      const values = rows.map(row => row.value ?? 0);

      if (type === 'pie' || type === 'donut') {
        const total = values.reduce((sum, value) => sum + value, 0) || 1;
        chart.slices = categories.map((category, index) => {
          const catValue = rows.find(r => r.category === category)?.value ?? 0;
          return {
            label: category,
            value: Math.round((catValue / total) * 100),
            displayValue: `${Math.round((catValue / total) * 100)}%`,
            color: widget.series_colors?.[index] ?? palette[index % palette.length],
          };
        });
      } else if (seriesNames.length > 0) {
        chart.categories = categories.length > 0 ? categories : Array.from(new Set(rows.map((_, index) => `Строка ${index + 1}`)));
        chart.series = seriesNames.map((seriesName, seriesIndex) => ({
          name: seriesName,
          color: widget.series_colors?.[seriesIndex] ?? palette[seriesIndex % palette.length],
          values: chart.categories!.map(category => (
            rows
              .filter(row => (row.category ?? '') === category && (row.series ?? '') === seriesName)
              .reduce((sum, row) => sum + (row.value ?? 0), 0)
          )),
          valueLabels: chart.categories!.map(category => {
            const value = rows
              .filter(row => (row.category ?? '') === category && (row.series ?? '') === seriesName)
              .reduce((sum, row) => sum + (row.value ?? 0), 0);
            return value ? value.toLocaleString('ru-RU') : '';
          }),
        }));
      } else {
        chart.categories = categories.length > 0 ? categories : rows.map((_, index) => `Строка ${index + 1}`);
        chart.series = [{
          name: widget.title,
          values,
          color: widget.color ?? palette[0],
          valueLabels: values.map(value => value ? value.toLocaleString('ru-RU') : ''),
        }];
      }
    }

    charts.push(chart);
  }

  return charts;
};

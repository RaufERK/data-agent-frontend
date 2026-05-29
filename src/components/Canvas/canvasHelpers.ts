import type { MockupElementStats } from '../../types';

export type UploadState =
  | 'idle'
  | 'uploading'
  | 'detected_image'
  | 'analyzing_image'
  | 'analyzed_image'
  | 'detected_data'
  | 'detected_mixed'
  | 'analyzing_mixed'
  | 'analyzed_mixed'
  | 'building_dashboard'
  | 'done';

export interface MockupAnalysisResult {
  totalElements: number;
  kpiCount: number;
  chartCount: number;
  elementsByType: MockupElementStats[];
  vitrina?: {
    FactDashboard: Array<{ widget_id: number; widget_title: string; widget_type: string; category: string | null; series: string | null; value: number | null }>;
    FactKPIs: Array<{ kpi_id: number; metric_code: string; metric_name: string; value: number | null; unit: string | null; note: string | null }>;
    widget_meta: Record<string, { title: string; type: string; color: string | null; stacked: boolean; is_horizontal: boolean }>;
  };
}

interface AnalyzeImageResult {
  vitrina: NonNullable<MockupAnalysisResult['vitrina']>;
  summary: { charts_detected: number; kpis_detected: number };
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.pdf'];
const DATA_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.tsv', '.json'];

export const UI = {
  text: 'var(--app-text)',
  muted: 'var(--app-subtle-text)',
  border: 'var(--app-border)',
  borderStrong: 'var(--app-border-strong)',
  accent: 'var(--app-accent)',
  accentSoft: 'rgba(var(--app-accent-rgb), 0.08)',
  accentSoftStrong: 'rgba(var(--app-accent-rgb), 0.14)',
  panel: 'var(--app-panel)',
  surface: 'var(--app-surface)',
  surfaceAlt: 'rgba(var(--app-surface-alt-rgb), 0.96)',
  violetSoft: 'rgba(var(--app-violet-rgb), 0.12)',
  violetBorder: 'rgba(var(--app-violet-rgb), 0.34)',
};

export const flatPanelSx = {
  width: '100%',
  maxWidth: 980,
  p: { xs: 2.5, md: 3 },
  borderRadius: 2,
  border: 'none',
  bgcolor: 'rgba(var(--app-surface-alt-rgb), 0.94)',
  boxShadow: 'none',
} as const;

export const imagePreviewFrameSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: { xs: 220, md: 280 },
  bgcolor: 'rgba(255,255,255,0.02)',
  overflow: 'hidden',
} as const;

export function chartTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    big_number: 'KPI-карточка',
    bar: 'Гистограмма',
    bar_horizontal: 'Гор.гистограмма',
    line: 'Линейный график',
    area: 'График областей',
    pie: 'Круговая диаграмма',
    donut: 'Кольцевая диаграмма',
    table: 'Таблица',
    funnel: 'Воронка',
    scatter: 'Точечная',
    sankey: 'Санки',
    radar: 'Радар',
    country_map: 'Карта',
  };
  return labels[type] ?? type;
}

export function detectFileType(fileName: string): 'image' | 'data' | 'unknown' {
  const lower = fileName.toLowerCase();
  if (IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'image';
  if (DATA_EXTENSIONS.some(ext => lower.endsWith(ext))) return 'data';
  return 'unknown';
}

export const buildMockupAnalysisResult = (result: AnalyzeImageResult): MockupAnalysisResult => {
  const widgetMeta = result.vitrina.widget_meta;
  const byType: Record<string, { label: string; items: { title: string; confidence: number }[] }> = {};

  Object.values(widgetMeta).forEach((widget) => {
    const type = widget.type;
    if (!byType[type]) byType[type] = { label: chartTypeLabel(type), items: [] };
    byType[type].items.push({ title: widget.title, confidence: 0.9 });
  });

  const kpiItems = result.vitrina.FactKPIs.map(kpi => ({ title: kpi.metric_name, confidence: 0.9 }));
  if (kpiItems.length > 0) {
    byType.big_number = { label: 'KPI-карточка', items: kpiItems };
  }

  return {
    totalElements: result.summary.charts_detected + result.summary.kpis_detected,
    kpiCount: result.summary.kpis_detected,
    chartCount: result.summary.charts_detected,
    elementsByType: Object.entries(byType).map(([type, value]) => ({
      type,
      label: value.label,
      count: value.items.length,
      items: value.items,
    })),
    vitrina: result.vitrina,
  };
};

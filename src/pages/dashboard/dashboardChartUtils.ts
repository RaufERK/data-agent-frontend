import type {
  DashboardFilter,
  DashboardWidgetType,
  MockChart,
  MockChartSeries,
  MockChartSlice,
} from '../../types';
import {
  DASHBOARD_MAX_COLUMNS,
  DASHBOARD_ROW_HEIGHT,
  clamp,
  getWidgetAccent,
  type ChartItem,
} from './dashboardShared';

export const PALETTE_TYPE_LABELS: Record<DashboardWidgetType, string> = {
  kpi: 'KPI',
  chart: 'График',
  table: 'Таблица',
  filter: 'Фильтр',
};

export const EDITOR_COLOR_PRESETS = [
  { name: 'Teal', colors: ['#18b6b2', '#5ad0ca', '#9ae4df'] },
  { name: 'Blue', colors: ['#2f89ff', '#68a8ff', '#9fc6ff'] },
  { name: 'Violet', colors: ['#7a5bd1', '#9b84e0', '#bcaaf0'] },
  { name: 'Amber', colors: ['#f5c84c', '#ffd973', '#ffe8a8'] },
  { name: 'Green', colors: ['#4cc38a', '#79d5a8', '#abe8ca'] },
  { name: 'Coral', colors: ['#ef6a5b', '#f48d83', '#f8b3ad'] },
];

export const CHART_THEME_PRESETS = [
  { id: 'executive-dark', name: 'Executive Dark', colors: ['#36d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'] },
  { id: 'finance-light', name: 'Finance Light', colors: ['#0f766e', '#2563eb', '#ca8a04', '#16a34a', '#64748b'] },
  { id: 'consulting-blue', name: 'Consulting Blue', colors: ['#1d4ed8', '#38bdf8', '#0f766e', '#f59e0b', '#6366f1'] },
  { id: 'operations-high-contrast', name: 'Operations High Contrast', colors: ['#22c55e', '#f97316', '#ef4444', '#0ea5e9', '#eab308'] },
  { id: 'pastel-report', name: 'Pastel Report', colors: ['#7dd3fc', '#86efac', '#fde68a', '#f9a8d4', '#c4b5fd'] },
];

export const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const normalizeChartType = (type: string) => {
  if (type === 'bar-horizontal' || type === 'bar_horizontal') return 'hbar';
  if (type === 'big_number') return 'kpi';
  if (type === 'mosaic_map') return 'country_map';
  return type;
};

const getDefaultWidgetLayout = (chart: MockChart | ChartItem) => {
  switch (normalizeChartType(chart.type)) {
    case 'kpi':
      return { colSpan: 3, rowSpan: 2 };
    case 'gauge':
      return { colSpan: 4, rowSpan: 3 };
    case 'filter':
      return { colSpan: 4, rowSpan: 2 };
    case 'table':
      return { colSpan: 6, rowSpan: 2 };
    case 'pie':
    case 'donut':
      return { colSpan: 4, rowSpan: 3 };
    case 'country_map':
      return { colSpan: 6, rowSpan: 4 };
    default:
      return { colSpan: 6, rowSpan: 3 };
  }
};

export const normalizeChartLayout = (chart: MockChart | ChartItem) => {
  const defaults = getDefaultWidgetLayout(chart);
  const chartType = normalizeChartType(chart.type);
  const explicitRowSpan = (chart as ChartItem).rowSpan ?? defaults.rowSpan;
  const compactTableRowSpan = chartType === 'table' && chart.table?.rows && chart.table.rows.length <= 3
    ? Math.min(explicitRowSpan, 2)
    : explicitRowSpan;
  const minRowSpan = chartType === 'table' ? 2 : 2;
  return {
    colSpan: clamp((chart as ChartItem).colSpan ?? defaults.colSpan, 3, DASHBOARD_MAX_COLUMNS),
    rowSpan: clamp(compactTableRowSpan, minRowSpan, 6),
  };
};

export const getDashboardColumnCount = () => {
  if (typeof window === 'undefined') return DASHBOARD_MAX_COLUMNS;
  if (window.innerWidth >= 1200) return DASHBOARD_MAX_COLUMNS;
  if (window.innerWidth >= 600) return 6;
  return 1;
};

const valuesIntersect = (left: string[], right: string[]) => {
  const rightSet = new Set(right.map(value => String(value)));
  return left.some(value => rightSet.has(String(value)));
};

export function applyDashboardFilter(chart: ChartItem, filter: DashboardFilter): ChartItem {
  if (chart.type === 'filter') return chart;

  let nextChart = chart;
  const selectionGroups = Object.values(filter.selections ?? {}).filter(values => values.length > 0);

  selectionGroups.forEach(selectedValues => {
    if (nextChart.categories?.length && nextChart.series?.length) {
      const categoryValues = nextChart.categories.map(String);
      if (!valuesIntersect(categoryValues, selectedValues)) return;
      const keepIndices = categoryValues
        .map((cat, i) => ({ cat, i }))
        .filter(({ cat }) => selectedValues.includes(cat))
        .map(({ i }) => i);
      if (keepIndices.length === categoryValues.length || keepIndices.length === 0) return;
      nextChart = {
        ...nextChart,
        categories: keepIndices.map(i => nextChart.categories![i]),
        series: nextChart.series!.map(s => ({
          ...s,
          values: keepIndices.map(i => s.values[i] ?? 0),
          valueLabels: keepIndices.map(i => s.valueLabels?.[i] ?? ''),
        })),
      };
      return;
    }

    if (nextChart.slices?.length) {
      const sliceLabels = nextChart.slices.map(slice => String(slice.label));
      if (!valuesIntersect(sliceLabels, selectedValues)) return;
      const slices = nextChart.slices.filter(slice => selectedValues.includes(String(slice.label)));
      if (slices.length === nextChart.slices.length || slices.length === 0) return;
      nextChart = { ...nextChart, slices };
    }
  });

  if (!nextChart.categories || !nextChart.series || !filter.excludeRegions?.length) return nextChart;
  const keepIndices = nextChart.categories
    .map((cat, i) => ({ cat, i }))
    .filter(({ cat }) => !filter.excludeRegions!.includes(cat))
    .map(({ i }) => i);
  if (keepIndices.length === nextChart.categories.length) return nextChart;
  return {
    ...nextChart,
    categories: keepIndices.map(i => nextChart.categories![i]),
    series: nextChart.series!.map(s => ({
      ...s,
      values: keepIndices.map(i => s.values[i] ?? 0),
      valueLabels: keepIndices.map(i => s.valueLabels?.[i] ?? ''),
    })),
  };
}

export const getWidgetMinHeight = (chart: ChartItem) => {
  const chartHeight = chart.rowSpan * DASHBOARD_ROW_HEIGHT;
  switch (chart.type) {
    case 'kpi':
      return Math.max(150, chartHeight);
    case 'gauge':
      return Math.max(180, chartHeight);
    case 'filter':
      return Math.max(145, chartHeight);
    case 'table':
      return chartHeight;
    case 'pie':
    case 'donut':
      return Math.max(210, chartHeight);
    case 'country_map':
      return Math.max(240, chartHeight);
    default:
      return Math.max(215, chartHeight);
  }
};

const getPaletteTypeByActualType = (type: string): DashboardWidgetType => {
  if (type === 'kpi') return 'kpi';
  if (type === 'table') return 'table';
  if (type === 'filter') return 'filter';
  return 'chart';
};

export const createChartItem = (chart: MockChart, id: number): ChartItem => ({
  id,
  ...deepClone(chart),
  type: normalizeChartType(chart.type),
  ...normalizeChartLayout(chart),
});

export const getPrimaryChartColor = (chart: MockChart) => getWidgetAccent(chart);

const isDateLikeFilter = (chart: MockChart | ChartItem) => {
  const haystack = [
    chart.title,
    chart.description,
    chart.filter?.field,
    chart.filter?.source,
  ].filter(Boolean).join(' ').toLowerCase();
  return /date|дата|месяц|month|period|период|created|создан/.test(haystack);
};

const hasLongCategoryLabels = (chart: ChartItem) => {
  const cats = chart.categories ?? [];
  if (cats.length === 0) return false;
  const avgLen = cats.reduce((sum, c) => sum + String(c).length, 0) / cats.length;
  return avgLen > 7 || cats.some(c => String(c).length > 12);
};

export const getCompactWidgetLayout = (chart: ChartItem): { colSpan: number; rowSpan: number; type?: string } => {
  const type = normalizeChartType(chart.type);
  const title = (chart.title || '').toLowerCase();
  const categoryCount = chart.categories?.length ?? chart.slices?.length ?? chart.filter?.options.length ?? 0;

  if (type === 'kpi') return { colSpan: 3, rowSpan: 2 };
  if (type === 'filter') return { colSpan: isDateLikeFilter(chart) || categoryCount > 8 ? 6 : 3, rowSpan: 2 };
  if (type === 'pie' || type === 'donut') return { colSpan: 5, rowSpan: 3 };
  if (type === 'line') return { colSpan: 6, rowSpan: 3 };
  if (type === 'hbar') return { colSpan: 3, rowSpan: Math.max(3, Math.ceil(categoryCount / 2)) };
  if (type === 'table') return { colSpan: 7, rowSpan: 2 };
  if (type === 'bar' && /средн|average|avg/.test(title)) return { colSpan: 3, rowSpan: 3 };
  if (type === 'bar' && hasLongCategoryLabels(chart)) {
    const rowSpan = Math.max(3, Math.ceil(categoryCount / 2));
    return { colSpan: 5, rowSpan, type: 'hbar' };
  }
  if (type === 'bar') return { colSpan: 7, rowSpan: 3 };
  return { colSpan: Math.min(chart.colSpan, 6), rowSpan: Math.min(chart.rowSpan, 3) };
};

export const getCompactWidgetRank = (chart: ChartItem) => {
  const type = normalizeChartType(chart.type);
  if (type === 'kpi') return 10;
  if (type === 'filter' && !isDateLikeFilter(chart)) return 20;
  if (type === 'filter') return 30;
  if (type === 'bar' && !/средн|average|avg/i.test(chart.title || '')) return 40;
  if (type === 'pie' || type === 'donut') return 50;
  if (type === 'bar') return 60;
  if (type === 'hbar') return 70;
  if (type === 'line') return 80;
  if (type === 'table') return 90;
  return 100;
};

export const hasUsablePosition = (chart: MockChart | ChartItem) => {
  const pos = chart.position;
  if (!pos) return false;
  return pos.width > 0.05 && pos.height > 0.05;
};

// Resolves overlapping widget positions in positioned (absolute) layout mode.
// Works in a grid of virtual "slots" at GAP=0.5% resolution and nudges widgets
// downward until they no longer overlap any previously-placed widget.
export const resolvePositionCollisions = <T extends ChartItem>(charts: T[]): T[] => {
  const GAP = 0.005; // 0.5% minimum gap between widgets
  const result: T[] = [];

  for (const chart of charts) {
    if (!chart.position) {
      result.push(chart);
      continue;
    }

    let { left, top, width, height } = chart.position;
    // Clamp to canvas bounds
    width = clamp(width, 0.05, 1 - left);
    height = clamp(height, 0.05, 1 - top);
    left = clamp(left, 0, 1 - width);
    top = clamp(top, 0, 1 - height);

    // Try to find a non-overlapping vertical position
    const MAX_ATTEMPTS = 200;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let overlaps = false;
      for (const placed of result) {
        if (!placed.position) continue;
        const p = placed.position;
        const hOverlap = left < p.left + p.width - GAP && left + width > p.left + GAP;
        const vOverlap = top < p.top + p.height - GAP && top + height > p.top + GAP;
        if (hOverlap && vOverlap) {
          overlaps = true;
          // Push current widget below the conflicting one
          top = p.top + p.height + GAP;
          break;
        }
      }
      if (!overlaps) break;
    }

    // If pushed off canvas, clamp back; excess overlap is unavoidable
    top = Math.min(top, 1 - height);

    result.push({ ...chart, position: { left, top, width, height } });
  }

  return result;
};

export const applyColorPreset = (chart: MockChart, colors: string[]): MockChart => {
  const nextChart = deepClone(chart);
  nextChart.color = colors[0];

  if (nextChart.series) {
    nextChart.series = nextChart.series.map((series, index) => ({
      ...series,
      color: colors[index % colors.length],
    }));
  }

  if (nextChart.slices) {
    nextChart.slices = nextChart.slices.map((slice, index) => ({
      ...slice,
      color: colors[index % colors.length],
    }));
  }

  return nextChart;
};

export const convertChartType = (chart: ChartItem, nextType: string): ChartItem => {
  const normalized = normalizeChartType(nextType);
  const next = deepClone(chart);
  next.type = normalized;
  next.paletteType = getPaletteTypeByActualType(normalized);

  if ((normalized === 'pie' || normalized === 'donut') && !next.slices && next.categories && next.series?.[0]?.values) {
    const values = next.series[0].values;
    const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
    next.slices = next.categories.map((label, index) => {
      const value = Number(values[index]) || 0;
      return {
        label,
        value,
        displayValue: total ? `${(value / total * 100).toFixed(1)}%` : '0%',
        color: next.series?.[index % next.series.length]?.color || EDITOR_COLOR_PRESETS[index % EDITOR_COLOR_PRESETS.length].colors[0],
      };
    });
  }

  if (!next.series && next.slices && ['bar', 'hbar', 'line', 'country_map'].includes(normalized)) {
    next.categories = next.slices.map(slice => slice.label);
    next.series = [{
      name: next.aggregation || 'value',
      values: next.slices.map(slice => Number(slice.value) || 0),
      color: next.slices[0]?.color || EDITOR_COLOR_PRESETS[0].colors[0],
    }];
  }

  if (!['pie', 'donut'].includes(normalized)) {
    delete next.slices;
  }
  return { ...next, ...normalizeChartLayout(next) };
};

export const limitChartItems = (chart: ChartItem, limit: number): ChartItem => {
  const next = deepClone(chart);
  if (next.categories) next.categories = next.categories.slice(0, limit);
  if (next.series) {
    next.series = next.series.map(series => ({
      ...series,
      values: series.values.slice(0, limit),
      valueLabels: series.valueLabels?.slice(0, limit),
    }));
  }
  if (next.slices) next.slices = next.slices.slice(0, limit);
  next.description = `${next.description || 'Виджет'} · топ-${limit}`;
  return next;
};

const getChartRows = (chart: ChartItem): Array<{ label: string; value: number }> => {
  if (chart.slices?.length) {
    return chart.slices.map(slice => ({ label: slice.label, value: Number(slice.value) || 0 }));
  }
  if (chart.categories?.length && chart.series?.[0]?.values) {
    return chart.categories.map((label, index) => ({ label, value: Number(chart.series?.[0]?.values[index]) || 0 }));
  }
  return [];
};

const formatAnswerNumber = (value: number) => {
  if (Number.isInteger(value)) return Math.round(value).toLocaleString('ru-RU');
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
};

export const answerChartQuestion = (chart: ChartItem, question: string) => {
  const rows = getChartRows(chart);
  const lower = question.toLowerCase();
  if (!rows.length && chart.type === 'kpi') {
    return `По KPI «${chart.title}» сейчас значение ${chart.value || 'не указано'}. ${chart.insights?.[0] ?? ''}`.trim();
  }
  if (!rows.length && chart.table) {
    return `В таблице «${chart.title}» ${chart.table.rows.length} строк и ${chart.table.columns.length} колонок. Для детального анализа откройте данные виджета.`;
  }
  if (!rows.length) {
    return `По виджету «${chart.title}» нет достаточно агрегированных точек для ответа.`;
  }

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const top = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]);
  const topShare = total > 0 ? top.value / total * 100 : 0;

  if (/почему|пик|peak|max|максим/i.test(lower)) {
    const second = [...rows].sort((a, b) => b.value - a.value)[1];
    const comparison = second ? ` Это на ${formatAnswerNumber(top.value - second.value)} больше, чем у следующей категории «${second.label}».` : '';
    return `Пик у «${top.label}»: ${formatAnswerNumber(top.value)} (${topShare.toFixed(1)}% от суммы).${comparison}`;
  }
  if (/строк|покажи|категор|данн/i.test(lower)) {
    return `Для «${top.label}» в агрегате ${formatAnswerNumber(top.value)}. В текущем дашборде доступны агрегированные строки виджета; исходные строки можно открыть через кнопку данных.`;
  }
  if (/прошл|месяц|сравн|динамик/i.test(lower)) {
    if (rows.length < 2) return 'Для сравнения нужен минимум два периода или две точки.';
    const prev = rows[rows.length - 2];
    const last = rows[rows.length - 1];
    const delta = last.value - prev.value;
    const pct = prev.value !== 0 ? delta / Math.abs(prev.value) * 100 : 0;
    return `Последняя точка «${last.label}»: ${formatAnswerNumber(last.value)}. Предыдущая «${prev.label}»: ${formatAnswerNumber(prev.value)}. Изменение: ${delta >= 0 ? '+' : ''}${formatAnswerNumber(delta)}${prev.value !== 0 ? ` (${pct.toFixed(1)}%)` : ''}.`;
  }
  if (/аномал|выброс|скач|паден/i.test(lower)) {
    const highlighted = chart.highlightedCategories?.length ? chart.highlightedCategories.join(', ') : top.label;
    return `Потенциальная аномалия: ${highlighted}. ${chart.insights?.find(item => /резк|необыч|выше|пик/i.test(item)) ?? 'Система пометила категорию из-за высокой доли или резкого изменения.'}`;
  }

  return `${chart.insights?.slice(0, 3).join(' ') || `Главная точка: «${top.label}» (${formatAnswerNumber(top.value)}).`} Quality score: ${chart.qualityScore ?? 'нет оценки'}.`;
};

export const formatEditableNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return Math.round(value).toLocaleString('ru-RU');
  }
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

export const parseNumberInput = (value: string) => {
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const updateSeriesLabels = (series: MockChartSeries[]) => series.map(item => ({
  ...item,
  valueLabels: item.values.map(formatEditableNumber),
}));

export const updateSliceLabels = (slices: MockChartSlice[]) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  return slices.map(slice => ({
    ...slice,
    displayValue: `${Math.round((slice.value / total) * 100)}%`,
  }));
};

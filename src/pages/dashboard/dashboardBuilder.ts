import type {
  DashboardWidgetType,
  MockChart,
  MockWidgetSource,
  MockWidgetTemplate,
  UploadedFile,
} from '../../types';
import { CHART_COLORS } from './dashboardShared';

export type BuilderFieldRole = 'numeric' | 'date' | 'category';

export interface BuilderSource extends MockWidgetSource {
  fileName: string;
  rowCount: number;
  previewHeaders: string[];
  previewRows: string[][];
  fieldRoles: Record<string, BuilderFieldRole>;
}

export interface BuilderTemplateRanking {
  template: MockWidgetTemplate;
  score: number;
  recommended: boolean;
}

export type BuilderSelectionKey = 'primary' | 'secondary';

const NUMERIC_FIELD_HINTS = ['amount', 'revenue', 'plan', 'fact', 'discount', 'margin', 'score', 'days', 'count', 'qty', 'sum', 'pct', 'id'];
const DATE_FIELD_HINTS = ['date', 'month', 'year', 'period', 'week', 'day', 'дата', 'месяц'];
const BUILDER_SOURCE_COLORS = ['#18b6b2', '#2f89ff', '#f5c84c', '#7a5bd1', '#4cc38a', '#ef6a5b'];

export const BUILDER_TEMPLATE_LIBRARY: MockWidgetTemplate[] = [
  {
    id: 'builder_kpi_total',
    sourceId: 'live',
    paletteType: 'kpi',
    actualType: 'kpi',
    title: 'Сводный KPI',
    summary: 'Агрегирует выбранную метрику по реальным строкам источника.',
    chart: { title: 'Сводный KPI', type: 'kpi', description: '', metrics: [] },
  },
  {
    id: 'builder_chart_bar',
    sourceId: 'live',
    paletteType: 'chart',
    actualType: 'bar',
    title: 'Гистограмма',
    summary: 'Сравнивает категории по сумме или количеству на живых данных.',
    chart: { title: 'Гистограмма', type: 'bar', description: '', metrics: [] },
  },
  {
    id: 'builder_chart_hbar',
    sourceId: 'live',
    paletteType: 'chart',
    actualType: 'hbar',
    title: 'Горизонтальная гистограмма',
    summary: 'Удобна для длинных категорий и ранжирования топов.',
    chart: { title: 'Горизонтальная гистограмма', type: 'hbar', description: '', metrics: [] },
  },
  {
    id: 'builder_chart_line',
    sourceId: 'live',
    paletteType: 'chart',
    actualType: 'line',
    title: 'Линия по времени',
    summary: 'Показывает динамику по дате или периоду из текущего источника.',
    chart: { title: 'Линия по времени', type: 'line', description: '', metrics: [] },
  },
  {
    id: 'builder_chart_pie',
    sourceId: 'live',
    paletteType: 'chart',
    actualType: 'pie',
    title: 'Круговая диаграмма',
    summary: 'Показывает структуру категорий по текущему источнику.',
    chart: { title: 'Круговая диаграмма', type: 'pie', description: '', metrics: [] },
  },
  {
    id: 'builder_chart_donut',
    sourceId: 'live',
    paletteType: 'chart',
    actualType: 'donut',
    title: 'Кольцевая диаграмма',
    summary: 'Структурный срез по категориям на живых строках.',
    chart: { title: 'Кольцевая диаграмма', type: 'donut', description: '', metrics: [] },
  },
  {
    id: 'builder_table_detail',
    sourceId: 'live',
    paletteType: 'table',
    actualType: 'table',
    title: 'Детальная таблица',
    summary: 'Показывает реальные строки и выбранные колонки источника.',
    chart: { title: 'Детальная таблица', type: 'table', description: '', metrics: [], table: { columns: [], rows: [] } },
  },
  {
    id: 'builder_filter_values',
    sourceId: 'live',
    paletteType: 'filter',
    actualType: 'filter',
    title: 'Фильтр по значениям',
    summary: 'Собирает реальные значения поля и частоты для фильтра.',
    chart: { title: 'Фильтр по значениям', type: 'filter', description: '', metrics: [] },
  },
];

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeBuilderChartType = (type: string) => {
  if (type === 'bar-horizontal' || type === 'bar_horizontal') return 'hbar';
  if (type === 'big_number') return 'kpi';
  if (type === 'mosaic_map') return 'country_map';
  return type;
};

const formatBuilderNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return Math.round(value).toLocaleString('ru-RU');
  }
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

const humanizeBuilderLabel = (value: string) => value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeBuilderCell = (value: string | undefined) => (value ?? '').trim();

const sanitizeBuilderSourceId = (value: string) => value
  .replace(/\.[^.]+$/, '')
  .replace(/\s+/g, '_')
  .replace(/[^\wа-яА-ЯёЁ-]+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '')
  .toLowerCase();

const parseBuilderNumber = (value: string) => {
  const normalized = value
    .replace(/\s+/g, '')
    .replace(/₽|%/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');

  if (!normalized || normalized === '-' || normalized === '.' || normalized === ',') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const classifyBuilderField = (field: string, sampleValues: string[] = []): BuilderFieldRole => {
  const normalized = field.toLowerCase();
  if (DATE_FIELD_HINTS.some(token => normalized.includes(token))) return 'date';
  if (NUMERIC_FIELD_HINTS.some(token => normalized.includes(token))) return 'numeric';

  const nonEmptyValues = sampleValues.filter(Boolean);
  if (nonEmptyValues.length > 0) {
    const numericRatio = nonEmptyValues.filter(value => parseBuilderNumber(value) !== null).length / nonEmptyValues.length;
    if (numericRatio >= 0.7) return 'numeric';

    const dateRatio = nonEmptyValues.filter(value => !Number.isNaN(Date.parse(value))).length / nonEmptyValues.length;
    if (dateRatio >= 0.7) return 'date';
  }

  return 'category';
};

export const buildBuilderSources = (files: UploadedFile[]): BuilderSource[] => (
  files.flatMap((file, fileIndex) => file.sheets.flatMap((sheet, sheetIndex) => {
    const [rawHeaders = [], ...rawRows] = sheet.preview ?? [[]];
    const headers = rawHeaders
      .map(header => header?.trim())
      .filter((header): header is string => Boolean(header));

    if (headers.length === 0) {
      return [];
    }

    const previewRows = rawRows.filter(row => row.some(cell => normalizeBuilderCell(cell) !== ''));
    const fieldRoles = Object.fromEntries(headers.map((header, index) => [
      header,
      classifyBuilderField(header, previewRows.map(row => normalizeBuilderCell(row[index]))),
    ])) as Record<string, BuilderFieldRole>;

    const widgetTypes = new Set<DashboardWidgetType>(['table']);
    if (headers.some(header => fieldRoles[header] === 'numeric')) widgetTypes.add('kpi');
    if (headers.some(header => fieldRoles[header] === 'category' || fieldRoles[header] === 'date')) {
      widgetTypes.add('chart');
      widgetTypes.add('filter');
    }

    return [{
      id: `${sanitizeBuilderSourceId(file.name)}__${sanitizeBuilderSourceId(sheet.name || `sheet_${sheetIndex + 1}`)}`,
      title: file.sheets.length > 1 ? `${file.name} · ${sheet.name}` : file.name,
      description: `Живой источник: ${previewRows.length.toLocaleString('ru-RU')} строк в preview, ${sheet.rows.toLocaleString('ru-RU')} строк всего.`,
      table: sheet.name || file.name,
      fields: headers,
      widgetTypes: Array.from(widgetTypes),
      accentColor: BUILDER_SOURCE_COLORS[(fileIndex + sheetIndex) % BUILDER_SOURCE_COLORS.length],
      fileName: file.name,
      rowCount: sheet.rows,
      previewHeaders: headers,
      previewRows,
      fieldRoles,
    }];
  }))
);

export const getBuilderFieldOptions = (source: BuilderSource) => {
  const numeric = source.fields.filter(field => source.fieldRoles[field] === 'numeric');
  const date = source.fields.filter(field => source.fieldRoles[field] === 'date');
  const category = source.fields.filter(field => source.fieldRoles[field] === 'category');
  return {
    numeric,
    date,
    category,
    any: source.fields,
  };
};

const buildSourceLabel = (source: BuilderSource, fields: string[]) => `${source.fileName} / ${source.table}${fields.length > 0 ? ` · ${fields.join(' · ')}` : ''}`;

export const pickDefaultBuilderFields = (source: BuilderSource, template: MockWidgetTemplate) => {
  const options = getBuilderFieldOptions(source);
  const actualType = normalizeBuilderChartType(template.actualType);
  const preferredPrimary = actualType === 'line'
    ? options.date[0] ?? options.category[0] ?? options.any[0] ?? ''
    : actualType === 'filter'
      ? options.category[0] ?? options.date[0] ?? options.any[0] ?? ''
      : actualType === 'table'
        ? options.any[0] ?? ''
        : options.category[0] ?? options.any[0] ?? '';
  const preferredSecondary = actualType === 'kpi'
    ? options.numeric[0] ?? options.any[0] ?? ''
    : actualType === 'table'
      ? options.numeric[0] ?? options.category[1] ?? options.any[1] ?? ''
      : options.numeric[0] ?? options.any[1] ?? preferredPrimary;
  return {
    primary: preferredPrimary,
    secondary: preferredSecondary,
    tableColumns: source.fields.slice(0, Math.min(6, source.fields.length)),
  };
};

const buildTemplateRecommendationScore = (source: BuilderSource, template: MockWidgetTemplate) => {
  const actualType = normalizeBuilderChartType(template.actualType);
  const { numeric, date, category } = getBuilderFieldOptions(source);

  if (actualType === 'kpi') return numeric.length > 0 ? 5 : 2;
  if (actualType === 'line') return date.length > 0 && numeric.length > 0 ? 5 : 1;
  if (actualType === 'bar' || actualType === 'hbar') return category.length > 0 ? 4 : 1;
  if (actualType === 'pie' || actualType === 'donut') return category.length > 0 ? 4 : 1;
  if (actualType === 'table') return source.fields.length >= 2 ? 4 : 2;
  if (actualType === 'filter') return category.length > 0 || date.length > 0 ? 4 : 1;
  return 1;
};

export const rankTemplatesForSource = (source: BuilderSource, templates: MockWidgetTemplate[]): BuilderTemplateRanking[] => {
  const ranked = templates
    .map(template => ({ template, score: buildTemplateRecommendationScore(source, template), recommended: false }))
    .sort((left, right) => right.score - left.score || left.template.title.localeCompare(right.template.title));

  const bestScore = ranked[0]?.score ?? 0;
  return ranked.map(item => ({
    ...item,
    recommended: item.score === bestScore && item.score > 0,
  }));
};

const getBuilderFieldIndex = (source: BuilderSource, field: string) => source.previewHeaders.indexOf(field);

const getBuilderNumericValues = (source: BuilderSource, field: string) => {
  const index = getBuilderFieldIndex(source, field);
  if (index < 0) return [] as number[];
  return source.previewRows
    .map(row => parseBuilderNumber(normalizeBuilderCell(row[index])))
    .filter((value): value is number => value !== null);
};

const buildBuilderSparkline = (source: BuilderSource, field: string) => getBuilderNumericValues(source, field).slice(-8);

const buildBuilderTableRows = (source: BuilderSource, columns: string[], rowCount = 5) => {
  const indices = columns.map(column => getBuilderFieldIndex(source, column));
  return source.previewRows.slice(0, rowCount).map(row => (
    indices.map(index => (index >= 0 ? normalizeBuilderCell(row[index]) || '—' : '—'))
  ));
};

const buildBuilderFilterOptions = (source: BuilderSource, field: string) => {
  const index = getBuilderFieldIndex(source, field);
  if (index < 0) return [] as Array<{ label: string; value: string; count: number }>;

  const counts = new Map<string, number>();
  source.previewRows.forEach(row => {
    const value = normalizeBuilderCell(row[index]) || 'Не указано';
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, value: label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'ru'))
    .slice(0, 12);
};

const buildBuilderAggregate = (
  source: BuilderSource,
  categoryField: string,
  metricField: string,
  limit: number,
  chronological = false,
) => {
  const categoryIndex = getBuilderFieldIndex(source, categoryField);
  if (categoryIndex < 0) return [] as Array<{ label: string; value: number }>;

  const metricIndex = getBuilderFieldIndex(source, metricField);
  const grouped = new Map<string, { label: string; value: number; sortValue: number }>();

  source.previewRows.forEach(row => {
    const label = normalizeBuilderCell(row[categoryIndex]) || 'Не указано';
    const metricValue = metricIndex >= 0 ? parseBuilderNumber(normalizeBuilderCell(row[metricIndex])) : null;
    const increment = metricValue ?? 1;
    const current = grouped.get(label);
    const parsedDate = Date.parse(label);
    const sortValue = chronological && !Number.isNaN(parsedDate) ? parsedDate : 0;

    if (current) {
      current.value += increment;
      if (chronological && current.sortValue === 0 && sortValue > 0) current.sortValue = sortValue;
      return;
    }

    grouped.set(label, { label, value: increment, sortValue });
  });

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (chronological) {
        if (left.sortValue > 0 && right.sortValue > 0) return left.sortValue - right.sortValue;
        if (left.sortValue > 0) return -1;
        if (right.sortValue > 0) return 1;
      }
      return right.value - left.value || left.label.localeCompare(right.label, 'ru');
    })
    .slice(0, limit)
    .map(({ label, value }) => ({ label, value }));
};

export const customizeWidgetTemplate = (
  template: MockWidgetTemplate,
  source: BuilderSource,
  primaryField: string,
  secondaryField: string,
  tableColumns: string[],
): MockChart => {
  const chart = deepClone(template.chart);
  const actualType = normalizeBuilderChartType(template.actualType);
  const primary = primaryField || source.fields[0] || '';
  const secondary = secondaryField || source.fields[1] || source.fields[0] || '';

  chart.sourceId = source.id;
  chart.paletteType = template.paletteType;
  chart.sourceLabel = buildSourceLabel(source, [primary, secondary].filter(Boolean));

  if (actualType === 'kpi') {
    const metricField = secondary || primary;
    const values = getBuilderNumericValues(source, metricField);
    const total = values.reduce((sum, value) => sum + value, 0);
    chart.metrics = [metricField].filter(Boolean);
    chart.subtitle = `${source.table}.${metricField}`;
    chart.title = `KPI: ${humanizeBuilderLabel(metricField)}`;
    chart.description = `Итоговая метрика по источнику ${source.title} на основе реальных строк preview.`;
    chart.sparkline = buildBuilderSparkline(source, metricField);
    chart.value = values.length > 0 ? formatBuilderNumber(total) : source.rowCount.toLocaleString('ru-RU');
    chart.trend = values.length > 0
      ? `${values.length.toLocaleString('ru-RU')} значений в preview`
      : `${source.rowCount.toLocaleString('ru-RU')} строк в источнике`;
    chart.color = source.accentColor;
    return chart;
  }

  if (actualType === 'bar' || actualType === 'hbar' || actualType === 'line') {
    const metricField = secondary || primary;
    const aggregates = buildBuilderAggregate(source, primary || metricField, metricField, actualType === 'line' ? 8 : 6, actualType === 'line');
    const values = aggregates.map(item => item.value);
    chart.metrics = [primary, secondary].filter(Boolean);
    chart.title = `${humanizeBuilderLabel(metricField)} по ${humanizeBuilderLabel(primary)}`;
    chart.description = `Визуализация по реальным строкам источника ${source.title} для полей ${primary} и ${metricField}.`;
    chart.xAxisLabel = humanizeBuilderLabel(primary);
    chart.yAxisLabel = humanizeBuilderLabel(metricField);
    chart.categories = aggregates.map(item => item.label);
    chart.series = [{
      name: humanizeBuilderLabel(metricField),
      values,
      color: source.accentColor,
      valueLabels: values.map(formatBuilderNumber),
    }];
    chart.color = source.accentColor;
    return chart;
  }

  if (actualType === 'pie' || actualType === 'donut') {
    const aggregates = buildBuilderAggregate(source, primary, secondary || primary, 6);
    const values = aggregates.map(item => item.value);
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    chart.metrics = [primary, secondary].filter(Boolean);
    chart.title = `Структура по ${humanizeBuilderLabel(primary)}`;
    chart.description = `Структура источника ${source.title} по реальным значениям поля ${primary}.`;
    chart.slices = aggregates.map((item, index) => ({
      label: item.label,
      value: values[index],
      displayValue: `${Math.round((values[index] / total) * 100)}%`,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
    return chart;
  }

  if (actualType === 'table') {
    const columns = tableColumns.length > 0 ? tableColumns : source.fields.slice(0, Math.min(4, source.fields.length));
    chart.metrics = columns;
    chart.title = `${source.title}: детальный просмотр`;
    chart.description = `Таблица по выбранным колонкам источника ${source.title}.`;
    chart.table = {
      columns,
      rows: buildBuilderTableRows(source, columns, 5),
    };
    return chart;
  }

  if (actualType === 'filter') {
    const filterOptions = buildBuilderFilterOptions(source, primary);
    chart.metrics = [primary];
    chart.title = `Фильтр по ${humanizeBuilderLabel(primary)}`;
    chart.description = `Фильтр по источнику ${source.title} и полю ${primary}.`;
    chart.filter = {
      field: primary,
      source: source.table,
      multi: true,
      options: filterOptions,
      selectedValues: filterOptions.slice(0, 2).map(option => option.value),
    };
    return chart;
  }

  return chart;
};

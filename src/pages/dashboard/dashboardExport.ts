import type { PresentationBrief } from '../../api';
import type { UploadedFile } from '../../types';
import { DASHBOARD_MAX_COLUMNS, DASHBOARD_ROW_HEIGHT, getWidgetAccent, type ChartItem } from './dashboardShared';

const normalizeChartType = (type: string) => {
  if (type === 'bar-horizontal' || type === 'bar_horizontal') return 'hbar';
  if (type === 'big_number') return 'kpi';
  if (type === 'mosaic_map') return 'country_map';
  return type;
};

const toExportNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value ?? '').trim().replace(/\s+/g, '').replace(/[^0-9.,''\-]/g, '').replace(',', '.');
  if (!str || str === '—' || str === '-') return null;
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : null;
};
const toExportUnit = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[-+]?\d[\d\s\u00a0]*(?:[.,]\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
const toExportChartType = (type: string) => {
  const normalized = normalizeChartType(type);
  if (normalized === 'kpi') return 'big_number';
  if (normalized === 'hbar') return 'bar_horizontal';
  if (normalized === 'donut') return 'donut';
  return normalized;
};
const RAW_DASHBOARD_TABLE = 'FactDashboardRaw';

const toFieldName = (value: string, fallback: string) => {
  const normalized = String(value || '')
    .trim()
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  const safeFallback = String(fallback || '')
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return normalized || safeFallback || 'field';
};

export const buildExportPayload = (charts: ChartItem[], dashboardTitle: string) => {
  const layout: Record<string, unknown>[] = [];
  const exportCharts: Record<string, unknown>[] = [];
  const kpiRows: Record<string, unknown>[] = [];
  const chartMeta: Record<string, unknown> = {};
  const rawColumns = new Set<string>(['widget_id', 'category']);
  // Key: `${widgetId}__${category}` — separate rows per widget so categories don't bleed across widgets
  const rawRowsByKey = new Map<string, Record<string, unknown>>();

  const ensureRawRow = (widgetId: string, category: string) => {
    const cat = category || 'Итого';
    const key = `${widgetId}__${cat}`;
    const existing = rawRowsByKey.get(key);
    if (existing) return existing;
    const rowData: Record<string, unknown> = { widget_id: widgetId, category: cat };
    rawRowsByKey.set(key, rowData);
    return rowData;
  };

  const setRawValue = (widgetId: string, category: string, field: string, value: unknown) => {
    rawColumns.add(field);
    ensureRawRow(widgetId, category)[field] = value;
  };

  let row = 0;
  let col = 0;
  charts.forEach(chart => {
    const width = chart.colSpan;
    const height = chart.rowSpan * DASHBOARD_ROW_HEIGHT;
    if (col + width > DASHBOARD_MAX_COLUMNS) {
      col = 0;
      row += 1;
    }

    const dataset = RAW_DASHBOARD_TABLE;
    const chartType = toExportChartType(chart.type);
    const sliceName = chart.title || `Виджет ${chart.id}`;
    const baseField = toFieldName(sliceName, `widget_${chart.id}`);
    let xField = 'category';
    let yField = `${baseField}_value`;
    const metricFields: string[] = [];
    const exportSeries: Array<{ name: string; data: number[]; color?: string }> = [];

    layout.push({
      id: String(chart.id),
      slice_name: sliceName,
      dataset,
      row,
      col,
      width,
      height,
    });

    if (chartType === 'big_number') {
      rawColumns.add(yField);
      metricFields.push(yField);
      const rawValue = toExportNumber(chart.value);
      const unit = toExportUnit(chart.value);
      ensureRawRow(String(chart.id), 'Итого')[yField] = rawValue;
      exportCharts.push({
        id: String(chart.id),
        slice_name: sliceName,
        name: sliceName,
        title: sliceName,
        dataset,
        table_name: dataset,
        chart_type: chartType,
        viz_type: chartType,
        x_field: xField,
        y_field: yField,
        filter_field: 'widget_id',
        filter_value: String(chart.id),
        metric_fields: metricFields,
        unit,
        position: chart.position ?? undefined,
      });
      kpiRows.push({
        title: sliceName,
        metric_name: sliceName,
        value: rawValue,
        unit,
        dataset,
        table_name: dataset,
        x_field: xField,
        y_field: yField,
        metric_fields: metricFields,
        position: chart.position ?? undefined,
      });
      chartMeta[sliceName] = {
        chart_type: chartType,
        x_field: xField,
        y_field: yField,
        metric_fields: metricFields,
        unit,
        color: getWidgetAccent(chart),
        position: chart.position ?? undefined,
      };
    } else {
      const widgetId = String(chart.id);
      if ((chartType === 'pie' || chartType === 'donut') && chart.slices?.length) {
        chart.slices.forEach(slice => setRawValue(widgetId, slice.label, yField, slice.value));
        metricFields.push(yField);
        exportSeries.push({
          name: sliceName,
          data: chart.slices.map(slice => slice.value),
          color: getWidgetAccent(chart),
        });
      } else if (chart.categories?.length && chart.series?.length) {
        chart.series.forEach((series, seriesIndex) => {
          const seriesField = chart.series!.length === 1
            ? yField
            : `${baseField}_${toFieldName(series.name, `series_${seriesIndex + 1}`)}`;
          rawColumns.add(seriesField);
          metricFields.push(seriesField);
          series.values.forEach((value, categoryIndex) => {
            setRawValue(widgetId, chart.categories![categoryIndex] ?? `Строка ${categoryIndex + 1}`, seriesField, value);
          });
          if (seriesIndex === 0) yField = seriesField;
          exportSeries.push({ name: series.name, data: series.values, color: series.color });
        });
      } else if (chart.table) {
        const tableColumnFields = chart.table.columns.map((column, columnIndex) => (
          toFieldName(column, `table_${chart.id}_${columnIndex + 1}`)
        ));
        tableColumnFields.forEach(field => rawColumns.add(field));
        chart.table.rows.forEach((tableRow, rowIndex) => {
          const rawRow = ensureRawRow(widgetId, String(tableRow[0] ?? `Строка ${rowIndex + 1}`));
          tableColumnFields.forEach((field, columnIndex) => {
            rawRow[field] = tableRow[columnIndex] ?? '';
          });
        });
        xField = 'category';
        yField = '';
      } else {
        setRawValue(widgetId, sliceName, yField, toExportNumber(chart.value));
        metricFields.push(yField);
      }

      exportCharts.push({
        id: widgetId,
        slice_name: sliceName,
        name: sliceName,
        title: sliceName,
        dataset,
        table_name: dataset,
        chart_type: chartType,
        viz_type: chartType,
        categories: chart.categories,
        series: exportSeries,
        x_field: xField,
        y_field: yField,
        filter_field: 'widget_id',
        filter_value: widgetId,
        metric_fields: metricFields,
        position: chart.position ?? undefined,
        series_colors: chart.seriesColors ?? undefined,
      });
      chartMeta[sliceName] = {
        chart_type: chartType,
        x_field: xField,
        y_field: yField,
        metric_fields: metricFields,
        color: getWidgetAccent(chart),
        position: chart.position ?? undefined,
        series_colors: chart.seriesColors ?? undefined,
      };
    }

    col += width;
  });

  const columns = Array.from(rawColumns);
  const rawRows = Array.from(rawRowsByKey.values()).map(rawRow => (
    Object.fromEntries(columns.map(column => [column, rawRow[column] ?? null]))
  ));

  return {
    dashboard_title: dashboardTitle,
    subject_area_name: dashboardTitle,
    title: dashboardTitle,
    slug: 'data_agent_dashboard',
    charts: exportCharts,
    layout,
    tables: [{ table_name: RAW_DASHBOARD_TABLE, columns, rows: rawRows }],
    kpi_rows: kpiRows,
    chart_meta: chartMeta,
    inline_data: true,
    navigator_single_raw_source: true,
  };
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

export const downloadText = (content: string, filename: string, mimeType: string) => {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
};

export const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const cloneWithInlineStyles = (node: HTMLElement): HTMLElement => {
  const clone = node.cloneNode(true) as HTMLElement;
  const sourceElements = [node, ...Array.from(node.querySelectorAll('*'))] as HTMLElement[];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll('*'))] as HTMLElement[];

  sourceElements.forEach((source, index) => {
    const target = cloneElements[index];
    if (!target) return;
    const styles = window.getComputedStyle(source);
    target.setAttribute(
      'style',
      Array.from(styles).map(property => `${property}:${styles.getPropertyValue(property)};`).join(''),
    );
    target.removeAttribute('draggable');
    if (target.tagName.toLowerCase() === 'button') {
      target.remove();
    }
  });
  return clone;
};

export const buildDashboardSvg = (node: HTMLElement, title: string) => {
  const rect = node.getBoundingClientRect();
  const padding = 16;
  const contentWidth = Math.max(900, Math.ceil(Math.max(rect.width, node.scrollWidth)));
  const contentHeight = Math.max(520, Math.ceil(Math.max(rect.height, node.scrollHeight)));
  const width = contentWidth + padding * 2;
  const height = contentHeight + padding * 2;
  const html = cloneWithInlineStyles(node).outerHTML;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
  <title>${escapeHtml(title)}</title>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;min-height:${height}px;background:#111827;color:#f8fafc;font-family:Inter,Arial,sans-serif;padding:${padding}px;box-sizing:border-box;">
      ${html}
    </div>
  </foreignObject>
</svg>`;
};

const getBusinessFieldLabel = (field: string) => field
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildFileOverviewHtml = (files: UploadedFile[], brief?: PresentationBrief | null) => {
  const sheets = files.flatMap(file => file.sheets.map(sheet => ({ file, sheet })));
  const totalRows = sheets.reduce((sum, item) => sum + (Number(item.sheet.rows) || 0), 0);
  const headers = Array.from(new Set(sheets.flatMap(item => item.sheet.preview?.[0] ?? [])))
    .map(getBusinessFieldLabel)
    .filter(Boolean)
    .filter(header => !/^id$/i.test(header))
    .slice(0, 8);

  if (sheets.length === 0) {
    const summary = brief?.dataset_summary?.trim();
    return summary ? `<p>${escapeHtml(summary)}</p>` : '';
  }

  const fileNames = Array.from(new Set(files.map(file => file.name))).slice(0, 2);
  const fileLabel = fileNames.length === 1
    ? `Файл «${fileNames[0]}»`
    : `Набор файлов ${fileNames.map(name => `«${name}»`).join(', ')}${files.length > 2 ? ` и ещё ${files.length - 2}` : ''}`;
  const rowsLabel = totalRows > 0 ? `${totalRows.toLocaleString('ru-RU')} записей` : 'табличные записи';
  const columnsLabel = headers.length
    ? `В данных есть информация о полях: ${headers.map(header => `«${header}»`).join(', ')}.`
    : '';
  const sheetLabel = sheets.length > 1
    ? `Структура включает ${sheets.length.toLocaleString('ru-RU')} лист(а).`
    : '';

  return `<p>${escapeHtml(`${fileLabel} представляет собой ${rowsLabel}. ${columnsLabel} ${sheetLabel}`.replace(/\s+/g, ' ').trim())}</p>`;
};

export const buildPresentationHtml = (charts: ChartItem[], dashboardSvg: string, title: string, brief?: PresentationBrief | null, files: UploadedFile[] = []) => {
  const uniqueItems = (items: string[]) => Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));
  const cleanInsightItems = (items: string[]) => uniqueItems(items)
    .filter(item => !/^значение:/i.test(item))
    .filter(item => !/^автофильтр/i.test(item))
    .filter(item => !/^\s*quality score/i.test(item));
  const anomalyItems = charts
    .filter(chart => (chart.highlightedCategories?.length ?? 0) > 0)
    .map(chart => `${chart.title}: ${chart.highlightedCategories!.join(', ')} — ${(chart.insights ?? []).find(item => /резк|необыч|выше|пик|дол/i.test(item)) ?? 'требует проверки'}`);
  const riskItems = uniqueItems([
    ...(brief?.risks ?? []),
    ...charts.flatMap(chart => (chart.qualityWarnings ?? []).map(warning => `${chart.title}: ${warning}`)),
  ]).slice(0, 3);
  const executiveItems = cleanInsightItems(brief?.executive_summary?.length ? brief.executive_summary : charts.flatMap(chart => chart.insights ?? [])).slice(0, 3);
  const findingItems = cleanInsightItems(brief?.key_findings?.length ? brief.key_findings : charts.flatMap(chart => chart.insights ?? [])).slice(0, 3);
  const actions = uniqueItems(brief?.recommended_actions?.length ? brief.recommended_actions : [
    anomalyItems.length ? 'Проверить аномальные сегменты и подтвердить, это бизнес-событие или ошибка данных.' : '',
    riskItems.length ? 'Закрыть проблемы полноты данных перед регулярным использованием отчёта.' : '',
    'Зафиксировать владельцев ключевых метрик и периодичность обновления дашборда.',
  ]).slice(0, 3);
  const fileOverview = buildFileOverviewHtml(files, brief);
  const totalSlides = 3;
  const rowsFromChart = (chart: ChartItem, limit = 8) => {
    const rows = chart.slices?.length
      ? chart.slices.map(slice => ({ label: slice.label, value: Number(slice.value) || 0, display: slice.displayValue }))
      : chart.categories?.length && chart.series?.[0]?.values
        ? chart.categories.map((category, index) => ({
          label: category,
          value: Number(chart.series?.[0]?.values[index]) || 0,
          display: chart.series?.[0]?.valueLabels?.[index],
        }))
        : [];
    return rows.sort((a, b) => b.value - a.value).slice(0, limit);
  };
  const formatValue = (value: number) => Number.isFinite(value)
    ? value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
    : '0';
  const slideNo = (num: number) => `<div class="slide-no">${num} / ${totalSlides}</div>`;
  const icon = (symbol: string) => `<div class="icon">${symbol}</div>`;
  const kpiCharts = charts.filter(chart => chart.type === 'kpi').slice(0, 6);
  const chartCandidates = charts.filter(chart => !['kpi', 'filter', 'table'].includes(chart.type));
  const primaryChart = chartCandidates.find(chart => chart.type === 'bar') ?? chartCandidates[0];
  const secondaryChart = chartCandidates.find(chart => ['pie', 'donut'].includes(chart.type)) ?? chartCandidates[1] ?? primaryChart;
  const buildBars = (chart: ChartItem | undefined, limit = 5) => {
    if (!chart) return '<p style="color:#64748b">Недостаточно данных.</p>';
    const rows = rowsFromChart(chart, limit);
    const max = Math.max(...rows.map(row => row.value), 1);
    return `<div class="bar-list">${rows.map((row, index) => `
      <div class="bar-row">
        <div class="bar-head"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.display || formatValue(row.value))}</span></div>
        <div class="track"><i style="width:${Math.max(6, row.value / max * 100)}%;${index === 0 ? '' : 'opacity:.82'}"></i></div>
      </div>
    `).join('')}</div>`;
  };
  const buildMetricCards = () => {
    const metrics = kpiCharts.length ? kpiCharts : charts.slice(0, 6);
    return `<div class="metric-grid">${metrics.map(chart => `
      <div class="metric-card">
        <span>${escapeHtml(chart.title)}</span>
        <strong>${escapeHtml(String(chart.value ?? chart.series?.[0]?.values?.[0] ?? '—'))}</strong>
        <small>${escapeHtml(chart.insights?.[0] ?? chart.description ?? '')}</small>
      </div>
    `).join('')}</div>`;
  };
  const slides = [
    /* Слайд 1: Титул + KPI + описание данных */
    `<section class="slide slide-1">
      <div class="s1-left">
        <div class="kicker">Analytics dashboard</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="s1-desc">${escapeHtml((brief?.dataset_summary || 'Комплексный анализ данных: ключевые показатели, структура и динамика.').replace(/\s+/g, ' '))}</p>
        ${fileOverview ? `<div class="s1-file">${fileOverview}</div>` : ''}
        ${riskItems.length ? `<div class="s1-risks"><strong>Риски:</strong> ${riskItems.map(r => escapeHtml(r)).join(' · ')}</div>` : ''}
      </div>
      <div class="s1-right">
        <div class="s1-kpi-title">Ключевые метрики</div>
        ${buildMetricCards()}
      </div>
      ${slideNo(1)}
    </section>`,

    /* Слайд 2: Два графика + инсайты */
    `<section class="slide slide-2">
      <div class="s2-header">
        <h1>Аналитика</h1>
        <p>${escapeHtml(executiveItems[0] ?? 'Ключевые распределения и сравнение по категориям')}</p>
      </div>
      <div class="s2-body">
        <div class="s2-chart panel">
          <div class="chart-title">${escapeHtml(primaryChart?.title ?? 'Основной показатель')}</div>
          ${buildBars(primaryChart, 6)}
        </div>
        <div class="s2-chart panel">
          <div class="chart-title">${escapeHtml(secondaryChart?.title ?? 'Структура')}</div>
          ${buildBars(secondaryChart, 6)}
        </div>
        <div class="s2-insights">
          ${[...executiveItems, ...findingItems].slice(0, 4).map((item, i) => `
            <div class="insight-row">${icon(['✓','◎','↗','!'][i])}<p>${escapeHtml(item)}</p></div>
          `).join('')}
        </div>
      </div>
      ${slideNo(2)}
    </section>`,

    /* Слайд 3: Снимок дашборда + следующие шаги */
    `<section class="slide slide-3">
      <div class="s3-left">
        <div class="s3-header-text">
          <h1>Снимок дашборда</h1>
          <p>Полный набор виджетов витрины</p>
        </div>
        <div class="snapshot">${dashboardSvg}</div>
      </div>
      <div class="s3-right">
        <div class="s3-section">
          <div class="kicker">Выводы</div>
          <ul>${findingItems.length ? findingItems.map(item => `<li>${escapeHtml(item)}</li>`).join('') : '<li>Данные подготовлены для анализа.</li>'}</ul>
        </div>
        <div class="s3-section">
          <div class="kicker">Следующие шаги</div>
          <div class="action-list">${actions.map((action, i) => `
            <div class="action-row"><span class="step-num">0${i + 1}</span><p>${escapeHtml(action)}</p></div>
          `).join('')}</div>
        </div>
        ${anomalyItems.length ? `<div class="s3-section"><div class="kicker">Аномалии</div><ul>${anomalyItems.slice(0, 2).map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
      </div>
      ${slideNo(3)}
    </section>`,
  ];
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: landscape; margin: 0; }
    :root { --blue:#0f52ba; --blue2:#4169e1; --text:#1e293b; --muted:#64748b; --bg:#f8fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, Arial, sans-serif; }
    h1 { margin:0; font-size:38px; line-height:1.08; font-weight:900; color:var(--text); }
    h2 { margin:0 0 10px; font-size:22px; font-weight:800; color:var(--text); }
    p { margin:0; font-size:16px; line-height:1.45; color:var(--muted); }
    ul { margin:0; padding-left:18px; font-size:15px; line-height:1.5; color:var(--muted); }
    li { margin-bottom:6px; }
    .kicker { color:#3f66f5; text-transform:uppercase; font-size:13px; font-weight:900; letter-spacing:.12em; margin-bottom:10px; }
    .icon { width:40px; height:40px; border-radius:10px; background:#e8eefb; color:var(--blue); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:900; flex:0 0 auto; }
    .panel { background:#fff; border:2px solid #e6edf6; border-radius:12px; padding:22px; overflow:hidden; }
    .bar-list { display:flex; flex-direction:column; gap:14px; }
    .bar-row { display:grid; gap:6px; }
    .bar-head { display:flex; justify-content:space-between; gap:12px; align-items:baseline; font-size:15px; }
    .bar-head strong { color:var(--text); }
    .bar-head span { color:var(--blue); font-weight:900; white-space:nowrap; }
    .track { height:20px; border-radius:5px; background:#edf2f8; overflow:hidden; }
    .track i { display:block; height:100%; background:var(--blue2); border-radius:5px; }
    .chart-title { font-size:14px; font-weight:800; color:var(--text); margin-bottom:14px; }
    .slide { width:100vw; height:100vh; padding:40px 60px 36px; position:relative; overflow:hidden; page-break-after:always;
      background: linear-gradient(90deg,rgba(15,82,186,.04) 1px,transparent 1px),linear-gradient(180deg,rgba(15,82,186,.04) 1px,transparent 1px),#f8fafc;
      background-size:48px 48px; border-top:6px solid var(--blue); }
    .slide::after { content:""; position:absolute; inset:0; background:radial-gradient(circle at 80% 20%,rgba(255,255,255,.7),transparent 40%); pointer-events:none; }
    .slide > * { position:relative; z-index:1; }
    .slide-no { position:absolute; right:24px; bottom:18px; z-index:2; color:var(--muted); font-size:14px; }

    /* Slide 1 */
    .slide-1 { display:grid; grid-template-columns:42% 1fr; gap:40px; align-items:start; }
    .s1-left { display:flex; flex-direction:column; gap:14px; padding-top:8px; }
    .s1-left h1 { font-size:42px; }
    .s1-desc { font-size:17px; }
    .s1-file { font-size:14px; color:var(--muted); border-left:4px solid var(--blue2); padding-left:12px; }
    .s1-file p { font-size:14px; }
    .s1-risks { font-size:13px; color:#b45309; background:#fef3c7; border-radius:8px; padding:8px 12px; }
    .s1-right { display:flex; flex-direction:column; gap:10px; }
    .s1-kpi-title { font-size:13px; font-weight:800; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }
    .metric-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .metric-card { background:#fff; border:2px solid #e6edf6; border-radius:10px; padding:16px; border-top:5px solid var(--blue); }
    .metric-card span { color:var(--muted); font-size:12px; font-weight:800; display:block; margin-bottom:4px; }
    .metric-card strong { color:var(--blue); font-size:30px; line-height:1.1; display:block; margin-bottom:4px; }
    .metric-card small { color:var(--muted); font-size:12px; line-height:1.3; display:block; }

    /* Slide 2 */
    .slide-2 { display:flex; flex-direction:column; gap:18px; }
    .s2-header { border-bottom:2px solid rgba(15,82,186,.10); padding-bottom:14px; }
    .s2-header h1 { font-size:34px; margin-bottom:4px; }
    .s2-body { display:grid; grid-template-columns:1fr 1fr 1fr; gap:18px; flex:1; min-height:0; }
    .s2-chart { display:flex; flex-direction:column; }
    .s2-insights { display:flex; flex-direction:column; gap:12px; }
    .insight-row { display:flex; align-items:flex-start; gap:12px; background:#fff; border:2px solid #e6edf6; border-left:5px solid var(--blue2); border-radius:10px; padding:14px; }
    .insight-row p { font-size:14px; }

    /* Slide 3 */
    .slide-3 { display:grid; grid-template-columns:1fr 36%; gap:32px; }
    .s3-left { display:flex; flex-direction:column; gap:14px; min-height:0; }
    .s3-header-text h1 { font-size:30px; margin-bottom:4px; }
    .snapshot { flex:1; min-height:0; background:#111827; padding:8px; border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .snapshot svg { width:100%; height:100%; max-width:100%; max-height:100%; display:block; }
    .s3-right { display:flex; flex-direction:column; gap:20px; overflow:hidden; }
    .s3-section { display:flex; flex-direction:column; gap:8px; }
    .action-list { display:flex; flex-direction:column; gap:8px; }
    .action-row { display:flex; align-items:flex-start; gap:10px; }
    .step-num { font-size:18px; font-weight:900; color:var(--blue); flex:0 0 auto; line-height:1.3; }
    .action-row p { font-size:14px; }

    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style>
</head>
<body>
  ${slides.join('\n')}
</body>
</html>`;
};

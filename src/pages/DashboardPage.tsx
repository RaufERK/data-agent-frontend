import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Card, CardContent,
  LinearProgress, IconButton, Tooltip, TextField,
  Fade,
  Chip,
  Stack,
  Divider,
  MenuItem,
  Popover,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DeleteIcon from '@mui/icons-material/Delete';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SaveIcon from '@mui/icons-material/Save';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AddIcon from '@mui/icons-material/Add';
import { api, type PresentationBrief } from '../api';
import { useProject } from '../store/ProjectContext';
import { DashboardActionBar, type ExportActionTarget } from './dashboard/DashboardActionBar';
import { WidgetBuilderPanel } from './dashboard/WidgetBuilderPanel';
import { useWidgetBuilder } from './dashboard/useWidgetBuilder';
import { ChartPreview, TabbedFilterPreview } from './dashboard/ChartPreview';
import {
  BUILDER_TEMPLATE_LIBRARY,
  customizeWidgetTemplate,
} from './dashboard/dashboardBuilder';
import {
  CHART_THEME_PRESETS,
  EDITOR_COLOR_PRESETS,
  answerChartQuestion,
  applyColorPreset,
  applyDashboardFilter,
  convertChartType,
  createChartItem,
  deepClone,
  getCompactWidgetLayout,
  getCompactWidgetRank,
  getDashboardColumnCount,
  getPrimaryChartColor,
  getWidgetMinHeight,
  limitChartItems,
  normalizeChartLayout,
  normalizeChartType,
  parseNumberInput,
  resolvePositionCollisions,
  updateSeriesLabels,
  updateSliceLabels,
} from './dashboard/dashboardChartUtils';
import { toPng, toSvg } from 'html-to-image';
import {
  buildDashboardSvg,
  buildExportPayload,
  buildPresentationHtml,
  downloadBlob,
  downloadText,
  escapeHtml,
} from './dashboard/dashboardExport';
import {
  DASHBOARD_GRID_GAP,
  DASHBOARD_MAX_COLUMNS,
  DASHBOARD_ROW_HEIGHT,
  DashboardThemeContext,
  clamp,
  getFilterKey,
  type ChartItem,
} from './dashboard/dashboardShared';
import type {
  DashboardWidgetType,
  DashboardFilter,
  MockWidgetTemplate,
} from '../types';

const ACTUAL_TYPE_LABELS: Record<string, string> = {
  kpi: 'KPI',
  bar: 'Гистограмма',
  line: 'Линия',
  pie: 'Круговая',
  donut: 'Кольцевая',
  gauge: 'Индикатор',
  country_map: 'Карта',
  table: 'Таблица',
  filter: 'Фильтр',
  hbar: 'Горизонтальная',
};

const DashboardPage: React.FC = () => {
  const {
    project, buildDashboard,
    sessionId,
    setPetalStatus,
    dashboardActionRef,
    removeDashboardSnapshot,
  } = useProject();

  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState(false);
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<DashboardFilter>({});
  const [highlightState, setHighlightState] = useState<Record<string, { categories: string[]; color: 'anomaly' | 'warning' | 'positive' }>>({});
  const [editorAnchorEl, setEditorAnchorEl] = useState<HTMLElement | null>(null);
  const builder = useWidgetBuilder(project?.files ?? []);
  const [drillChartId, setDrillChartId] = useState<number | null>(null);
  const [drillData, setDrillData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [drillEditing, setDrillEditing] = useState(false);
  const [askChartId, setAskChartId] = useState<number | null>(null);
  const [chartQuestion, setChartQuestion] = useState('');
  const [chartAnswer, setChartAnswer] = useState('');
  const [resizingChartId, setResizingChartId] = useState<number | null>(null);
  const [exportingTarget, setExportingTarget] = useState<ExportActionTarget | null>(null);
  const [activeFilterTabIndex, setActiveFilterTabIndex] = useState(0);
  const [exportMenuAnchorEl, setExportMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [integrationMenuAnchorEl, setIntegrationMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [sourceImageOpen, setSourceImageOpen] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const autoBuiltRef = useRef(false);
  const dashboardGridRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{
    chartId: number;
    startX: number;
    startY: number;
    startColSpan: number;
    startRowSpan: number;
    columns: number;
    changed: boolean;
  } | null>(null);
  const baseCharts = project?.dashboardCharts ?? [];
  // Stable key to detect when backend actually produced a new dashboard
  const baseChartsKey = baseCharts.map(c => c.title).join('|');
  const usePositionedLayout = false;
  const dashboardBgTheme: 'dark' | 'light' = project?.dashboardBgTheme ?? 'dark';
  const mockupPreviewUrl = project?.imageFile?.previewUrl;
  const exportMenuOpen = Boolean(exportMenuAnchorEl);
  const integrationMenuOpen = Boolean(integrationMenuAnchorEl);
  const filterCharts = charts.filter(chart => normalizeChartType(chart.type) === 'filter');
  const compactCharts = usePositionedLayout
    ? charts
    : [
        ...filterCharts.slice(0, 1),
        ...charts.filter(chart => normalizeChartType(chart.type) !== 'filter'),
      ].sort((left, right) => getCompactWidgetRank(left) - getCompactWidgetRank(right));

  const markDashboardTouched = () => {
    setPetalStatus('dashboard', 'green');
  };

  const getNextWidgetId = () => Math.max(0, ...charts.map(chart => chart.id)) + 1;

  const selectedChart = charts.find(chart => chart.id === selectedChartId) || null;
  const askChart = askChartId != null ? charts.find(chart => chart.id === askChartId) ?? null : null;

  const getEditableChartId = () => selectedChartId ?? charts[0]?.id ?? null;

  const editDashboardChart = (updater: (chart: ChartItem) => ChartItem) => {
    const chartId = getEditableChartId();
    if (!chartId) return false;
    setCharts(prev => prev.map(chart => (chart.id === chartId ? updater(deepClone(chart)) : chart)));
    setSelectedChartId(chartId);
    markDashboardTouched();
    return true;
  };

  const applyThemePresetToDashboard = (presetId: string) => {
    const preset = CHART_THEME_PRESETS.find(item => item.id === presetId);
    if (!preset) return false;
    setCharts(prev => prev.map(chart => ({ ...chart, ...applyColorPreset(chart, preset.colors), id: chart.id })));
    markDashboardTouched();
    return true;
  };

  const exportDashboardAsSvg = async () => {
    if (!dashboardGridRef.current) return;
    try {
      const dataUrl = await toSvg(dashboardGridRef.current, { backgroundColor: '#111827', cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'dashboard.svg';
      a.click();
    } catch {
      // fallback: legacy foreignObject approach
      const title = project?.name || 'AI Data Agent Dashboard';
      downloadText(buildDashboardSvg(dashboardGridRef.current, title), 'dashboard.svg', 'image/svg+xml;charset=utf-8');
    }
  };

  const exportDashboardAsPng = async () => {
    if (!dashboardGridRef.current) return;
    try {
      const dataUrl = await toPng(dashboardGridRef.current, { backgroundColor: '#111827', cacheBust: true, pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'dashboard.png';
      a.click();
    } catch (err) {
      console.error('PNG export failed', err);
    }
  };

  const exportDashboardAsPdf = async () => {
    if (!dashboardGridRef.current) return;
    // open window synchronously before any await — browsers block window.open after async gaps
    const title = project?.name || 'AI Data Agent Dashboard';
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{margin:0}body{margin:0;background:#111827;display:flex;align-items:center;justify-content:center}img{max-width:100%;height:auto;display:block}</style></head><body><p style="color:#fff;font-family:sans-serif;padding:20px">Генерация PDF...</p></body></html>`);
    printWindow.document.close();
    try {
      const dataUrl = await toPng(dashboardGridRef.current, { backgroundColor: '#111827', cacheBust: true, pixelRatio: 2 });
      printWindow.document.body.innerHTML = `<img src="${dataUrl}">`;
      printWindow.print();
    } catch (err) {
      console.error('PDF export failed', err);
      printWindow.close();
    }
  };

  const exportDashboardPresentation = async () => {
    if (!dashboardGridRef.current) return;
    const title = project?.name || 'AI Data Agent Dashboard';
    const svg = buildDashboardSvg(dashboardGridRef.current, title);
    let brief: PresentationBrief | null = null;
    if (sessionId) {
      try {
        brief = (await api.generatePresentationBrief(sessionId, title, charts as unknown as Record<string, unknown>[])).brief;
      } catch (error) {
        console.warn('Presentation brief backend generation failed, using local fallback', error);
      }
    }
    const html = buildPresentationHtml(charts, svg, title, brief, project?.files ?? []);
    const presentationWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!presentationWindow) {
      downloadText(html, 'dashboard_presentation.html', 'text/html;charset=utf-8');
      return;
    }
    presentationWindow.document.write(`${html}<script>window.onload=function(){setTimeout(function(){window.print();}, 250);};</script>`);
    presentationWindow.document.close();
  };

  const openChartAsk = (chart: ChartItem, seedQuestion = 'почему тут пик?') => {
    setAskChartId(chart.id);
    setSelectedChartId(chart.id);
    setChartQuestion(seedQuestion);
    setChartAnswer(answerChartQuestion(chart, seedQuestion));
  };

  const submitChartQuestion = () => {
    if (!askChart) return;
    setChartAnswer(answerChartQuestion(askChart, chartQuestion || 'что важно в этом графике?'));
  };

  const handleBuild = () => {
    setBuilding(true);
    buildDashboard();
  };

  useEffect(() => {
    if (project && !built && !building && !autoBuiltRef.current) {
      autoBuiltRef.current = true;
      // Skip auto-build if dashboard was already built (e.g. from image mockup or prior run).
      // Only trigger backend build when no dashboard has been built yet at all.
      if (!project.dashboardBuilt) {
        handleBuild();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  useEffect(() => {
    if (!project?.dashboardBuilt) return;
    const rawCharts = baseCharts.map((chart, index) => createChartItem(chart, index + 1));
    const builtCharts = resolvePositionCollisions(rawCharts);
    setBuilding(false);
    setBuilt(true);
    setCharts(builtCharts);
    setSelectedChartId(builtCharts[0]?.id ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.dashboardBuilt, baseChartsKey, project?.dashboardHistory?.length]);

  useEffect(() => {
    if (!charts.length) {
      setSelectedChartId(null);
      return;
    }
    if (!charts.some(chart => chart.id === selectedChartId)) {
      setSelectedChartId(charts[0].id);
    }
  }, [charts, selectedChartId]);

  useEffect(() => {
    if (activeFilterTabIndex < filterCharts.length) return;
    setActiveFilterTabIndex(0);
  }, [activeFilterTabIndex, filterCharts.length]);

  /* ── Chat-driven palette action ──────────────────── */
  const WARM_PALETTE = ['#ef6a5b', '#f5c84c', '#f0a04b'];
  const COOL_PALETTE = ['#2f89ff', '#18b6b2', '#7a5bd1'];

  useEffect(() => {
    dashboardActionRef.current = (action: string) => {
      if (action === 'warm-palette') {
        setCharts(prev =>
          prev.map(chart => ({ ...chart, ...applyColorPreset(chart, WARM_PALETTE), id: chart.id })),
        );
        markDashboardTouched();
      }
      if (action === 'cool-palette') {
        setCharts(prev =>
          prev.map(chart => ({ ...chart, ...applyColorPreset(chart, COOL_PALETTE), id: chart.id })),
        );
        markDashboardTouched();
      }
      if (action.startsWith('theme:')) {
        applyThemePresetToDashboard(action.replace('theme:', ''));
      }
      if (action.startsWith('chart:set-type:')) {
        const nextType = action.replace('chart:set-type:', '');
        editDashboardChart(chart => convertChartType(chart, nextType));
      }
      if (action.startsWith('chart:top:')) {
        const limit = Number(action.replace('chart:top:', ''));
        if (Number.isFinite(limit) && limit > 0) {
          editDashboardChart(chart => limitChartItems(chart, limit));
        }
      }
      if (action.startsWith('chart:color:')) {
        const color = action.replace('chart:color:', '');
        editDashboardChart(chart => ({ ...chart, ...applyColorPreset(chart, [color, '#fbbf24', '#60a5fa']), id: chart.id }));
      }
      if (action.startsWith('chart:aggregation:')) {
        const aggregation = action.replace('chart:aggregation:', '');
        editDashboardChart(chart => ({
          ...chart,
          aggregation,
          recommendationReason: `Агрегация изменена командой пользователя: ${aggregation}.`,
          description: `${chart.description || 'Виджет'} · ${aggregation}`,
        }));
      }
      // ── Highlight actions ──
      if (action.startsWith('highlight:')) {
        const parts = action.split(':');
        const sourceId = parts[1];
        const category = parts[2];
        const color = parts[3] as 'anomaly' | 'warning' | 'positive';
        setHighlightState(prev => ({ ...prev, [sourceId]: { categories: [category], color } }));
      }
      if (action === 'highlight:reset') {
        setHighlightState({});
      }
      // ── Filter actions ──
      if (action.startsWith('filter:region:exclude:')) {
        const region = action.replace('filter:region:exclude:', '');
        setActiveFilter(prev => ({
          ...prev,
          excludeRegions: [...(prev.excludeRegions ?? []), region],
        }));
        markDashboardTouched();
      }
      if (action === 'filter:reset') {
        setActiveFilter({});
      }
      // ── Show specific widget on top ──
      if (action.startsWith('show:')) {
        const sourceId = action.replace('show:', '');
        const newChart = baseCharts.find(c => c.sourceId === sourceId);
        if (newChart) {
          setCharts(prev => {
            const exists = prev.find(c => c.sourceId === sourceId);
            if (exists) return prev;
            const nextId = Math.max(0, ...prev.map(c => c.id)) + 1;
            return [createChartItem(newChart, nextId), ...prev];
          });
        }
        markDashboardTouched();
      }
    };
    return () => { dashboardActionRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCharts]);

  const updateChart = (chartId: number, updater: (chart: ChartItem) => ChartItem) => {
    setCharts(prev => prev.map(chart => (chart.id === chartId ? updater(deepClone(chart)) : chart)));
    markDashboardTouched();
  };

  const handleFilterWidgetChange = (chart: ChartItem, values: string[]) => {
    if (!chart.filter) return;
    const key = getFilterKey(chart.filter.source, chart.filter.field);
    setActiveFilter(prev => {
      const nextSelections = { ...(prev.selections ?? {}) };
      if (values.length > 0) {
        nextSelections[key] = values;
      } else {
        delete nextSelections[key];
      }
      return {
        ...prev,
        selections: Object.keys(nextSelections).length > 0 ? nextSelections : undefined,
      };
    });
    markDashboardTouched();
  };

  const handleExport = async (target: ExportActionTarget) => {
    if (!charts.length) return;
    const dashboardTitle = project?.name === 'dashboard_mockup' ? 'Дашборд по макету' : 'AI Data Agent Dashboard';
    const payload = buildExportPayload(charts, dashboardTitle);

    setExportingTarget(target);
    try {
      if (target === 'visiology') {
        const result = await api.publishVisiologyDashboard(payload);
        const failedWidgets = result.widget_validation?.filter(widget => !widget.ok) ?? [];
        const viewerUrl = result.dashboard_url;
        const designerUrl = result.designer_url;
        const warnPart = failedWidgets.length > 0 ? `\n⚠️ ${failedWidgets.length} виджет(ов) вернули ошибку.` : '';
        const designerPart = designerUrl ? `\n\nРедактор: ${designerUrl}` : '';
        window.alert(`Дашборд опубликован в Visiology!${warnPart}\n\nViewer: ${viewerUrl}${designerPart}`);
        window.open(viewerUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (target === 'foresight_publish') {
        const result = await api.publishForesight(payload);
        const widgetSummary = result.widget_types?.length ? result.widget_types.join(', ') : `${result.widgets?.length ?? 0} виджет(ов)`;
        const urlInfo = result.view_url ? `\n\nСсылка: ${result.view_url}` : '';
        const keyInfo = result.object_key ? `\nObject key: ${result.object_key}` : (result.cube_key ? `\nCube key: ${result.cube_key}` : '');
        window.alert(
          `Дашборд опубликован в Foresight!\n\nСтрок: ${result.rows}\nВиджеты: ${widgetSummary}${keyInfo}${urlInfo}`,
        );
        if (result.view_url) {
          window.open(result.view_url, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      if (target === 'datalens_publish') {
        const result = await api.publishDataLensDashboard(payload);
        const datasetInfo = result.dataset_name || result.dataset_id
          ? `\nDataset: ${result.dataset_name ?? result.dataset_id}`
          : '';
        window.alert(
          `Нативный дашборд опубликован в DataLens!\n\nWorkbook: ${result.workbook_title}${datasetInfo}\nВиджеты: ${result.widget_count}\n\nСсылка: ${result.dashboard_url}`,
        );
        window.open(result.dashboard_url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (target === 'datalens_native_publish') {
        const result = await api.publishDataLensNativeDashboard(payload);
        window.alert(
          `Нативный дашборд опубликован в DataLens!\n\nWorkbook: ${result.workbook_title}\nDataset: ${result.dataset_name ?? result.dataset_id ?? 'создан'}\nВиджеты: ${result.widget_count}\n\nСсылка: ${result.dashboard_url}`,
        );
        window.open(result.dashboard_url, '_blank', 'noopener,noreferrer');
        return;
      }
      const { blob, filename } = await api.exportDashboard(target, payload);
      const fallbackExt = target === 'navigator' ? 'xml' : 'json';
      downloadBlob(blob, filename ?? `data_agent_dashboard_${target}.${fallbackExt}`);
    } catch (error) {
      console.error(error);
      window.alert(`Не удалось экспортировать: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExportingTarget(null);
    }
  };

  const handleIntegrationMenuAction = (target: ExportActionTarget) => {
    setIntegrationMenuAnchorEl(null);
    void handleExport(target);
  };

  const openAddFlow = (type: DashboardWidgetType) => {
    builder.open(type);
  };

  const addConfiguredWidget = () => {
    const { selectedSource, selectedTemplate, builderPrimaryField, builderSecondaryField, builderTableFields } = builder;
    if (!selectedSource || !selectedTemplate) return;

    const nextId = getNextWidgetId();
    const configuredChart = customizeWidgetTemplate(
      selectedTemplate,
      selectedSource,
      builderPrimaryField,
      builderSecondaryField,
      builderTableFields,
    );

    const nextChart = createChartItem({
      ...configuredChart,
      paletteType: configuredChart.paletteType ?? selectedTemplate.paletteType,
    }, nextId);

    setCharts(prev => [...prev, nextChart]);
    setSelectedChartId(nextId);
    builder.close();
    markDashboardTouched();
  };

  const closeWidgetEditor = () => {
    setEditorAnchorEl(null);
    setSelectedChartId(null);
  };

  const handleWidgetTypeChange = (chartId: number, nextType: string) => {
    const current = charts.find(chart => chart.id === chartId);
    if (!current?.sourceId) return;

    const currentSource = builder.availableSources.find(source => source.id === current.sourceId);
    if (!currentSource) return;

    const matchedTemplate = BUILDER_TEMPLATE_LIBRARY.find(
      template => normalizeChartType(template.actualType) === nextType,
    );

    if (!matchedTemplate) return;

    const nextPrimaryField = current.filter?.field
      ?? current.table?.columns?.[0]
      ?? current.metrics?.[0]
      ?? currentSource.fields[0]
      ?? '';
    const nextSecondaryField = current.type === 'kpi'
      ? current.metrics?.[0] ?? currentSource.fields[0] ?? ''
      : current.metrics?.[1] ?? current.metrics?.[0] ?? currentSource.fields[1] ?? currentSource.fields[0] ?? '';
    const nextTableFields = current.table?.columns ?? current.metrics ?? currentSource.fields.slice(0, Math.min(4, currentSource.fields.length));

    updateChart(chartId, (chart) => {
      const replaced = createChartItem({
        ...customizeWidgetTemplate(
          matchedTemplate,
          currentSource,
          nextPrimaryField,
          nextSecondaryField,
          nextTableFields,
        ),
        title: chart.title,
      }, chart.id);

      return {
        ...replaced,
        id: chart.id,
        colSpan: chart.colSpan,
        rowSpan: chart.rowSpan,
      };
    });
  };

  const handleColorChange = (chartId: number, colors: string[]) => {
    updateChart(chartId, (chart) => {
      const colored = applyColorPreset(chart, colors);
      return {
        ...chart,
        ...colored,
      };
    });
  };

  const handleWidgetLayoutChange = (chartId: number, field: 'colSpan' | 'rowSpan', value: number) => {
    updateChart(chartId, (chart) => ({
      ...chart,
      userResizedLayout: true,
      ...normalizeChartLayout({
        ...chart,
        [field]: value,
      }),
    }));
  };

  const removeChart = (id: number) => {
    setCharts(prev => prev.filter(chart => chart.id !== id));
    if (selectedChartId === id) {
      closeWidgetEditor();
    }
    markDashboardTouched();
  };

  const handleDragStart = (id: number) => {
    if (resizingChartId != null) return;
    dragItem.current = id;
  };

  const handleDragEnter = (id: number) => {
    dragOverItem.current = id;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...charts];
    const draggedIndex = items.findIndex(item => item.id === dragItem.current);
    const overIndex = items.findIndex(item => item.id === dragOverItem.current);
    if (draggedIndex < 0 || overIndex < 0) return;
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(overIndex, 0, draggedItem);
    setCharts(items);
    dragItem.current = null;
    dragOverItem.current = null;
    markDashboardTouched();
  };

  const finishResize = () => {
    const resizeState = resizeStateRef.current;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', finishResize);
    if (resizeState?.changed) {
      markDashboardTouched();
    }
    resizeStateRef.current = null;
    setResizingChartId(null);
  };

  const handleResizeMove = (event: MouseEvent) => {
    const resizeState = resizeStateRef.current;
    const gridElement = dashboardGridRef.current;
    if (!resizeState || !gridElement) return;

    const gridWidth = gridElement.getBoundingClientRect().width;
    const columns = resizeState.columns;
    const columnWidth = columns > 1
      ? (gridWidth - DASHBOARD_GRID_GAP * (columns - 1)) / columns
      : gridWidth;
    const widthUnit = Math.max(columnWidth + DASHBOARD_GRID_GAP, 1);
    const heightUnit = DASHBOARD_ROW_HEIGHT + DASHBOARD_GRID_GAP;
    const deltaColumns = Math.round((event.clientX - resizeState.startX) / widthUnit);
    const deltaRows = Math.round((event.clientY - resizeState.startY) / heightUnit);
    const maxColumns = columns === 1 ? 1 : columns;
    const nextColSpan = clamp(resizeState.startColSpan + deltaColumns, columns === 1 ? 1 : 3, maxColumns);
    const nextRowSpan = clamp(resizeState.startRowSpan + deltaRows, 2, 6);

    setCharts(prev => prev.map(chart => (
      chart.id === resizeState.chartId
        ? { ...chart, colSpan: nextColSpan, rowSpan: nextRowSpan, userResizedLayout: true }
        : chart
    )));

    if (nextColSpan !== resizeState.startColSpan || nextRowSpan !== resizeState.startRowSpan) {
      resizeState.changed = true;
    }
  };

  const startResize = (chartId: number, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const chart = charts.find(item => item.id === chartId);
    if (!chart) return;

    resizeStateRef.current = {
      chartId,
      startX: event.clientX,
      startY: event.clientY,
      startColSpan: chart.colSpan,
      startRowSpan: chart.rowSpan,
      columns: getDashboardColumnCount(),
      changed: false,
    };
    setResizingChartId(chartId);
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', finishResize, { once: true });
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', finishResize);
    };
  }, []);

  /* ── drill-down helpers ────────────────────────────── */

  const chartToTable = (chart: ChartItem): { headers: string[]; rows: string[][] } => {
    if (chart.type === 'table' && chart.table) {
      return { headers: chart.table.columns, rows: chart.table.rows.map(r => [...r]) };
    }
    if ((chart.type === 'bar' || chart.type === 'line' || chart.type === 'hbar') && chart.series && chart.categories) {
      const headers = ['Категория', ...chart.series.map(s => s.name)];
      const rows = chart.categories.map((cat, ci) =>
        [cat, ...chart.series!.map(s => String(s.values[ci] ?? ''))],
      );
      return { headers, rows };
    }
    if ((chart.type === 'pie' || chart.type === 'donut') && chart.slices) {
      const headers = ['Сегмент', 'Значение'];
      const rows = chart.slices.map(sl => [sl.label, String(sl.value)]);
      return { headers, rows };
    }
    if (chart.type === 'kpi') {
      const headers = ['Метрика', 'Значение'];
      const rows: string[][] = [[chart.title, chart.value ?? '']];
      if (chart.sparkline?.length) {
        chart.sparkline.forEach((v, i) => rows.push([`Точка ${i + 1}`, String(v)]));
      }
      return { headers, rows };
    }
    if (chart.type === 'filter' && chart.filter) {
      const headers = ['Опция', 'Кол-во'];
      const rows = chart.filter.options.map(o => [o.label, String(o.count ?? '')]);
      return { headers, rows };
    }
    return { headers: ['—'], rows: [] };
  };

  const openDrillDown = (chart: ChartItem) => {
    setDrillChartId(chart.id);
    setDrillData(chartToTable(chart));
    setDrillEditing(false);
  };

  const closeDrillDown = () => {
    setDrillChartId(null);
    setDrillData(null);
    setDrillEditing(false);
  };

  const handleDrillCellChange = (ri: number, ci: number, value: string) => {
    setDrillData(prev => {
      if (!prev) return prev;
      const rows = prev.rows.map(r => [...r]);
      rows[ri][ci] = value;
      return { ...prev, rows };
    });
  };

  const handleDrillHeaderChange = (ci: number, value: string) => {
    setDrillData(prev => {
      if (!prev) return prev;
      const headers = [...prev.headers];
      headers[ci] = value;
      return { ...prev, headers };
    });
  };

  const saveDrillDown = () => {
    if (drillChartId == null || !drillData) return;
    const chart = charts.find(c => c.id === drillChartId);
    if (!chart) return;

    updateChart(drillChartId, (draft) => {
      if (draft.type === 'table' && draft.table) {
        draft.table.columns = drillData.headers;
        draft.table.rows = drillData.rows;
        return draft;
      }

      if ((draft.type === 'bar' || draft.type === 'line' || draft.type === 'hbar') && draft.series && draft.categories) {
        draft.categories = drillData.rows.map(r => r[0]);
        draft.series = draft.series.map((s, si) => {
          const values = drillData.rows.map(r => parseNumberInput(r[si + 1] ?? '0'));
          return { ...s, name: drillData.headers[si + 1] ?? s.name, values, valueLabels: values.map(v => String(v)) };
        });
        return draft;
      }

      if ((draft.type === 'pie' || draft.type === 'donut') && draft.slices) {
        draft.slices = drillData.rows.map((r, i) => {
          const val = parseNumberInput(r[1] ?? '0');
          return { ...draft.slices![i], label: r[0], value: val, displayValue: String(val) };
        });
        const total = draft.slices.reduce((sum, sl) => sum + sl.value, 0);
        if (total > 0) {
          draft.slices = draft.slices.map(sl => ({ ...sl, displayValue: `${Math.round(sl.value / total * 100)}%` }));
        }
        return draft;
      }

      if (draft.type === 'kpi') {
        if (drillData.rows.length > 0) {
          draft.value = drillData.rows[0][1];
        }
        if (drillData.rows.length > 1) {
          draft.sparkline = drillData.rows.slice(1).map(r => parseNumberInput(r[1]));
        }
        return draft;
      }

      if (draft.type === 'filter' && draft.filter) {
        draft.filter.options = drillData.rows.map((r, i) => ({
          ...draft.filter!.options[i],
          label: r[0],
          value: r[0],
          count: parseNumberInput(r[1] ?? '0'),
        }));
        return draft;
      }

      return draft;
    });

    closeDrillDown();
  };

  const drillChart = drillChartId != null ? charts.find(c => c.id === drillChartId) ?? null : null;

  const renderDrillDownDialog = () => (
    <Dialog
      open={drillChart != null && drillData != null}
      onClose={closeDrillDown}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--app-surface)',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, pb: 0.5 }}>
        <OpenInFullIcon sx={{ fontSize: 20, color: 'var(--app-accent)' }} />
        {drillChart?.title ?? 'Данные виджета'}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {drillData && (
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {drillData.headers.map((h, ci) => (
                    <TableCell
                      key={ci}
                      sx={{
                        fontWeight: 700,
                        bgcolor: 'rgba(var(--app-panel-rgb), 0.92)',
                        borderBottom: '1px solid rgba(255,255,255,0.10)',
                        p: drillEditing ? 0 : undefined,
                      }}
                    >
                      {drillEditing ? (
                        <TextField
                          variant="standard"
                          size="small"
                          value={h}
                          onChange={e => handleDrillHeaderChange(ci, e.target.value)}
                          InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: '0.82rem', px: 1, py: 0.4 } }}
                          fullWidth
                        />
                      ) : h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {drillData.rows.map((row, ri) => (
                  <TableRow key={ri} hover>
                    {row.map((cell, ci) => (
                      <TableCell
                        key={ci}
                        sx={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          p: drillEditing ? 0 : undefined,
                        }}
                      >
                        {drillEditing ? (
                          <TextField
                            variant="standard"
                            size="small"
                            value={cell}
                            onChange={e => handleDrillCellChange(ri, ci, e.target.value)}
                            InputProps={{ disableUnderline: true, sx: { fontSize: '0.82rem', px: 1, py: 0.25 } }}
                            fullWidth
                          />
                        ) : cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.2 }}>
        {!drillEditing ? (
          <>
            <Button onClick={closeDrillDown}>Закрыть</Button>
            <Button variant="contained" size="small" startIcon={<EditOutlinedIcon />} onClick={() => setDrillEditing(true)}>
              Редактировать
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => {
              if (drillChart) setDrillData(chartToTable(drillChart));
              setDrillEditing(false);
            }}>
              Отменить
            </Button>
            <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={saveDrillDown}>
              Сохранить
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );

  const renderChartAskDialog = () => (
    <Dialog
      open={Boolean(askChart)}
      onClose={() => setAskChartId(null)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--app-surface)',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <HelpOutlineIcon sx={{ fontSize: 20, color: 'var(--app-accent)' }} />
        {askChart?.title ?? 'Спросить про виджет'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.4}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
            {['почему тут пик?', 'покажи строки за этой категорией', 'сравни с прошлым месяцем', 'где аномалия?'].map(prompt => (
              <Chip
                key={prompt}
                label={prompt}
                onClick={() => {
                  setChartQuestion(prompt);
                  if (askChart) setChartAnswer(answerChartQuestion(askChart, prompt));
                }}
                sx={{ bgcolor: 'rgba(var(--app-accent-rgb),0.12)', color: 'var(--app-text)' }}
              />
            ))}
          </Box>
          <TextField
            label="Вопрос к виджету"
            value={chartQuestion}
            onChange={event => setChartQuestion(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') submitChartQuestion();
            }}
            fullWidth
            size="small"
          />
          <Paper variant="outlined" sx={{ p: 1.4, bgcolor: 'rgba(var(--app-panel-rgb),0.42)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <Typography variant="body2" sx={{ color: 'var(--app-text)', lineHeight: 1.5 }}>
              {chartAnswer || 'Задайте вопрос по выбранному виджету.'}
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setAskChartId(null)}>Закрыть</Button>
        <Button variant="contained" onClick={submitChartQuestion}>Ответить</Button>
      </DialogActions>
    </Dialog>
  );

  const renderWidgetEditor = () => {
    if (!selectedChart) {
      return null;
    }

    const typeOptions = selectedChart.sourceId
      ? (() => {
          const currentSource = builder.availableSources.find(source => source.id === selectedChart.sourceId);
          if (!currentSource) return [] as MockWidgetTemplate[];

          return Array.from(
            new Map(
              BUILDER_TEMPLATE_LIBRARY
                .filter(template => currentSource.widgetTypes.includes(template.paletteType))
                .map(template => [normalizeChartType(template.actualType), template]),
            ).values(),
          );
        })()
      : [];

    return (
      <Box sx={{ p: 2, width: 360, maxWidth: 'calc(100vw - 32px)', bgcolor: dashboardBgTheme === 'light' ? '#ffffff' : '#25262d' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.35 }}>
          Редактор виджета
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)', mb: 1.5 }}>
          Источник: {selectedChart.sourceLabel || selectedChart.sourceId || 'без привязки к источнику'}
        </Typography>

        <Stack spacing={1.2}>
          <TextField
            label="Название"
            size="small"
            value={selectedChart.title}
            onChange={(event) => updateChart(selectedChart.id, chart => ({ ...chart, title: event.target.value }))}
          />

          <TextField
            select
            label="Тип виджета"
            size="small"
            value={selectedChart.type}
            onChange={(event) => handleWidgetTypeChange(selectedChart.id, event.target.value)}
            helperText={typeOptions.length > 0 ? 'Меняет пресет на другой вид по тем же данным.' : 'Для этого источника доступен только текущий тип.'}
          >
            {typeOptions.length > 0 ? typeOptions.map(template => (
              <MenuItem key={template.id} value={normalizeChartType(template.actualType)}>
                {ACTUAL_TYPE_LABELS[normalizeChartType(template.actualType)] || template.actualType}
              </MenuItem>
            )) : <MenuItem value={selectedChart.type}>{ACTUAL_TYPE_LABELS[selectedChart.type] || selectedChart.type}</MenuItem>}
          </TextField>

          <Box>
            <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', display: 'block', mb: 0.7 }}>
              Цветовая схема
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
              {EDITOR_COLOR_PRESETS.map(preset => (
                <Box
                  key={preset.name}
                  onClick={() => handleColorChange(selectedChart.id, preset.colors)}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: getPrimaryChartColor(selectedChart) === preset.colors[0] ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.14)',
                    background: `linear-gradient(135deg, ${preset.colors[0]} 0%, ${preset.colors[1]} 55%, ${preset.colors[2]} 100%)`,
                  }}
                />
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            <TextField
              select
              label="Ширина"
              size="small"
              value={selectedChart.colSpan}
              helperText="Сколько колонок занимает виджет"
              onChange={(event) => handleWidgetLayoutChange(selectedChart.id, 'colSpan', Number(event.target.value))}
            >
              {[3, 4, 6, 8, 9, 12].map(option => (
                <MenuItem key={option} value={option}>
                  {option}/12
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Высота"
              size="small"
              value={selectedChart.rowSpan}
              helperText="Сколько рядов занимает виджет"
              onChange={(event) => handleWidgetLayoutChange(selectedChart.id, 'rowSpan', Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map(option => (
                <MenuItem key={option} value={option}>
                  {option} ряда
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {selectedChart.type === 'kpi' && (
            <>
              <TextField
                label="Подзаголовок"
                size="small"
                value={selectedChart.subtitle || ''}
                onChange={(event) => updateChart(selectedChart.id, chart => ({ ...chart, subtitle: event.target.value }))}
              />
              <TextField
                label="Значение"
                size="small"
                value={selectedChart.value || ''}
                onChange={(event) => updateChart(selectedChart.id, chart => ({ ...chart, value: event.target.value }))}
              />
              <TextField
                label="Подпись под значением"
                size="small"
                value={selectedChart.trend || ''}
                onChange={(event) => updateChart(selectedChart.id, chart => ({ ...chart, trend: event.target.value }))}
              />
              <TextField
                label="Sparkline"
                size="small"
                value={(selectedChart.sparkline || []).join(', ')}
                helperText="Числа через запятую"
                onChange={(event) => updateChart(selectedChart.id, chart => ({
                  ...chart,
                  sparkline: event.target.value
                    .split(',')
                    .map(item => item.trim())
                    .filter(Boolean)
                    .map(parseNumberInput),
                }))}
              />
            </>
          )}

          {(selectedChart.type === 'bar' || selectedChart.type === 'line') && (
            <>
              <TextField
                label="Подпись оси X"
                size="small"
                value={selectedChart.xAxisLabel || ''}
                onChange={(event) => updateChart(selectedChart.id, chart => ({ ...chart, xAxisLabel: event.target.value }))}
              />
              <TextField
                label="Подпись оси Y"
                size="small"
                value={selectedChart.yAxisLabel || ''}
                onChange={(event) => updateChart(selectedChart.id, chart => ({ ...chart, yAxisLabel: event.target.value }))}
              />

              <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', pt: 0.2 }}>
                Категории и значения
              </Typography>

              {selectedChart.categories?.map((category, categoryIndex) => (
                <Paper key={`${selectedChart.id}-category-${categoryIndex}`} sx={{ p: 1, bgcolor: 'rgba(var(--app-panel-rgb), 0.38)', boxShadow: 'none' }}>
                  <TextField
                    label={`Категория ${categoryIndex + 1}`}
                    size="small"
                    fullWidth
                    value={category}
                    sx={{ mb: 1 }}
                    onChange={(event) => updateChart(selectedChart.id, chart => {
                      const categories = [...(chart.categories || [])];
                      categories[categoryIndex] = event.target.value;
                      return { ...chart, categories };
                    })}
                  />

                  <Stack spacing={0.9}>
                    {selectedChart.series?.map((series, seriesIndex) => (
                      <Box key={`${selectedChart.id}-series-${seriesIndex}`} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 0.8 }}>
                        <TextField
                          label={`Серия ${seriesIndex + 1}`}
                          size="small"
                          value={series.name}
                          onChange={(event) => updateChart(selectedChart.id, chart => {
                            const seriesItems = deepClone(chart.series || []);
                            seriesItems[seriesIndex].name = event.target.value;
                            return { ...chart, series: seriesItems };
                          })}
                        />
                        <TextField
                          label="Значение"
                          size="small"
                          value={series.values[categoryIndex]}
                          onChange={(event) => updateChart(selectedChart.id, chart => {
                            const seriesItems = deepClone(chart.series || []);
                            seriesItems[seriesIndex].values[categoryIndex] = parseNumberInput(event.target.value);
                            return { ...chart, series: updateSeriesLabels(seriesItems) };
                          })}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </>
          )}

          {(selectedChart.type === 'pie' || selectedChart.type === 'donut') && (
            <>
              <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', pt: 0.2 }}>
                Сегменты
              </Typography>
              {selectedChart.slices?.map((slice, sliceIndex) => (
                <Box key={`${selectedChart.id}-slice-${sliceIndex}`} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 0.8 }}>
                  <TextField
                    label="Подпись"
                    size="small"
                    value={slice.label}
                    onChange={(event) => updateChart(selectedChart.id, chart => {
                      const slices = deepClone(chart.slices || []);
                      slices[sliceIndex].label = event.target.value;
                      return { ...chart, slices };
                    })}
                  />
                  <TextField
                    label="Значение"
                    size="small"
                    value={slice.value}
                    onChange={(event) => updateChart(selectedChart.id, chart => {
                      const slices = deepClone(chart.slices || []);
                      slices[sliceIndex].value = parseNumberInput(event.target.value);
                      return { ...chart, slices: updateSliceLabels(slices) };
                    })}
                  />
                </Box>
              ))}
            </>
          )}

          {selectedChart.type === 'table' && selectedChart.table && (
            <>
              <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', pt: 0.2 }}>
                Заголовки колонок
              </Typography>
              {selectedChart.table.columns.map((column, columnIndex) => (
                <TextField
                  key={`${selectedChart.id}-col-${columnIndex}`}
                  label={`Колонка ${columnIndex + 1}`}
                  size="small"
                  value={column}
                  onChange={(event) => updateChart(selectedChart.id, chart => {
                    const table = deepClone(chart.table!);
                    table.columns[columnIndex] = event.target.value;
                    return { ...chart, table };
                  })}
                />
              ))}

              <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', pt: 0.4 }}>
                Ячейки
              </Typography>
              {selectedChart.table.rows.map((row, rowIndex) => (
                <Paper key={`${selectedChart.id}-row-${rowIndex}`} sx={{ p: 1, bgcolor: 'rgba(var(--app-panel-rgb), 0.38)', boxShadow: 'none' }}>
                  <Stack spacing={0.8}>
                    {row.map((cell, cellIndex) => (
                      <TextField
                        key={`${selectedChart.id}-cell-${rowIndex}-${cellIndex}`}
                        label={selectedChart.table?.columns[cellIndex] || `Ячейка ${cellIndex + 1}`}
                        size="small"
                        value={cell}
                        onChange={(event) => updateChart(selectedChart.id, chart => {
                          const table = deepClone(chart.table!);
                          table.rows[rowIndex][cellIndex] = event.target.value;
                          return { ...chart, table };
                        })}
                      />
                    ))}
                  </Stack>
                </Paper>
              ))}
            </>
          )}

          {selectedChart.type === 'filter' && selectedChart.filter && (
            <>
              <TextField
                label="Поле"
                size="small"
                value={selectedChart.filter.field}
                onChange={(event) => updateChart(selectedChart.id, chart => ({
                  ...chart,
                  filter: { ...chart.filter!, field: event.target.value },
                }))}
              />
              <TextField
                label="Источник"
                size="small"
                value={selectedChart.filter.source}
                onChange={(event) => updateChart(selectedChart.id, chart => ({
                  ...chart,
                  filter: { ...chart.filter!, source: event.target.value },
                }))}
              />
              <TextField
                label="Выбранные значения"
                size="small"
                helperText="Через запятую"
                value={(selectedChart.filter.selectedValues || []).join(', ')}
                onChange={(event) => updateChart(selectedChart.id, chart => ({
                  ...chart,
                  filter: {
                    ...chart.filter!,
                    selectedValues: event.target.value.split(',').map(item => item.trim()).filter(Boolean),
                  },
                }))}
              />

              <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', pt: 0.2 }}>
                Опции фильтра
              </Typography>
              {selectedChart.filter.options.map((option, optionIndex) => (
                <Box key={`${selectedChart.id}-filter-option-${optionIndex}`} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 0.8 }}>
                  <TextField
                    label="Опция"
                    size="small"
                    value={option.label}
                    onChange={(event) => updateChart(selectedChart.id, chart => {
                      const filter = deepClone(chart.filter!);
                      filter.options[optionIndex].label = event.target.value;
                      filter.options[optionIndex].value = event.target.value;
                      return { ...chart, filter };
                    })}
                  />
                  <TextField
                    label="Count"
                    size="small"
                    value={option.count ?? ''}
                    onChange={(event) => updateChart(selectedChart.id, chart => {
                      const filter = deepClone(chart.filter!);
                      filter.options[optionIndex].count = parseNumberInput(event.target.value);
                      return { ...chart, filter };
                    })}
                  />
                </Box>
              ))}
            </>
          )}
        </Stack>
      </Box>
    );
  };

  const renderConstructorStep = () => (
    <Fade in><Box sx={{ width: '100%', maxWidth: 'none', px: 2 }}>
      {!built && !building && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2.5 }}>
          <Button variant="contained" size="large" startIcon={<DashboardIcon />} onClick={handleBuild} sx={{ fontWeight: 700, px: 4 }}>
            Сгенерировать
          </Button>
        </Box>
      )}

      {building && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <LinearProgress sx={{ mb: 2, mx: 'auto', maxWidth: 500 }} />
          <Typography variant="body1" color="text.secondary">Генерация графиков и метрик...</Typography>
        </Box>
      )}

      {built && (
        <>
          {/* ── Dashboard version history tabs ── */}
          {(project?.dashboardHistory?.length ?? 0) > 0 && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0,
              mb: 1.5, borderBottom: '1px solid var(--app-border)',
              overflowX: 'auto',
              '&::-webkit-scrollbar': { height: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 2 },
            }}>
              {project!.dashboardHistory!.map((snap, snapIndex) => {
                const isActive = baseChartsKey === snap.charts.map(c => c.title).join('|');
                return (
                  <Box
                    key={snap.id}
                    onClick={() => {
                      const builtCharts = snap.charts.map((chart, i) => createChartItem(chart, i + 1));
                      setCharts(builtCharts);
                      setSelectedChartId(builtCharts[0]?.id ?? null);
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      pl: 1.5, pr: 0.5, py: 0.8,
                      cursor: 'pointer',
                      borderRight: '1px solid var(--app-border)',
                      borderBottom: isActive ? '2px solid var(--app-accent)' : '2px solid transparent',
                      bgcolor: isActive ? 'rgba(var(--app-accent-rgb),0.08)' : 'transparent',
                      color: isActive ? 'var(--app-text)' : 'var(--app-subtle-text)',
                      transition: 'all 0.15s',
                      flexShrink: 0,
                      '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.06)', color: 'var(--app-text)' },
                    }}
                  >
                    <DashboardIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' }}>
                      Дашборд {snapIndex + 1}
                    </Typography>
                    <Tooltip title="Удалить">
                      <IconButton
                        size="small"
                        aria-label={`Удалить версию дашборда ${snapIndex + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextHistory = (project!.dashboardHistory ?? []).filter(s => s.id !== snap.id);
                          if (isActive && nextHistory.length > 0) {
                            const builtCharts = nextHistory[nextHistory.length - 1].charts.map((chart, i) => createChartItem(chart, i + 1));
                            setCharts(builtCharts);
                            setSelectedChartId(builtCharts[0]?.id ?? null);
                          }
                          removeDashboardSnapshot(snap.id);
                        }}
                        sx={{ p: 0.25, opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
              <Tooltip title="Сгенерировать новый дашборд">
                <Box
                  onClick={handleBuild}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1.25, py: 0.8,
                    cursor: 'pointer',
                    color: 'var(--app-accent)',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.08)' },
                  }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Новый</Typography>
                </Box>
              </Tooltip>
            </Box>
          )}

          <WidgetBuilderPanel builder={builder} onAdd={addConfiguredWidget} />
          <DashboardActionBar
            exportMenuAnchorEl={exportMenuAnchorEl}
            exportMenuOpen={exportMenuOpen}
            integrationMenuAnchorEl={integrationMenuAnchorEl}
            integrationMenuOpen={integrationMenuOpen}
            exportingTarget={exportingTarget}
            mockupPreviewUrl={mockupPreviewUrl}
            sourceImageOpen={sourceImageOpen}
            onOpenAddFlow={openAddFlow}
            onSetExportMenuAnchorEl={setExportMenuAnchorEl}
            onSetIntegrationMenuAnchorEl={setIntegrationMenuAnchorEl}
            onExportPng={exportDashboardAsPng}
            onExportSvg={exportDashboardAsSvg}
            onExportPdf={exportDashboardAsPdf}
            onExportPresentation={exportDashboardPresentation}
            onIntegrationAction={handleIntegrationMenuAction}
            onToggleSourceImage={() => setSourceImageOpen(prev => !prev)}
          />

          {/* ── Active filter chips ── */}
          {((activeFilter.excludeRegions?.length ?? 0) > 0 || Object.keys(activeFilter.selections ?? {}).length > 0 || Object.keys(highlightState).length > 0) && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              {Object.entries(activeFilter.selections ?? {}).flatMap(([key, values]) => values.map(value => (
                <Chip
                  key={`${key}:${value}`}
                  label={`Фильтр: ${value}`}
                  size="small"
                  color="primary"
                  onDelete={() => setActiveFilter(prev => {
                    const nextSelections = { ...(prev.selections ?? {}) };
                    const nextValues = (nextSelections[key] ?? []).filter(item => item !== value);
                    if (nextValues.length > 0) {
                      nextSelections[key] = nextValues;
                    } else {
                      delete nextSelections[key];
                    }
                    return {
                      ...prev,
                      selections: Object.keys(nextSelections).length > 0 ? nextSelections : undefined,
                    };
                  })}
                />
              )))}
              {activeFilter.excludeRegions?.map(r => (
                <Chip
                  key={r}
                  label={`Без: ${r}`}
                  size="small"
                  color="warning"
                  onDelete={() => setActiveFilter(prev => ({
                    ...prev,
                    excludeRegions: prev.excludeRegions?.filter(x => x !== r),
                  }))}
                />
              ))}
              {Object.keys(highlightState).length > 0 && (
                <Chip
                  label="Снять выделение"
                  size="small"
                  variant="outlined"
                  onClick={() => setHighlightState({})}
                />
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, mb: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
          <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
          <DashboardThemeContext.Provider value={dashboardBgTheme}>
          <Box
            ref={dashboardGridRef}
            sx={{
              ...(dashboardBgTheme === 'light' ? {
                '--app-text': '#172033',
                '--app-subtle-text': 'rgba(23,32,51,0.62)',
                '--app-panel': '#ffffff',
                '--app-border': 'rgba(23,32,51,0.10)',
              } as React.CSSProperties : {}),
              display: usePositionedLayout ? 'block' : 'grid',
              position: usePositionedLayout ? 'relative' : undefined,
              aspectRatio: usePositionedLayout ? '1280 / 760' : undefined,
              minHeight: usePositionedLayout ? { xs: 620, lg: 760 } : undefined,
              overflow: usePositionedLayout ? 'hidden' : undefined,
              borderRadius: usePositionedLayout ? 1.5 : undefined,
              background: usePositionedLayout
                ? (dashboardBgTheme === 'light'
                    ? 'linear-gradient(135deg, rgba(240,242,248,1.0), rgba(232,236,245,1.0))'
                    : 'linear-gradient(135deg, rgba(30,58,104,0.22), rgba(53,35,97,0.16))')
                : undefined,
              gap: `${DASHBOARD_GRID_GAP}px`,
              gridAutoFlow: usePositionedLayout ? undefined : 'dense',
              gridTemplateColumns: {
                xs: 'repeat(1, minmax(0, 1fr))',
                sm: 'repeat(6, minmax(0, 1fr))',
                lg: `repeat(${DASHBOARD_MAX_COLUMNS}, minmax(0, 1fr))`,
              },
              gridAutoRows: 'auto',
            }}
          >
            {compactCharts.map((chart) => {
              let dc = applyDashboardFilter(chart, activeFilter);
              if (!usePositionedLayout) {
                const autoLayout = getCompactWidgetLayout(dc);
                if (dc.userResizedLayout) {
                  // keep user's colSpan/rowSpan but still apply auto type switch (bar→hbar)
                  if (autoLayout.type) dc = { ...dc, type: autoLayout.type };
                } else {
                  dc = { ...dc, ...autoLayout };
                }
                if (dc.type === 'filter' && filterCharts.length > 1) {
                  dc = { ...dc, title: 'Фильтр', colSpan: 9, rowSpan: 2 };
                }
              }
              const hl = highlightState[dc.sourceId ?? ''];
              if (hl) dc = { ...dc, highlightedCategories: hl.categories, highlightColor: hl.color };
              return (
                <Box
                  key={dc.id}
                  draggable={!usePositionedLayout}
                  onDragStart={() => handleDragStart(dc.id)}
                  onDragEnter={() => handleDragEnter(dc.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => event.preventDefault()}
                  sx={usePositionedLayout && dc.position ? {
                    position: 'absolute',
                    left: `${clamp(dc.position.left, 0, 0.98) * 100}%`,
                    top: `${clamp(dc.position.top, 0, 0.98) * 100}%`,
                    width: `${clamp(dc.position.width, 0.08, 1) * 100}%`,
                    height: `${clamp(dc.position.height, 0.08, 1) * 100}%`,
                    minWidth: 0,
                    p: 0.45,
                  } : {
                    gridColumn: {
                      xs: 'span 1',
                      sm: `span ${Math.min(dc.colSpan, 6)}`,
                      lg: `span ${dc.colSpan}`,
                    },
                    minHeight: getWidgetMinHeight(dc),
                    minWidth: 0,
                  }}
                >
                  <Card
                    variant="outlined"
                    sx={{
                      position: 'relative',
                      height: '100%',
                      minHeight: usePositionedLayout ? 0 : getWidgetMinHeight(dc),
                      overflow: 'hidden',
                      transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                      cursor: resizingChartId === dc.id ? 'nwse-resize' : usePositionedLayout ? 'default' : 'grab',
                      bgcolor: usePositionedLayout
                        ? (dashboardBgTheme === 'light' ? 'rgba(255,255,255,0.90)' : 'rgba(28,34,58,0.88)')
                        : (dashboardBgTheme === 'light' ? 'rgba(255,255,255,0.96)' : 'rgba(42,42,46,0.96)'),
                      border: selectedChartId === dc.id
                        ? (dashboardBgTheme === 'light' ? '1px solid rgba(23,32,51,0.22)' : '1px solid rgba(255,255,255,0.18)')
                        : (dashboardBgTheme === 'light' ? '1px solid rgba(23,32,51,0.08)' : '1px solid rgba(255,255,255,0.07)'),
                      boxShadow: usePositionedLayout
                        ? (dashboardBgTheme === 'light'
                            ? '0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)'
                            : '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.035)')
                        : (selectedChartId === dc.id ? '0 10px 26px rgba(0,0,0,0.22)' : '0 6px 18px rgba(0,0,0,0.16)'),
                      '&:hover': {
                        bgcolor: usePositionedLayout
                          ? (dashboardBgTheme === 'light' ? 'rgba(255,255,255,1.0)' : 'rgba(30,37,62,0.94)')
                          : (dashboardBgTheme === 'light' ? '#ffffff' : 'rgba(47,47,52,1)'),
                        boxShadow: usePositionedLayout
                          ? undefined
                          : '0 10px 24px rgba(0,0,0,0.22)',
                      },
                      '&:active': { cursor: 'grabbing' },
                    }}
                  >
                    <CardContent sx={{ px: 0, pt: usePositionedLayout ? 0.85 : 0.65, pb: usePositionedLayout ? 0.75 : 0.55, display: 'flex', flexDirection: 'column', height: '100%', '&:last-child': { pb: usePositionedLayout ? 0.75 : 0.55 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.35, minHeight: 20, px: usePositionedLayout ? 1 : 0.75, '& .widget-actions': { opacity: 0, transition: 'opacity 0.15s' }, '&:hover .widget-actions': { opacity: 1 } }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, flexGrow: 1, fontSize: '0.78rem', lineHeight: 1.15, color: dashboardBgTheme === 'light' ? '#172033' : undefined }} noWrap>
                          {dc.title}
                        </Typography>
                        <Box className="widget-actions" sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <Tooltip title="Редактор виджета">
                          <IconButton
                            size="small"
                            aria-label={`Открыть редактор виджета ${dc.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (selectedChartId === dc.id && editorAnchorEl) {
                                closeWidgetEditor();
                                return;
                              }
                              setSelectedChartId(dc.id);
                              setEditorAnchorEl(event.currentTarget);
                            }}
                            sx={{
                              p: 0.3,
                              color: selectedChartId === dc.id && editorAnchorEl ? 'var(--app-text)' : 'text.disabled',
                            }}
                          >
                            <EditOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Показать данные">
                          <IconButton
                            size="small"
                            aria-label={`Показать данные виджета ${dc.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDrillDown(dc);
                            }}
                            sx={{ p: 0.3, color: 'text.disabled' }}
                          >
                            <OpenInFullIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Спросить про виджет">
                          <IconButton
                            size="small"
                            aria-label={`Спросить про виджет ${dc.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openChartAsk(dc);
                            }}
                            sx={{ p: 0.3, color: 'text.disabled' }}
                          >
                            <HelpOutlineIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить виджет">
                          <IconButton
                            size="small"
                            aria-label={`Удалить виджет ${dc.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeChart(dc.id);
                            }}
                            sx={{ p: 0.3, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        </Box>
                      </Box>

                      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', width: '100%', overflow: 'hidden', px: usePositionedLayout ? 0.85 : 0.6 }}>
                        <Box sx={{ width: '100%', height: '100%' }}>
                          {dc.type === 'filter' && !usePositionedLayout && filterCharts.length > 1 ? (
                            <TabbedFilterPreview
                              charts={filterCharts}
                              activeIndex={activeFilterTabIndex}
                              activeFilter={activeFilter}
                              onTabChange={setActiveFilterTabIndex}
                              onFilterChange={handleFilterWidgetChange}
                            />
                          ) : (
                            <ChartPreview
                              chart={dc}
                              activeFilter={activeFilter}
                              onFilterChange={handleFilterWidgetChange}
                            />
                          )}
                        </Box>
                      </Box>

                      {!usePositionedLayout && (
                        <Box sx={{ mt: 0.25, px: usePositionedLayout ? 1 : 0.75 }}>
                          {dc.insights?.length ? (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.64rem', lineHeight: 1.15, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dc.insights[0]}
                            </Typography>
                          ) : dc.description ? (
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.64rem', lineHeight: 1.15, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dc.description}
                            </Typography>
                          ) : null}
                        </Box>
                      )}

                      <Tooltip title="Тяни, чтобы менять размер">
                        <IconButton
                          size="small"
                          aria-label={`Изменить размер виджета ${dc.title}`}
                          onMouseDown={(event) => startResize(dc.id, event)}
                          sx={{
                            position: 'absolute',
                            right: 6,
                            bottom: 6,
                            width: 24,
                            height: 24,
                            borderRadius: 1,
                            color: 'rgba(255,255,255,0.62)',
                            bgcolor: resizingChartId === dc.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                            cursor: 'nwse-resize',
                            zIndex: 2,
                            '&:hover': {
                              bgcolor: 'rgba(255,255,255,0.14)',
                              color: '#ffffff',
                            },
                          }}
                        >
                          <OpenInFullIcon sx={{ fontSize: 16, transform: 'rotate(45deg)' }} />
                        </IconButton>
                      </Tooltip>
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>
          </DashboardThemeContext.Provider>
          </Box>

          {mockupPreviewUrl && (
            <Box
              sx={{
                flex: sourceImageOpen ? { xs: '0 0 auto', lg: '0 0 38%' } : '0 0 0px',
                width: sourceImageOpen ? { xs: '100%', lg: '38%' } : 0,
                maxWidth: sourceImageOpen ? { xs: '100%', lg: 560 } : 0,
                opacity: sourceImageOpen ? 1 : 0,
                transform: sourceImageOpen ? 'translateX(0)' : 'translateX(24px)',
                transition: 'width 220ms ease, max-width 220ms ease, flex-basis 220ms ease, opacity 180ms ease, transform 220ms ease',
                overflow: 'hidden',
                pointerEvents: sourceImageOpen ? 'auto' : 'none',
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  height: '100%',
                  minHeight: { xs: 360, lg: usePositionedLayout ? 760 : 520 },
                  bgcolor: dashboardBgTheme === 'light' ? '#ffffff' : '#25262d',
                  borderColor: dashboardBgTheme === 'light' ? 'rgba(20,24,31,0.12)' : 'rgba(255,255,255,0.12)',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: dashboardBgTheme === 'light' ? '0 10px 28px rgba(20,24,31,0.12)' : '0 14px 34px rgba(0,0,0,0.24)',
                }}
              >
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderBottom: dashboardBgTheme === 'light' ? '1px solid rgba(20,24,31,0.08)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: dashboardBgTheme === 'light' ? '#172033' : 'var(--app-text)' }}>
                      Исходное изображение
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)' }} noWrap>
                      {project?.imageFile?.name ?? 'Макет дашборда'}
                    </Typography>
                  </Box>
                  <Button size="small" variant="text" onClick={() => setSourceImageOpen(false)} sx={{ minWidth: 0, px: 1, textTransform: 'none' }}>
                    Скрыть
                  </Button>
                </Box>
                <Box sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  bgcolor: dashboardBgTheme === 'light' ? '#f4f6fa' : '#151821',
                  p: 1,
                }}>
                  <Box
                    component="img"
                    src={mockupPreviewUrl}
                    alt="Исходное изображение дашборда"
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      borderRadius: 1,
                      boxShadow: dashboardBgTheme === 'light' ? '0 4px 14px rgba(20,24,31,0.14)' : '0 8px 22px rgba(0,0,0,0.34)',
                    }}
                  />
                </Box>
              </Paper>
            </Box>
          )}
          </Box>

          <Popover
            open={Boolean(editorAnchorEl && selectedChart)}
            anchorEl={editorAnchorEl}
            onClose={closeWidgetEditor}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{
              sx: {
                mt: 1,
                border: dashboardBgTheme === 'light' ? '1px solid rgba(20,24,31,0.16)' : '1px solid rgba(255,255,255,0.14)',
                boxShadow: dashboardBgTheme === 'light'
                  ? '0 18px 48px rgba(20,24,31,0.22)'
                  : '0 22px 56px rgba(0,0,0,0.58)',
                backgroundImage: 'none',
                bgcolor: dashboardBgTheme === 'light' ? '#ffffff' : '#25262d',
                borderRadius: 2,
                overflow: 'hidden',
              },
            }}
          >
            {renderWidgetEditor()}
          </Popover>

        </>
      )}

      {!built && !building && (
        <Paper sx={{ p: 6, textAlign: 'center', mb: 3, bgcolor: 'rgba(var(--app-surface-alt-rgb), 0.7)', border: 'none', boxShadow: 'none' }}>
          <DashboardIcon sx={{ fontSize: 64, color: 'var(--app-border)', mb: 2 }} />
          <Typography variant="h6" color="text.disabled">Дашборд пока пуст</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
            Нажмите «Сгенерировать», чтобы показать бизнес-метрики на основе текущего набора данных
          </Typography>
        </Paper>
      )}

    </Box></Fade>
  );

  return (
    <Box>
      {renderConstructorStep()}
      {renderDrillDownDialog()}
      {renderChartAskDialog()}
    </Box>
  );
};

export default DashboardPage;

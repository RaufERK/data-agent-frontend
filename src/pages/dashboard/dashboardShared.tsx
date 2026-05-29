import React from 'react';
import type { MockChart } from '../../types';

export const CHART_CANVAS_HEIGHT = 200;
export const KPI_CANVAS_HEIGHT = 120;
export const CHART_COLORS = ['var(--app-accent)', 'var(--app-violet)', 'var(--app-info)', 'var(--app-warning)', 'var(--app-text)'];

export const DashboardThemeContext = React.createContext<'dark' | 'light'>('dark');

export interface ChartItem extends MockChart {
  id: number;
  colSpan: number;
  rowSpan: number;
}

export const DASHBOARD_MAX_COLUMNS = 12;
export const DASHBOARD_ROW_HEIGHT = 82;
export const DASHBOARD_GRID_GAP = 10;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getFilterKey = (source: string, field: string) => `${source || 'dashboard'}::${field || 'value'}`;

export const getWidgetAccent = (chart: MockChart | ChartItem) => {
  const fallbackByType: Record<string, string> = {
    kpi: '#5ad0ca',
    filter: '#8fa2ff',
    table: '#a7b0bd',
    pie: '#7dd3fc',
    donut: '#7dd3fc',
    line: '#f472b6',
    hbar: '#8fa2ff',
    bar: '#f5c84c',
    gauge: '#4cc38a',
  };
  const normalizedType = chart.type === 'bar-horizontal' || chart.type === 'bar_horizontal'
    ? 'hbar'
    : chart.type === 'big_number'
      ? 'kpi'
      : chart.type === 'mosaic_map'
        ? 'country_map'
        : chart.type;
  return chart.color || chart.series?.[0]?.color || chart.slices?.[0]?.color || fallbackByType[normalizedType] || CHART_COLORS[0];
};

export const getChartCanvasHeight = (chart: ChartItem) => {
  if (chart.type === 'kpi') {
    return Math.max(KPI_CANVAS_HEIGHT, chart.rowSpan * DASHBOARD_ROW_HEIGHT - 60);
  }
  if (chart.type === 'table') {
    return Math.max(0, chart.rowSpan * DASHBOARD_ROW_HEIGHT - 42);
  }
  return Math.max(CHART_CANVAS_HEIGHT, chart.rowSpan * DASHBOARD_ROW_HEIGHT - 80);
};

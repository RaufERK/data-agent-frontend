import React from 'react';
import { Box, Typography, Chip, Divider, Tabs, Tab } from '@mui/material';
import type { DashboardFilter, MockChart, MockChartSeries, MockChartSlice } from '../../types';
import {
  CHART_COLORS,
  DashboardThemeContext,
  clamp,
  getChartCanvasHeight,
  getFilterKey,
  getWidgetAccent,
  type ChartItem,
} from './dashboardShared';

const metricTextSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const getMaxValue = (series: MockChartSeries[]) => {
  const values = series.flatMap(item => item.values);
  return Math.max(...values, 1);
};

const getLastValueLabel = (series: MockChartSeries) => {
  if (!series.valueLabels || series.valueLabels.length === 0) return undefined;
  return series.valueLabels[series.valueLabels.length - 1];
};

const getFilterTabLabel = (chart: ChartItem) => {
  const clean = (value: string) => value
    .replace(/^фильтр\s+по\s+/i, '')
    .replace(/[«»"]/g, '')
    .trim();
  const titleLabel = clean(chart.title || '');
  const fieldLabel = clean(chart.filter?.field || '');
  if (titleLabel && !['label', 'value', 'category'].includes(titleLabel.toLowerCase())) return titleLabel;
  if (fieldLabel && !['label', 'value', 'category'].includes(fieldLabel.toLowerCase())) return fieldLabel;
  return 'Фильтр';
};

const getAxisTicks = (maxValue: number) => [0, 0.25, 0.5, 0.75, 1].map((ratio) => maxValue * ratio);

const formatAxisValue = (value: number) => {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.0', '')}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')}K`;
  if (Math.abs(value) >= 10) return value.toFixed(0);
  return value.toFixed(1).replace('.0', '');
};

const formatSegmentValue = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млрд`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`;
  return Math.round(value).toLocaleString('ru-RU');
};

const parseDisplayNumber = (value: unknown) => {
  const parsed = parseFloat(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const STATUS_SERIES: Array<{ key: string; label: string; color: string; aliases: RegExp[] }> = [
  { key: 'not_ready', label: 'Не выведено в эксплуатацию', color: '#c94bc7', aliases: [/не\s*вывед/i, /эксплуатац/i] },
  { key: 'sale', label: 'В продаже', color: '#4d7fd3', aliases: [/в\s*продаже/i, /продаж[ае]/i] },
  { key: 'reserved', label: 'Зарезервировано', color: '#d79a5f', aliases: [/зарезерв/i, /резерв/i] },
  { key: 'sold', label: 'Продано', color: '#24b47e', aliases: [/продано/i] },
];

const normalizeStatusSeriesName = (name: string) => (
  STATUS_SERIES.find(status => status.aliases.some(alias => alias.test(name))) ?? null
);

const normalizeStackedHbarSeries = (chart: ChartItem) => {
  const categories = chart.categories ?? [];
  const sourceSeries = chart.series ?? [];
  if (!categories.length || !sourceSeries.length) return sourceSeries;

  const rowTotals = categories.map((_, categoryIndex) => (
    sourceSeries.reduce((sum, item) => sum + (item.values[categoryIndex] ?? 0), 0)
  ));
  const maxRowTotal = Math.max(...rowTotals, 1);
  const normalized: MockChartSeries[] = [];
  const usedKeys = new Set<string>();

  sourceSeries.forEach((item, fallbackIndex) => {
    const status = normalizeStatusSeriesName(item.name);
    const key = status?.key ?? `series_${fallbackIndex}`;
    if (usedKeys.has(key)) return;
    usedKeys.add(key);
    const values = item.values.map((value, categoryIndex) => {
      const rowTotal = rowTotals[categoryIndex] || 0;
      const looksLikeTotal = rowTotal > 0 && value > rowTotal * 0.72 && value > maxRowTotal * 0.72 && sourceSeries.length >= 3;
      return looksLikeTotal ? 0 : value;
    });
    normalized.push({
      ...item,
      name: status?.label ?? item.name,
      color: status?.color ?? item.color,
      values,
      valueLabels: values.map((value, index) => value > 0 ? (item.valueLabels?.[index] || formatSegmentValue(value)) : ''),
    });
  });

  return normalized.filter(item => item.values.some(value => value > 0));
};

const buildPieSlices = (slices: MockChartSlice[]) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let cumulative = 0;

  return slices.map((slice) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += slice.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = 50 + 40 * Math.cos(startAngle);
    const y1 = 50 + 40 * Math.sin(startAngle);
    const x2 = 50 + 40 * Math.cos(endAngle);
    const y2 = 50 + 40 * Math.sin(endAngle);
    const largeArcFlag = slice.value / total > 0.5 ? 1 : 0;

    return {
      ...slice,
      path: `M50,50 L${x1},${y1} A40,40 0 ${largeArcFlag},1 ${x2},${y2} Z`,
    };
  });
};

const LegendRow: React.FC<{ color: string; label: string; value?: string; fontScale?: number }> = ({
  color,
  label,
  value,
  fontScale = 1,
}) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const labelColor = bgTheme === 'light' ? '#172033' : 'var(--app-text)';
  const valueColor = bgTheme === 'light' ? 'rgba(23,32,51,0.62)' : 'var(--app-subtle-text)';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, width: '100%' }}>
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ ...metricTextSx, fontSize: `${0.72 * fontScale}rem`, color: labelColor, fontWeight: 600, minWidth: 0 }} noWrap>
        {label}
      </Typography>
      {value && (
        <Typography sx={{ ...metricTextSx, fontSize: `${0.72 * fontScale}rem`, color: valueColor, ml: 'auto', flexShrink: 0 }}>
          {value}
        </Typography>
      )}
    </Box>
  );
};

const KpiPreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const sparkline = chart.sparkline ?? [];
  const maxValue = Math.max(...sparkline, 1);
  const accent = chart.color || CHART_COLORS[0];
  const kpiValueColor = bgTheme === 'light' ? '#1a1a2e' : '#f7f9fb';
  const kpiMutedColor = bgTheme === 'light' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.58)';
  const subtitle = chart.subtitle && chart.subtitle.toLowerCase() !== 'count'
    ? chart.subtitle
    : undefined;
  const breakdown = chart.kpiBreakdown ?? [];
  const isMockup = isMockupChart(chart);
  const progressMax = chart.visualType === 'progress'
    ? (chart.progressMax && chart.progressMax > 0 ? chart.progressMax : 100)
    : null;
  const progressRatio = progressMax ? clamp(parseDisplayNumber(chart.value) / progressMax, 0, 1) : null;

  if (progressRatio !== null) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          p: 1.15,
          borderRadius: 1.5,
          background: 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.9, gap: 1 }}>
          <Typography sx={{ fontSize: '0.78rem', color: kpiMutedColor, fontWeight: 700 }}>
            Выполнение
          </Typography>
          <Typography
            sx={{
              fontSize: '1rem',
              fontWeight: 800,
              color: kpiValueColor,
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}
          >
            {chart.value || '—'}
          </Typography>
        </Box>

        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              height: 16,
              borderRadius: 999,
              overflow: 'hidden',
              bgcolor: bgTheme === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)',
              boxShadow: bgTheme === 'light' ? 'inset 0 0 0 1px rgba(0,0,0,0.04)' : 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }}
          >
            <Box
              sx={{
                width: `${Math.max(10, progressRatio * 100)}%`,
                height: '100%',
                borderRadius: 999,
                background: `linear-gradient(90deg, ${accent} 0%, ${accent}cc 100%)`,
                boxShadow: `0 0 24px ${accent}40`,
              }}
            />
          </Box>
          <Typography
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.76rem',
              fontWeight: 800,
              color: '#ffffff',
              textShadow: '0 1px 3px rgba(0,0,0,0.55)',
            }}
          >
            {chart.value || '—'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.55 }}>
          <Typography sx={{ fontSize: '0.72rem', color: kpiMutedColor }}>0%</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: kpiMutedColor }}>{Math.round(progressMax ?? 100)}%</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isMockup ? 'space-between' : 'center',
        p: isMockup ? 1.1 : 1,
        borderRadius: 1.5,
        background: 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.6, alignItems: 'stretch', minHeight: 0 }}>
        <Box sx={{ flex: sparkline.length > 0 && !isMockup ? '0 1 58%' : '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: isMockup ? 'flex-start' : 'center' }}>
          <Box sx={{ minWidth: 0, mb: 0.85 }}>
            {subtitle && (
              <Typography sx={{ fontSize: '0.9rem', color: kpiMutedColor, lineHeight: 1.3 }} noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>

          <Typography
            sx={{
              fontSize: isMockup ? 'clamp(2.15rem, 3vw, 3.05rem)' : 'clamp(2rem, 3.2vw, 3.2rem)',
              fontWeight: 800,
              color: kpiValueColor,
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
              textShadow: `0 0 20px ${accent}22`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {chart.value || '—'}
          </Typography>

          {chart.trend && !isMockup && (
            <Typography sx={{ mt: 0.7, fontSize: '0.78rem', color: kpiMutedColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {chart.trend}
            </Typography>
          )}
        </Box>

        {sparkline.length > 0 && !isMockup && chart.sparklineType === 'line' && (
          <Box sx={{ flex: '1 1 0', minWidth: 0, height: '100%', display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 140 78" style={{ width: '100%', height: 92, display: 'block' }}>
              <polyline
                points={sparkline.map((value, index) => {
                  const x = 8 + (index / Math.max(sparkline.length - 1, 1)) * 124;
                  const y = 66 - (value / maxValue) * 48;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke={accent}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Box>
        )}

        {sparkline.length > 0 && !isMockup && chart.sparklineType !== 'line' && (
          <Box
            sx={{
              flex: '1 1 0',
              minWidth: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 0.45,
              px: 0.2,
              py: 0.3,
            }}
          >
            {sparkline.map((value, index) => (
              <Box
                key={index}
                sx={{
                  flex: 1,
                  minWidth: 8,
                  height: `${Math.max(18, (value / maxValue) * 82)}px`,
                  background: index === sparkline.length - 1
                    ? `linear-gradient(180deg, ${accent} 0%, ${accent}cc 100%)`
                    : bgTheme === 'light'
                      ? 'linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.07) 100%)'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 100%)',
                  opacity: index === sparkline.length - 1 ? 1 : 0.9,
                  borderRadius: 999,
                  boxShadow: index === sparkline.length - 1 ? `0 0 16px ${accent}30` : 'none',
                }}
              />
            ))}
          </Box>
        )}
      </Box>
      {breakdown.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: breakdown.length > 2 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 1.15, mt: 1.4 }}>
          {breakdown.map(item => (
            <Box key={`${item.label}-${item.value}`} sx={{ minWidth: 0 }}>
              <Typography sx={{ color: kpiMutedColor, fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.15 }} noWrap>
                {item.label}
              </Typography>
              <Typography sx={{ color: kpiValueColor, fontSize: '0.84rem', fontWeight: 800, lineHeight: 1.25, mt: 0.25 }} noWrap>
                {item.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {isMockup && chart.trend && (
        <Typography sx={{ mt: 1.1, fontSize: '0.8rem', color: chart.trend.trim().startsWith('-') ? '#ff6b78' : kpiMutedColor, fontWeight: 800 }} noWrap>
          {chart.trend}
        </Typography>
      )}
      {isMockup && sparkline.length > 0 && chart.sparklineType === 'line' && (
        <Box sx={{ alignSelf: 'flex-end', width: '48%', minWidth: 160, mt: 0.4 }}>
          <svg viewBox="0 0 180 58" style={{ width: '100%', height: 58, display: 'block' }}>
            <polyline
              points={sparkline.map((value, index) => {
                const x = 8 + (index / Math.max(sparkline.length - 1, 1)) * 164;
                const y = 48 - (value / maxValue) * 34;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="#4d7fd3"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Box>
      )}
    </Box>
  );
};

const isMockupChart = (chart: MockChart | ChartItem) => chart.sourceLabel === 'mockup';

const BarChartPreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const chartAxisColor = bgTheme === 'light' ? 'rgba(0,0,0,0.52)' : 'rgba(255,255,255,0.52)';
  const chartGridColor = bgTheme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
  const categories = chart.categories ?? [];
  const series = chart.series ?? [];
  const maxValue = getMaxValue(series);
  const chartWidth = 800;
  const chartHeight = 260;
  const paddingLeft = 52;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 90;
  const availableHeight = chartHeight - paddingTop - paddingBottom;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const groupWidth = plotWidth / Math.max(categories.length, 1);
  const seriesCount = Math.max(series.length, 1);
  const intraGroupGap = 4;
  const groupInset = 6;
  const barWidth = Math.min(36, (groupWidth - groupInset * 2 - intraGroupGap * Math.max(seriesCount - 1, 0)) / seriesCount);
  const ticks = getAxisTicks(maxValue);
  const categoryLabelY = chartHeight - paddingBottom + 12;
  const barChartFontScale = 1;
  const maxLabelLen = categories.length > 10 ? 12 : 18;

  if (series.length === 0) {
    return null;
  }

  const TECHNICAL_NAMES = new Set(['count', 'value', 'total', 'avg', 'sum', 'avg_sum', 'cnt']);
  const showBarLegend = series.length > 1 || (series.length === 1 && !TECHNICAL_NAMES.has(series[0].name.toLowerCase()));

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 0.75 }}>
      {showBarLegend && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
          {series.map(item => (
            <LegendRow key={item.name} color={item.color} label={item.name} value={isMockupChart(chart) ? undefined : getLastValueLabel(item)} fontScale={barChartFontScale} />
          ))}
        </Box>
      )}

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', flex: 1, minHeight: 0, display: 'block', overflow: 'visible' }}
      >
        {ticks.map((tick, index) => {
          const ratio = index / (ticks.length - 1);
          const y = paddingTop + availableHeight - availableHeight * ratio;
          return (
            <g key={tick}>
              <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke={chartGridColor} strokeWidth="1" />
              <text x={paddingLeft - 6} y={y + 4} textAnchor="end" fill={chartAxisColor} fontSize="13">
                {formatAxisValue(tick)}
              </text>
            </g>
          );
        })}

        {categories.map((category, categoryIndex) => {
          const groupX = paddingLeft + categoryIndex * groupWidth + groupInset;
          const isHighlighted = chart.highlightedCategories?.includes(category);
          const isAnyHighlighted = (chart.highlightedCategories?.length ?? 0) > 0;
          const highlightFill =
            chart.highlightColor === 'anomaly' ? '#ef4444' :
            chart.highlightColor === 'warning' ? '#f5c84c' : '#4cc38a';
          const groupCenterX = groupX + ((barWidth + intraGroupGap) * seriesCount - intraGroupGap) / 2;
          const label = String(category).length > maxLabelLen ? String(category).slice(0, maxLabelLen) + '…' : String(category);

          return (
            <g key={category}>
              {series.map((item, seriesIndex) => {
                const value = item.values[categoryIndex] ?? 0;
                const height = Math.max(10, (value / maxValue) * availableHeight);
                const x = groupX + seriesIndex * (barWidth + intraGroupGap);
                const y = paddingTop + availableHeight - height;

                return (
                  <g key={`${item.name}-${category}`}>
                    {isHighlighted && (
                      <rect x={x - 4} y={y - 4} width={barWidth + 8} height={height + 4} rx="5" fill={highlightFill} opacity={0.10} />
                    )}
                    <rect
                      x={x} y={y} width={barWidth} height={height} rx="3"
                      fill={item.color}
                      stroke={isHighlighted ? highlightFill : 'none'}
                      strokeWidth={isHighlighted ? 2 : 0}
                      opacity={isAnyHighlighted && !isHighlighted ? 0.72 : 0.9}
                    />
                  </g>
                );
              })}
              <text
                x={groupCenterX}
                y={categoryLabelY}
                textAnchor="end"
                fill={isHighlighted ? highlightFill : chartAxisColor}
                fontSize="12"
                fontWeight={isHighlighted ? '700' : '400'}
                transform={`rotate(-45 ${groupCenterX} ${categoryLabelY})`}
              >
                {label}
              </text>
            </g>
          );
        })}

      </svg>
    </Box>
  );
};

const HorizontalBarPreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const hbarCategoryColor = bgTheme === 'light' ? '#1a1a2e' : '#f1f5f9';
  const hbarTotalColor = bgTheme === 'light' ? '#1a2233' : '#f8fafc';
  const hbarTrackColor = bgTheme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const categories = chart.categories ?? [];
  const series = normalizeStackedHbarSeries(chart);
  const totals = categories.map((_, categoryIndex) => (
    series.reduce((sum, item) => sum + (item.values[categoryIndex] ?? 0), 0)
  ));
  const maxTotal = Math.max(...totals, 1);
  const maxCatLen = Math.max(...categories.map(c => String(c).length), 1);
  const labelColWidth = Math.min(220, Math.max(72, maxCatLen * 7.5));

  if (series.length === 0 || categories.length === 0) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 0.9, justifyContent: 'flex-start', pt: 0.2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, rowGap: 0.45, mb: 0.2 }}>
        {series.map(item => (
          <LegendRow key={item.name} color={item.color} label={item.name} fontScale={0.92} />
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.05 }}>
        {categories.map((category, categoryIndex) => {
          const total = totals[categoryIndex] || 0;
          return (
            <Box key={category} sx={{ display: 'grid', gridTemplateColumns: `${labelColWidth}px minmax(0, 1fr) auto`, gap: 1, alignItems: 'center' }}>
              <Typography sx={{ color: hbarCategoryColor, fontWeight: 800, fontSize: '0.82rem', wordBreak: 'break-word', lineHeight: 1.2 }}>
                {category}
              </Typography>
              <Box
                sx={{
                  height: 22,
                  width: `${Math.max(7, (total / maxTotal) * 100)}%`,
                  minWidth: 56,
                  display: 'flex',
                  overflow: 'hidden',
                  borderRadius: 0.35,
                  bgcolor: hbarTrackColor,
                }}
              >
                {series.map((item, seriesIndex) => {
                  const value = item.values[categoryIndex] ?? 0;
                  const ratio = total > 0 ? (value / total) * 100 : 0;
                  if (ratio <= 0) return null;
                  return (
                    <Box
                      key={item.name}
                      sx={{
                        width: `${ratio}%`,
                        minWidth: ratio > 4 ? 12 : 3,
                        bgcolor: item.color,
                        borderRight: seriesIndex < series.length - 1 ? '1px solid rgba(16,24,39,0.75)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {ratio >= 12 && (
                        <Typography sx={{ color: '#eef4ff', fontSize: '0.68rem', fontWeight: 800, lineHeight: 1 }} noWrap>
                          {item.valueLabels?.[categoryIndex] || formatSegmentValue(value)}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
              <Typography sx={{ color: hbarTotalColor, fontWeight: 900, fontSize: '0.78rem', minWidth: 64, textAlign: 'right' }} noWrap>
                {formatSegmentValue(total)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const LineChartPreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const chartAxisColor = bgTheme === 'light' ? 'rgba(0,0,0,0.52)' : 'rgba(255,255,255,0.52)';
  const chartGridColor = bgTheme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
  const categories = chart.categories ?? [];
  const series = chart.series ?? [];
  const maxValue = getMaxValue(series);
  const width = 800;
  const height = 260;
  const paddingLeft = 52;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 90;
  const availableHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingLeft - paddingRight;
  const stepX = categories.length > 1 ? plotWidth / (categories.length - 1) : 0;
  const ticks = getAxisTicks(maxValue);

  if (series.length === 0) {
    return null;
  }

  const TECHNICAL_NAMES_LINE = new Set(['count', 'value', 'total', 'avg', 'sum', 'avg_sum', 'cnt']);
  const showLineLegend = series.length > 1 || (series.length === 1 && !TECHNICAL_NAMES_LINE.has(series[0].name.toLowerCase()));

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 0.75 }}>
      {showLineLegend && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
          {series.map(item => (
            <LegendRow key={item.name} color={item.color} label={item.name} value={getLastValueLabel(item)} />
          ))}
        </Box>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', flex: 1, minHeight: 0, display: 'block', overflow: 'visible' }}
      >
        {ticks.map((tick, index) => {
          const ratio = index / (ticks.length - 1);
          const y = paddingTop + availableHeight - availableHeight * ratio;
          return (
            <g key={tick}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke={chartGridColor} strokeWidth="1" />
              <text x={paddingLeft - 6} y={y + 4} textAnchor="end" fill={chartAxisColor} fontSize="13">
                {formatAxisValue(tick)}
              </text>
            </g>
          );
        })}

        {series.map(item => {
          const points = item.values.map((value, index) => {
            const x = paddingLeft + stepX * index;
            const y = paddingTop + availableHeight - (value / maxValue) * availableHeight;
            return `${x},${y}`;
          }).join(' ');
          const highlightFill =
            chart.highlightColor === 'anomaly' ? '#ef4444' :
            chart.highlightColor === 'warning' ? '#f5c84c' : '#4cc38a';

          return (
            <g key={item.name}>
              <polyline
                points={points}
                fill="none"
                stroke={item.color}
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
              />
              {item.values.map((value, index) => {
                const x = paddingLeft + stepX * index;
                const y = paddingTop + availableHeight - (value / maxValue) * availableHeight;
                const monthLabel = categories[index];
                const isHl = chart.highlightedCategories?.includes(monthLabel);
                return (
                  <g key={`${item.name}-${index}`}>
                    {isHl && (
                      <circle cx={x} cy={y} r="7" fill="none" stroke={highlightFill} strokeWidth="2" opacity={0.9} />
                    )}
                    <circle
                      cx={x} cy={y}
                      r={isHl ? 4.4 : 3.6}
                      fill="#ffffff"
                      stroke={isHl ? highlightFill : item.color}
                      strokeWidth={isHl ? 2.2 : 2}
                      opacity={1}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        {categories.map((category, index) => {
          const maxVisible = 8;
          const step = Math.ceil(categories.length / maxVisible);
          if (index % step !== 0 && index !== categories.length - 1) return null;
          const label = String(category).length > 16 ? String(category).slice(0, 16) + '…' : String(category);
          const rawX = paddingLeft + stepX * index;
          const labelX = Math.min(width - paddingRight - 16, Math.max(paddingLeft + 16, rawX));
          const labelY = paddingTop + availableHeight + 16;
          return (
            <text
              key={category}
              x={labelX}
              y={labelY}
              textAnchor="end"
              fill={chartAxisColor}
              fontSize="12"
              transform={`rotate(-45 ${labelX} ${labelY})`}
            >
              {label}
            </text>
          );
        })}

        {chart.xAxisLabel && !['period', 'category', 'date', 'month', 'year', 'week', 'quarter', 'value', 'count', 'x', 'y'].includes(chart.xAxisLabel.toLowerCase()) && (
          <text x={paddingLeft + plotWidth / 2} y={height - 4} textAnchor="middle" fill={chartAxisColor} fontSize="12">
            {chart.xAxisLabel}
          </text>
        )}
      </svg>
    </Box>
  );
};

const PieChartPreview: React.FC<{ chart: ChartItem; canvasHeight: number; donut?: boolean }> = ({ chart, donut = false }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const panelFill = bgTheme === 'light' ? '#ffffff' : 'var(--app-panel)';
  const slices = chart.slices ?? [];
  const renderedSlices = buildPieSlices(slices);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const donutCaption = chart.subtitle?.split('|').map(item => item.trim()).filter(Boolean).at(0);

  if (slices.length === 0) {
    return null;
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', gap: 1.25, overflow: 'hidden', minWidth: 0 }}>
      <Box sx={{ flex: '0 0 30%', minWidth: 84, maxWidth: 138, height: '100%' }}>
        {donut ? (
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }}>
            {(() => {
              let offset = 0;
              return slices.map(slice => {
                const radius = 38;
                const circumference = 2 * Math.PI * radius;
                const dash = (slice.value / total) * circumference;
                const circle = (
                  <circle
                    key={slice.label}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="14"
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={-offset}
                    opacity={0.9}
                  />
                );
                offset += dash;
                return circle;
              });
            })()}
            <circle cx="50" cy="50" r="23" fill={panelFill} />
            {donutCaption && (
              <text x="50" y="52" textAnchor="middle" fill="rgba(128,128,128,0.9)" fontSize="6.5" fontWeight="700">
                {donutCaption}
              </text>
            )}
          </svg>
        ) : (
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }}>
            {renderedSlices.map(slice => (
              <path key={slice.label} d={slice.path} fill={slice.color} opacity={0.9} />
            ))}
            <circle cx="50" cy="50" r="16" fill={panelFill} />
          </svg>
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.42, overflow: 'hidden' }}>
        {slices.map(slice => (
          <LegendRow key={slice.label} color={slice.color} label={slice.label} value={slice.displayValue} fontScale={0.82} />
        ))}
      </Box>
    </Box>
  );
};

const TablePreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const table = chart.table ?? (
    chart.categories?.length && chart.series?.length
      ? {
        columns: ['Показатель', ...chart.series.map(series => series.name)],
        rows: chart.categories.map((category, index) => [
          category,
          ...chart.series!.map(series => String(series.values[index] ?? '—')),
        ]),
      }
      : null
  );

  if (!table) {
    return null;
  }

  const columnCount = Math.max(table.columns.length, 1);
  const gridTemplateColumns = `repeat(${columnCount}, minmax(${columnCount > 4 ? 112 : 0}px, 1fr))`;
  const headerColor = bgTheme === 'light' ? '#172033' : 'var(--app-text)';
  const rowColor = bgTheme === 'light' ? 'rgba(23,32,51,0.78)' : 'var(--app-subtle-text)';
  const borderColor = bgTheme === 'light' ? 'rgba(23,32,51,0.09)' : 'rgba(255,255,255,0.06)';

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      borderRadius: 1,
      bgcolor: 'transparent',
      overflow: 'auto',
    }}>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns,
        gap: 0.9,
        px: 0.75,
        py: 0.55,
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bgcolor: bgTheme === 'light' ? 'rgba(245,247,252,0.97)' : 'rgba(40,40,44,0.94)',
        borderBottom: `1px solid ${borderColor}`,
      }}>
        {table.columns.map(column => (
          <Typography key={column} sx={{ ...metricTextSx, color: headerColor, fontWeight: 800 }} noWrap>
            {column}
          </Typography>
        ))}
      </Box>

      {table.rows.map((row, rowIndex) => (
        <Box key={rowIndex} sx={{
          display: 'grid',
          gridTemplateColumns,
          gap: 0.9,
          px: 0.75,
          py: 0.48,
          bgcolor: rowIndex % 2 === 0
            ? (bgTheme === 'light' ? 'rgba(20,24,31,0.025)' : 'rgba(255,255,255,0.025)')
            : 'transparent',
          borderBottom: rowIndex < table.rows.length - 1 ? `1px solid ${borderColor}` : 'none',
        }}>
          {row.map((cell, cellIndex) => (
            <Typography key={`${rowIndex}-${cellIndex}`} sx={{ ...metricTextSx, color: rowColor }} noWrap title={String(cell)}>
              {cell}
            </Typography>
          ))}
        </Box>
      ))}
    </Box>
  );
};

const FilterPreview: React.FC<{
  chart: ChartItem;
  canvasHeight: number;
  selectedValues: string[];
  onChange: (values: string[]) => void;
}> = ({ chart, canvasHeight, selectedValues, onChange }) => {
  const filter = chart.filter;
  const bgTheme = React.useContext(DashboardThemeContext);

  if (!filter) {
    return <GenericPlaceholder label="Пустой фильтр" canvasHeight={canvasHeight} />;
  }

  const visibleOptions = filter.options.slice(0, 12);
  const selectedSet = new Set(selectedValues);
  const accent = chart.color || getWidgetAccent(chart);
  const chipBorder = bgTheme === 'light' ? 'rgba(20,24,31,0.14)' : 'rgba(255,255,255,0.12)';
  const chipIdleBg = bgTheme === 'light' ? 'rgba(20,24,31,0.04)' : 'rgba(255,255,255,0.055)';
  const chipText = bgTheme === 'light' ? 'rgba(20,24,31,0.68)' : 'var(--app-subtle-text)';
  const toggleValue = (value: string) => {
    if (!filter.multi) {
      onChange(selectedSet.has(value) ? [] : [value]);
      return;
    }
    onChange(selectedSet.has(value)
      ? selectedValues.filter(item => item !== value)
      : [...selectedValues, value]);
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        borderRadius: 1,
        overflow: 'hidden',
        px: 0.15,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
        <Chip
          label="Все значения"
          size="small"
          onClick={() => onChange([])}
          sx={{
            height: 24,
            fontSize: '0.72rem',
            bgcolor: selectedValues.length === 0 ? accent : chipIdleBg,
            color: selectedValues.length === 0 ? '#fff' : chipText,
            fontWeight: 800,
            border: `1px solid ${selectedValues.length === 0 ? accent : chipBorder}`,
            cursor: 'pointer',
            '&:hover': { bgcolor: selectedValues.length === 0 ? accent : (bgTheme === 'light' ? 'rgba(20,24,31,0.07)' : 'rgba(255,255,255,0.10)') },
          }}
        />
        {selectedValues.map(value => (
          <Chip
            key={value}
            label={value}
            size="small"
            onDelete={() => toggleValue(value)}
            sx={{
              height: 24,
              fontSize: '0.72rem',
              bgcolor: accent,
              color: '#fff',
              fontWeight: 800,
              '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.78)', fontSize: 16 },
              '& .MuiChip-deleteIcon:hover': { color: '#fff' },
            }}
          />
        ))}
      </Box>

      <Divider sx={{ borderColor: chipBorder, my: 0 }} />

      <Box sx={{ display: 'flex', alignContent: 'flex-start', flexWrap: 'wrap', gap: 0.5, overflow: 'auto', flex: 1, pr: 0.25 }}>
        {visibleOptions.map(option => (
          <Chip
            key={option.value}
            label={option.count ? `${option.label}  ${option.count}` : option.label}
            size="small"
            variant="outlined"
            onClick={() => toggleValue(option.value)}
            sx={{
              height: 22,
              fontSize: '0.70rem',
              color: selectedSet.has(option.value) ? '#fff' : chipText,
              bgcolor: selectedSet.has(option.value) ? accent : chipIdleBg,
              borderColor: selectedSet.has(option.value) ? accent : chipBorder,
              cursor: 'pointer',
              maxWidth: '100%',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              '&:hover': {
                bgcolor: selectedSet.has(option.value) ? accent : (bgTheme === 'light' ? 'rgba(20,24,31,0.07)' : 'rgba(255,255,255,0.08)'),
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export const TabbedFilterPreview: React.FC<{
  charts: ChartItem[];
  activeIndex: number;
  activeFilter?: DashboardFilter;
  onTabChange: (index: number) => void;
  onFilterChange: (chart: ChartItem, values: string[]) => void;
}> = ({ charts, activeIndex, activeFilter, onTabChange, onFilterChange }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const safeIndex = clamp(activeIndex, 0, Math.max(charts.length - 1, 0));
  const activeChart = charts[safeIndex];

  if (!activeChart) {
    return <GenericPlaceholder label="Пустой фильтр" canvasHeight={120} />;
  }

  if (charts.length <= 1) {
    return (
      <FilterPreview
        chart={activeChart}
        canvasHeight={120}
        selectedValues={activeChart.filter ? activeFilter?.selections?.[getFilterKey(activeChart.filter.source, activeChart.filter.field)] ?? [] : []}
        onChange={(values) => onFilterChange(activeChart, values)}
      />
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <Tabs
        value={safeIndex}
        onChange={(_, value) => onTabChange(value)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 28,
          mb: 0.55,
          borderBottom: bgTheme === 'light' ? '1px solid rgba(23,32,51,0.10)' : '1px solid rgba(255,255,255,0.07)',
          '& .MuiTabs-indicator': { height: 2, bgcolor: activeChart.color || getWidgetAccent(activeChart) },
          '& .MuiTab-root': {
            minHeight: 28,
            px: 1.1,
            py: 0,
            textTransform: 'none',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: bgTheme === 'light' ? 'rgba(23,32,51,0.55)' : 'var(--app-subtle-text)',
          },
          '& .Mui-selected': { color: bgTheme === 'light' ? '#172033' : 'var(--app-text)' },
        }}
      >
        {charts.map((chart) => (
          <Tab key={chart.id} label={getFilterTabLabel(chart)} />
        ))}
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <FilterPreview
          chart={activeChart}
          canvasHeight={120}
          selectedValues={activeChart.filter ? activeFilter?.selections?.[getFilterKey(activeChart.filter.source, activeChart.filter.field)] ?? [] : []}
          onChange={(values) => onFilterChange(activeChart, values)}
        />
      </Box>
    </Box>
  );
};

const GenericPlaceholder: React.FC<{ label: string; canvasHeight: number }> = ({ label }) => (
  <Box sx={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(var(--app-accent-rgb), 0.05)' }}>
    <Typography variant="body2" color="text.disabled">{label}</Typography>
  </Box>
);

const GaugePreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const gaugeValueColor = bgTheme === 'light' ? '#1a1a2e' : '#f7f9fb';
  const gaugeTrackColor = bgTheme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  const gaugeNeedleColor = bgTheme === 'light' ? '#333333' : '#ffffff';
  const accent = chart.color || CHART_COLORS[0];
  const numValue = parseDisplayNumber(chart.value);
  // Determine min/max from series data if available, otherwise use 0–max heuristic
  const seriesValues = (chart.series ?? []).flatMap(s => s.values ?? []).filter(v => typeof v === 'number');
  const dataMax = seriesValues.length > 0 ? Math.max(...seriesValues) : 0;
  const gaugeMax = chart.progressMax && chart.progressMax > 0
    ? chart.progressMax
    : (dataMax > 0 ? dataMax : (numValue > 0 ? numValue * 1.5 : 100));
  const ratio = Math.min(1, Math.max(0, numValue / gaugeMax));

  // SVG semicircle gauge
  const cx = 110, cy = 100, r = 80;
  const startAngle = Math.PI; // left
  const zoneAngles = [
    { from: Math.PI, to: Math.PI * (2 / 3), color: '#ef4444' },
    { from: Math.PI * (2 / 3), to: Math.PI / 3, color: '#f59e0b' },
    { from: Math.PI / 3, to: 0, color: '#22c55e' },
  ];
  const polarToXY = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(Math.PI - angle),
    y: cy - radius * Math.sin(angle),
  });
  const arcPath = (from: number, to: number, radius: number) => {
    const p1 = polarToXY(from, radius);
    const p2 = polarToXY(to, radius);
    return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y}`;
  };
  const needleAngle = startAngle - ratio * Math.PI;
  const needleTip = polarToXY(needleAngle - Math.PI / 2 + Math.PI, r - 8);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
      <svg viewBox="0 0 220 110" style={{ width: '100%', flex: 1, minHeight: 0 }}>
        {/* background arc */}
        <path d={arcPath(Math.PI, 0, r)} fill="none" stroke={gaugeTrackColor} strokeWidth="18" strokeLinecap="butt" />
        {/* colored zones */}
        {zoneAngles.map((z, i) => (
          <path key={i} d={arcPath(z.from, z.to, r)} fill="none" stroke={z.color} strokeWidth="18" strokeLinecap="butt" opacity="0.85" />
        ))}
        {/* needle */}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke={gaugeNeedleColor} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={accent} />
      </svg>
      <Typography sx={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 800, color: gaugeValueColor, lineHeight: 1, mt: -1 }}>
        {chart.value || '—'}
      </Typography>
      {chart.subtitle && (
        <Typography sx={{ fontSize: '0.78rem', color: bgTheme === 'light' ? 'rgba(23,32,51,0.62)' : 'var(--app-subtle-text)' }}>{chart.subtitle}</Typography>
      )}
    </Box>
  );
};

const MAP_TILE_LAYOUT = [
  { x: 22, y: 24, width: 50, height: 22 },
  { x: 78, y: 18, width: 64, height: 28 },
  { x: 148, y: 26, width: 44, height: 22 },
  { x: 42, y: 54, width: 62, height: 30 },
  { x: 110, y: 58, width: 76, height: 34 },
  { x: 28, y: 94, width: 54, height: 24 },
  { x: 88, y: 98, width: 62, height: 26 },
  { x: 156, y: 92, width: 34, height: 20 },
];

const MapPreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const categories = chart.categories ?? [];
  const primarySeries = chart.series?.[0];
  const accent = primarySeries?.color || chart.color || CHART_COLORS[0];
  const labelColor = bgTheme === 'light' ? '#1a1a2e' : '#f7f9fb';
  const mutedColor = bgTheme === 'light' ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.58)';

  if (!primarySeries || categories.length === 0) {
    return null;
  }

  const values = categories.map((_, index) => primarySeries.values[index] ?? 0);
  const maxValue = Math.max(...values, 1);

  return (
    <Box sx={{ height: '100%', display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
      <Box sx={{ flex: '0 0 58%', minWidth: 150 }}>
        <svg viewBox="0 0 220 150" style={{ width: '100%', height: '100%', display: 'block' }}>
          <rect
            x="8"
            y="12"
            width="204"
            height="126"
            rx="18"
            fill={bgTheme === 'light' ? 'rgba(20,24,31,0.03)' : 'rgba(255,255,255,0.03)'}
            stroke={bgTheme === 'light' ? 'rgba(20,24,31,0.08)' : 'rgba(255,255,255,0.08)'}
          />
          {categories.map((category, index) => {
            const tile = MAP_TILE_LAYOUT[index % MAP_TILE_LAYOUT.length];
            const band = Math.floor(index / MAP_TILE_LAYOUT.length);
            const value = values[index] ?? 0;
            const ratio = value > 0 ? value / maxValue : 0.08;
            const x = tile.x + (band % 2) * 6;
            const y = tile.y + band * 34;
            return (
              <g key={category}>
                <rect
                  x={x}
                  y={y}
                  width={tile.width}
                  height={tile.height}
                  rx="8"
                  fill={accent}
                  opacity={0.22 + ratio * 0.66}
                  stroke={bgTheme === 'light' ? 'rgba(20,24,31,0.08)' : 'rgba(255,255,255,0.12)'}
                />
                <text x={x + 6} y={y + 11} fill={labelColor} fontSize="7.2" fontWeight="700">
                  {category.length > 12 ? `${category.slice(0, 12)}…` : category}
                </text>
                <text x={x + 6} y={y + tile.height - 5} fill={mutedColor} fontSize="6.6">
                  {formatSegmentValue(value)}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.75, minWidth: 0 }}>
        {categories.slice(0, 5).map((category, index) => (
          <LegendRow
            key={category}
            color={accent}
            label={category}
            value={formatSegmentValue(values[index] ?? 0)}
            fontScale={0.96}
          />
        ))}
        {categories.length > 5 && (
          <Typography sx={{ fontSize: '0.72rem', color: mutedColor, mt: 0.25 }}>
            +{categories.length - 5} регионов
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const CandlestickPreview: React.FC<{ chart: ChartItem; canvasHeight: number }> = ({ chart, canvasHeight }) => {
  const bgTheme = React.useContext(DashboardThemeContext);
  const { categories = [], series = [] } = chart;

  const openS  = series.find(s => s.name.toLowerCase() === 'open')  ?? series[0];
  const closeS = series.find(s => s.name.toLowerCase() === 'close') ?? series[1] ?? openS;
  const highS  = series.find(s => s.name.toLowerCase() === 'high')  ?? series[2] ?? openS;
  const lowS   = series.find(s => s.name.toLowerCase() === 'low')   ?? series[3] ?? openS;

  const opens  = openS?.values  ?? [];
  const closes = closeS?.values ?? opens;
  const highs  = highS?.values  ?? opens;
  const lows   = lowS?.values   ?? opens;
  const n = Math.max(opens.length, 1);

  const allVals = [...opens, ...closes, ...highs, ...lows].filter(Number.isFinite);
  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 1;
  const range = maxVal - minVal || 1;

  const svgH = canvasHeight - 32;
  const svgW = 500;
  const padL = 8; const padR = 8; const padT = 8; const padB = 20;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const toY = (v: number) => padT + plotH - ((v - minVal) / range) * plotH;
  const candleW = Math.max(4, Math.min(14, plotW / n - 4));
  const step = plotW / n;

  const upColor   = '#26a69a';
  const downColor = '#ef5350';
  const wickColor = bgTheme === 'light' ? '#555' : '#aaa';
  const labelColor = bgTheme === 'light' ? '#555' : '#aaa';

  const visibleTicks = Math.min(n, 6);
  const tickStep = Math.max(1, Math.floor(n / visibleTicks));

  return (
    <Box sx={{ width: '100%', height: canvasHeight, display: 'flex', flexDirection: 'column' }}>
      <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
        {Array.from({ length: n }, (_, i) => {
          const cx = padL + i * step + step / 2;
          const o = opens[i]  ?? 0;
          const c = closes[i] ?? o;
          const h = highs[i]  ?? Math.max(o, c);
          const l = lows[i]   ?? Math.min(o, c);
          const isUp = c >= o;
          const bodyY1 = toY(Math.max(o, c));
          const bodyY2 = toY(Math.min(o, c));
          const bodyH = Math.max(1, bodyY2 - bodyY1);
          return (
            <g key={i}>
              <line x1={cx} y1={toY(h)} x2={cx} y2={toY(l)} stroke={wickColor} strokeWidth={1} />
              <rect
                x={cx - candleW / 2} y={bodyY1}
                width={candleW} height={bodyH}
                fill={isUp ? upColor : downColor}
                rx={1}
              />
            </g>
          );
        })}
        {Array.from({ length: n }, (_, i) => {
          if (i % tickStep !== 0) return null;
          const cx = padL + i * step + step / 2;
          const label = categories[i] ?? '';
          const short = label.length > 8 ? label.slice(-5) : label;
          return (
            <text key={i} x={cx} y={svgH - 4} textAnchor="middle" fontSize={9} fill={labelColor}>{short}</text>
          );
        })}
      </svg>
      <Box sx={{ display: 'flex', gap: 1.5, px: 1, flexWrap: 'wrap' }}>
        {[{ label: 'Рост', color: upColor }, { label: 'Падение', color: downColor }].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: '2px' }} />
            <Typography sx={{ fontSize: '0.68rem', color: labelColor }}>{label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export const ChartPreview: React.FC<{
  chart: ChartItem;
  activeFilter?: DashboardFilter;
  onFilterChange?: (chart: ChartItem, values: string[]) => void;
}> = ({ chart, activeFilter, onFilterChange }) => {
  const canvasHeight = getChartCanvasHeight(chart);
  const forceMockupHbar = isMockupChart(chart)
    && chart.series
    && chart.series.length > 1
    && chart.categories
    && chart.categories.length >= 2
    && Boolean(chart.stacked);

  if (forceMockupHbar && chart.type !== 'hbar') {
    return <HorizontalBarPreview chart={{ ...chart, type: 'hbar', stacked: true }} canvasHeight={canvasHeight} />;
  }

  switch (chart.type) {
    case 'kpi':
      return <KpiPreview chart={chart} canvasHeight={canvasHeight} />;
    case 'gauge':
      return <GaugePreview chart={chart} canvasHeight={canvasHeight} />;
    case 'bar':
      return <BarChartPreview chart={chart} canvasHeight={canvasHeight} />;
    case 'hbar':
      return <HorizontalBarPreview chart={chart} canvasHeight={canvasHeight} />;
    case 'line':
      return <LineChartPreview chart={chart} canvasHeight={canvasHeight} />;
    case 'pie':
      return <PieChartPreview chart={chart} canvasHeight={canvasHeight} />;
    case 'donut':
      return <PieChartPreview chart={chart} canvasHeight={canvasHeight} donut />;
    case 'candlestick':
      return <CandlestickPreview chart={chart} canvasHeight={canvasHeight} />;
    case 'country_map':
      return <MapPreview chart={chart} canvasHeight={canvasHeight} />;
    case 'table':
      return <TablePreview chart={chart} canvasHeight={canvasHeight} />;
    case 'filter':
      return (
        <FilterPreview
          chart={chart}
          canvasHeight={canvasHeight}
          selectedValues={chart.filter ? activeFilter?.selections?.[getFilterKey(chart.filter.source, chart.filter.field)] ?? [] : []}
          onChange={(values) => onFilterChange?.(chart, values)}
        />
      );
    default:
      return <GenericPlaceholder label={`${chart.type.toUpperCase()} виджет`} canvasHeight={canvasHeight} />;
  }
};

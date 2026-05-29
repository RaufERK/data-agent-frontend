import {
  Box, Typography, Button, Paper, Grid, Chip, Stack,
  Divider, TextField, MenuItem,
} from '@mui/material';
import { getBuilderFieldOptions, type BuilderTemplateRanking } from './dashboardBuilder';
import { normalizeChartType } from './dashboardChartUtils';
import { PALETTE_TYPE_LABELS } from './dashboardChartUtils';
import type { WidgetBuilderState } from './useWidgetBuilder';

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

interface WidgetBuilderPanelProps {
  builder: WidgetBuilderState;
  onAdd: () => void;
}

export function WidgetBuilderPanel({ builder, onAdd }: WidgetBuilderPanelProps) {
  const {
    pendingWidgetType,
    pendingSourceId,
    pendingTemplateId,
    builderPrimaryField,
    builderSecondaryField,
    builderTableFields,
    availableSources,
    rankedTemplates,
    selectedSource,
    selectedTemplate,
    setPendingWidgetType,
    setPendingSourceId,
    setPendingTemplateId,
    setBuilderPrimaryField,
    setBuilderSecondaryField,
    setBuilderTableFields,
    close,
  } = builder;

  if (!pendingWidgetType) return null;

  const recommendedTemplates = rankedTemplates.filter(item => item.recommended);
  const secondaryTemplates = rankedTemplates.filter(item => !item.recommended);
  const fieldOptions = selectedSource ? getBuilderFieldOptions(selectedSource) : null;
  const selectedTemplateType = selectedTemplate ? normalizeChartType(selectedTemplate.actualType) : null;

  const fieldControls = (() => {
    if (!selectedSource || !fieldOptions || !selectedTemplateType) return [] as Array<{
      key: 'primary' | 'secondary';
      label: string;
      options: string[];
      helperText?: string;
    }>;

    if (selectedTemplateType === 'kpi') {
      return [{
        key: 'secondary' as const,
        label: 'Колонка метрики',
        options: fieldOptions.numeric.length > 0 ? fieldOptions.numeric : fieldOptions.any,
        helperText: 'Основной показатель для KPI-карточки.',
      }];
    }

    if (selectedTemplateType === 'line') {
      return [
        {
          key: 'primary' as const,
          label: 'Колонка времени',
          options: fieldOptions.date.length > 0 ? fieldOptions.date : fieldOptions.any,
          helperText: 'По этой колонке строится ось X.',
        },
        {
          key: 'secondary' as const,
          label: 'Колонка метрики',
          options: fieldOptions.numeric.length > 0 ? fieldOptions.numeric : fieldOptions.any,
          helperText: 'Числовое значение для линии.',
        },
      ];
    }

    if (
      selectedTemplateType === 'bar' || selectedTemplateType === 'hbar' ||
      selectedTemplateType === 'pie' || selectedTemplateType === 'donut'
    ) {
      return [
        {
          key: 'primary' as const,
          label: 'Категория',
          options: fieldOptions.category.length > 0 ? fieldOptions.category : fieldOptions.any,
          helperText: 'Группа или измерение, по которому строится виджет.',
        },
        {
          key: 'secondary' as const,
          label: 'Метрика',
          options: fieldOptions.numeric.length > 0 ? fieldOptions.numeric : fieldOptions.any,
          helperText: 'Числовой показатель для сравнения или долей.',
        },
      ];
    }

    if (selectedTemplateType === 'filter') {
      return [{
        key: 'primary' as const,
        label: 'Поле фильтра',
        options: [...fieldOptions.category, ...fieldOptions.date].length > 0
          ? [...fieldOptions.category, ...fieldOptions.date]
          : fieldOptions.any,
        helperText: 'По этому полю пользователь будет фильтровать дашборд.',
      }];
    }

    return [];
  })();

  const isTableTemplate = selectedTemplateType === 'table';
  const canAdd = Boolean(selectedSource && selectedTemplate)
    && fieldControls.every(c => (c.key === 'primary' ? builderPrimaryField : builderSecondaryField))
    && (!isTableTemplate || builderTableFields.length > 0);

  const renderTemplateGroup = (title: string, items: BuilderTemplateRanking[]) => {
    if (items.length === 0) return null;
    return (
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
          {title}
        </Typography>
        <Grid container spacing={1.25}>
          {items.map(({ template, score, recommended }) => (
            <Grid item xs={12} md={6} lg={4} key={template.id}>
              <Paper
                onClick={() => setPendingTemplateId(template.id)}
                sx={{
                  p: 1.4,
                  height: '100%',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.9,
                  bgcolor: pendingTemplateId === template.id ? 'rgba(255,255,255,0.08)' : 'rgba(var(--app-panel-rgb), 0.42)',
                  border: pendingTemplateId === template.id
                    ? `1px solid ${selectedSource?.accentColor ?? 'var(--app-accent)'}`
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {template.title}
                  </Typography>
                  <Chip
                    label={ACTUAL_TYPE_LABELS[normalizeChartType(template.actualType)] || template.actualType}
                    size="small"
                    sx={{ height: 20, fontSize: '0.62rem' }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)', flexGrow: 1 }}>
                  {template.summary}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={recommended ? 'Рекомендуется' : 'Побочный'}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.62rem',
                      bgcolor: recommended
                        ? `${selectedSource?.accentColor ?? 'var(--app-accent)'}22`
                        : 'rgba(255,255,255,0.05)',
                      color: recommended
                        ? selectedSource?.accentColor ?? 'var(--app-accent)'
                        : 'var(--app-subtle-text)',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)' }}>
                    score {score}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        bgcolor: 'rgba(var(--app-surface-alt-rgb), 0.82)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.4 }}>
            Добавление виджета: {PALETTE_TYPE_LABELS[pendingWidgetType]}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)' }}>
            Сначала выберите источник данных, затем тип виджета, рекомендованный пресет и нужные колонки.
          </Typography>
        </Box>
        <Button variant="text" size="small" onClick={close}>
          Закрыть
        </Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Chip label="1. Источник данных" color="info" size="small" />
        <Chip label={pendingSourceId ? '2. Вид виджета' : '2. Выберите источник'} size="small" />
        <Chip label={pendingSourceId && pendingWidgetType ? '3. Рекомендации и колонки' : '3. Настройка'} size="small" />
      </Stack>

      {availableSources.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)' }}>
          Нет доступных живых источников. Сначала загрузите таблицы в текущую сессию.
        </Typography>
      ) : (
        <Grid container spacing={1.25} sx={{ mb: pendingSourceId ? 2 : 0 }}>
          {availableSources.map(source => (
            <Grid item xs={12} md={6} lg={4} key={source.id}>
              <Paper
                onClick={() => setPendingSourceId(source.id)}
                sx={{
                  p: 1.4,
                  height: '100%',
                  cursor: 'pointer',
                  bgcolor: pendingSourceId === source.id ? 'rgba(255,255,255,0.08)' : 'rgba(var(--app-panel-rgb), 0.42)',
                  border: pendingSourceId === source.id
                    ? `1px solid ${source.accentColor}`
                    : '1px solid rgba(255,255,255,0.07)',
                  transition: 'border-color 0.15s ease, background-color 0.15s ease',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.35 }}>
                  {source.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)', mb: 0.9, minHeight: 40 }}>
                  {source.description}
                </Typography>
                <Chip
                  label={`${source.table} · ${source.rowCount.toLocaleString('ru-RU')} строк`}
                  size="small"
                  sx={{ height: 22, fontSize: '0.66rem', mb: 0.8, bgcolor: `${source.accentColor}22`, color: source.accentColor }}
                />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                  {source.fields.map(field => (
                    <Chip key={field} label={field} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.62rem' }} />
                  ))}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {pendingSourceId && (
        <Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.35 }}>
            Тип виджета и рекомендуемые пресеты для источника «{selectedSource?.title}»
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)', mb: 1.5 }}>
            Сначала выберите вид виджета, затем рекомендованный или побочный пресет и настройте колонки перед добавлением.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.75 }}>
            {selectedSource?.widgetTypes.map(widgetType => (
              <Chip
                key={widgetType}
                clickable
                color={pendingWidgetType === widgetType ? 'info' : 'default'}
                label={PALETTE_TYPE_LABELS[widgetType]}
                onClick={() => {
                  setPendingWidgetType(widgetType);
                  setPendingTemplateId(null);
                }}
              />
            ))}
          </Box>

          {rankedTemplates.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)' }}>
              Для этого источника пока нет пресетов выбранного типа.
            </Typography>
          ) : (
            <>
              {renderTemplateGroup('Рекомендуемые', recommendedTemplates)}
              {renderTemplateGroup('Побочные варианты', secondaryTemplates)}

              {selectedTemplate && (
                <Paper
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: 'rgba(var(--app-panel-rgb), 0.42)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.35 }}>
                    Настройка полей
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--app-subtle-text)', mb: 1.2 }}>
                    Пресет: {selectedTemplate.title}. Выберите колонки, по которым будет собран виджет из реальных preview-строк.
                  </Typography>

                  {fieldControls.length > 0 && (
                    <Grid container spacing={1.25} sx={{ mb: isTableTemplate ? 1.2 : 0.8 }}>
                      {fieldControls.map(control => {
                        const value = control.key === 'primary' ? builderPrimaryField : builderSecondaryField;
                        const setValue = control.key === 'primary' ? setBuilderPrimaryField : setBuilderSecondaryField;
                        return (
                          <Grid item xs={12} md={6} key={control.key}>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              label={control.label}
                              value={value}
                              helperText={control.helperText}
                              onChange={e => setValue(e.target.value)}
                            >
                              {control.options.map(option => (
                                <MenuItem key={option} value={option}>{option}</MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}

                  {isTableTemplate && selectedSource && (
                    <Box sx={{ mb: 1.4 }}>
                      <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', display: 'block', mb: 0.7 }}>
                        Колонки таблицы
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {selectedSource.fields.map(field => {
                          const active = builderTableFields.includes(field);
                          return (
                            <Chip
                              key={field}
                              clickable
                              color={active ? 'info' : 'default'}
                              label={field}
                              onClick={() => setBuilderTableFields(prev =>
                                prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
                              )}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)' }}>
                      Источник: {selectedSource?.table} · Поля: {selectedSource?.fields.join(', ')}
                    </Typography>
                    <Button variant="contained" size="small" disabled={!canAdd} onClick={onAdd}>
                      Добавить виджет
                    </Button>
                  </Box>
                </Paper>
              )}
            </>
          )}
        </Box>
      )}
    </Paper>
  );
}

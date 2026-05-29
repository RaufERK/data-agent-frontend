import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import type {
  DataFilterState,
  DataStory,
  DataStoryBreakdown,
  DataStoryInsight,
  DataStoryRequestRow,
  ProjectStatus,
  UploadedFile,
} from '../../types';

const WORKSPACE_ROW_HEIGHT = 42;
const WORKSPACE_VIEWPORT_HEIGHT = 520;
const WORKSPACE_OVERSCAN = 8;

type WorkspaceMode = 'analysis' | 'cleanup';
type BreakdownTab = 'periods' | 'departments' | 'accessTypes';
type AnalysisStatus = 'idle' | 'running' | 'ready';

const CLEANUP_INSIGHT_IDS = new Set([
  'duplicate_requests',
  'date_conflicts',
  'approval_gaps',
  'quality_cleanup',
]);

const SOURCE_FILE_META: Record<string, { title: string; role: string; join: string }> = {
  'crm_requests_export.xlsx': {
    title: 'CRM-выгрузка',
    role: 'Базовая таблица заявок: request_id, даты, стадия, тип доступа и организация.',
    join: 'Основа рабочего слоя. Каждая строка CRM становится заявкой в консолидации.',
  },
  'access_matrix.xlsx': {
    title: 'Матрица доступа',
    role: 'Правила доступа: критичность, срок и обязательность согласования СЭБ.',
    join: 'Присоединяется по полю "Тип доступа" и проверяет, где CRM противоречит правилам.',
  },
  'org_structure.xlsx': {
    title: 'Справочник подразделений',
    role: 'Канонические названия подразделений и владельцы блоков.',
    join: 'Нормализует варианты вроде "Деп-т" и "Сопровождение клиентов".',
  },
  'organizations_registry.xlsx': {
    title: 'Реестр организаций',
    role: 'Канонические организации, ИНН, категория и статус.',
    join: 'Проверяет существование организации и убирает расхождения в названиях.',
  },
};

const severityMeta: Record<DataStoryInsight['severity'], { color: string; bg: string; label: string }> = {
  critical: { color: '#ff6b6b', bg: 'rgba(255,107,107,0.10)', label: 'Критично' },
  warning: { color: '#f5c84c', bg: 'rgba(245,200,76,0.10)', label: 'Риск' },
  positive: { color: '#4cc38a', bg: 'rgba(76,195,138,0.10)', label: 'Готово' },
};

const periodLabel = (period: string) => {
  if (period === 'all') return 'Все периоды';
  return period;
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  caption?: string;
}> = ({ label, value, caption }) => (
  <Card variant="outlined" sx={{ minWidth: 0 }}>
    <CardContent sx={{ p: 2 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
        {value}
      </Typography>
      {caption && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.45 }}>
          {caption}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const BreakdownList: React.FC<{
  title: string;
  items: DataStoryBreakdown[];
}> = ({ title, items }) => {
  const maxValue = Math.max(...items.map(item => item.value), 1);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.2 }}>{title}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(item => (
          <Box key={item.key}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.label}</Typography>
              <Typography variant="caption" color="text.secondary">{item.formattedValue}</Typography>
            </Box>
            <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${Math.max((item.value / maxValue) * 100, 4)}%`,
                  height: '100%',
                  borderRadius: 999,
                  bgcolor: item.tone === 'critical'
                    ? '#ff6b6b'
                    : item.tone === 'positive'
                      ? '#4cc38a'
                      : '#21a19a',
                }}
              />
            </Box>
            {(item.secondaryValue || item.secondaryLabel) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                {item.secondaryLabel ? `${item.secondaryLabel}: ` : ''}{item.secondaryValue}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

interface DataWorkspaceProps {
  story: DataStory;
  files: UploadedFile[];
  mode: WorkspaceMode;
  analysisStatus: AnalysisStatus;
  filters: DataFilterState;
  filteredRows: DataStoryRequestRow[];
  highlightedRowIds: Set<string>;
  selectedInsight: DataStoryInsight | null;
  projectStatus: ProjectStatus;
  cleaningProgress: number;
  onModeChange: (mode: WorkspaceMode) => void;
  onFilterChange: (patch: Partial<DataFilterState>) => void;
  onResetFilters: () => void;
  onSelectInsight: (insight: DataStoryInsight) => void;
  onClearInsight: () => void;
  onScenarioAction: (action: string) => void;
  onAssistantAction: (action: string) => void;
  onOpenRequestRow: (row: DataStoryRequestRow) => void;
  tableScrollTop: number;
  onTableScroll: (top: number) => void;
}

const DataWorkspace: React.FC<DataWorkspaceProps> = ({
  story,
  files,
  mode,
  analysisStatus,
  filters,
  filteredRows,
  highlightedRowIds,
  selectedInsight,
  projectStatus,
  cleaningProgress,
  onModeChange,
  onFilterChange,
  onSelectInsight,
  onClearInsight,
  onScenarioAction,
  onAssistantAction,
  onOpenRequestRow,
  tableScrollTop,
  onTableScroll,
}) => {
  const [breakdownTab, setBreakdownTab] = React.useState<BreakdownTab>('periods');
  const [activeFileTabIdx, setActiveFileTabIdx] = React.useState(0);
  const sourceCards = React.useMemo(() => files.map(file => ({
    file,
    totalRows: file.sheets.reduce((sum, sheet) => sum + sheet.rows, 0),
    meta: SOURCE_FILE_META[file.name] ?? {
      title: 'Источник данных',
      role: 'Файл участвует в построении demo-сценария.',
      join: 'Используется в рабочем слое после загрузки.',
    },
  })), [files]);
  const selectedInsightIsCleanup = selectedInsight ? CLEANUP_INSIGHT_IDS.has(selectedInsight.id) : false;

  React.useEffect(() => {
    if (selectedInsightIsCleanup) {
      if (mode !== 'cleanup') onModeChange('cleanup');
      return;
    }
    if (selectedInsight && mode !== 'analysis') {
      onModeChange('analysis');
    }
  }, [mode, onModeChange, selectedInsight, selectedInsightIsCleanup]);

  React.useEffect(() => {
    if (filters.dirtyOnly && mode !== 'cleanup') {
      onModeChange('cleanup');
    }
  }, [filters.dirtyOnly, mode, onModeChange]);

  const visibleCapacity = Math.ceil(WORKSPACE_VIEWPORT_HEIGHT / WORKSPACE_ROW_HEIGHT) + WORKSPACE_OVERSCAN * 2;
  const visibleStart = Math.max(0, Math.floor(tableScrollTop / WORKSPACE_ROW_HEIGHT) - WORKSPACE_OVERSCAN);
  const visibleEnd = Math.min(filteredRows.length, visibleStart + visibleCapacity);
  const visibleRows = filteredRows.slice(visibleStart, visibleEnd);
  const topSpacer = visibleStart * WORKSPACE_ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (filteredRows.length - visibleEnd) * WORKSPACE_ROW_HEIGHT);

  const dirtyRows = story.rows.filter(row => (
    row.hasDirtyDepartment ||
    row.hasMissingOrganization ||
    row.hasDateConflict ||
    row.hasDuplicate ||
    row.hasApprovalMismatch
  ));
  const currentDirtyRows = filteredRows.filter(row => (
    row.hasDirtyDepartment ||
    row.hasMissingOrganization ||
    row.hasDateConflict ||
    row.hasDuplicate ||
    row.hasApprovalMismatch
  ));
  const cleanCoverageBefore = story.rows.length > 0 ? ((story.rows.length - dirtyRows.length) / story.rows.length) * 100 : 0;
  const isCleaning = projectStatus === 'cleaning';
  const isCleaned = projectStatus === 'cleaned';
  const analysisReady = analysisStatus === 'ready';
  const analysisRunning = analysisStatus === 'running';
  const selectedInsightMeta = selectedInsight ? severityMeta[selectedInsight.severity] : null;

  const headerCards = mode === 'cleanup'
    ? story.metrics.filter(metric => ['duplicates', 'date_conflicts', 'dirty_dimensions', 'ready_rate'].includes(metric.id))
    : story.metrics.filter(metric => ['dataset_size', 'crm_requests', 'dirty_dimensions', 'ready_rate'].includes(metric.id));

  const activeBreakdown = {
    periods: { title: 'Периоды', items: story.periods },
    departments: { title: 'Подразделения', items: story.departments },
    accessTypes: { title: 'Типы доступа', items: story.accessTypes },
  }[breakdownTab];

  const handleModeChange = (_event: React.SyntheticEvent, nextMode: WorkspaceMode) => {
    onModeChange(nextMode);
    if (nextMode === 'cleanup') {
      onFilterChange({ dirtyOnly: true });
      const cleanupInsight = story.insights.find(insight => insight.id === 'quality_cleanup');
      if (cleanupInsight && !selectedInsightIsCleanup) {
        onSelectInsight(cleanupInsight);
      }
      return;
    }
    onFilterChange({ dirtyOnly: false });
    if (selectedInsight?.id === 'quality_cleanup') {
      onClearInsight();
    }
  };

  return (
    <Box sx={{ mb: 3.5 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          {story.datasetLabel}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {files.length > 0
            ? `На входе ${files.length} ${files.length === 1 ? 'файл' : files.length < 5 ? 'файла' : 'файлов'}: ${files.map(f => f.name).join(', ')}. Система сравнивает строки, ищет дубликаты и противоречия между источниками.`
            : 'Загрузите файлы для анализа данных.'}
        </Typography>

        <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1 }}>
          {headerCards.map(metric => (
            <SummaryCard key={metric.id} label={metric.label} value={metric.value} caption={metric.caption} />
          ))}
        </Box>

        <Box sx={{ mt: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Как GenBI собирает рабочий слой
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {files.length > 1
              ? 'Рабочий слой объединяет все загруженные источники: первый файл берётся как основа, остальные используются для обогащения и сверки.'
              : 'Рабочий слой строится на основе загруженного файла.'}
          </Typography>
          <Box sx={{ mt: 1.2, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1 }}>
            {sourceCards.map(({ file, totalRows, meta }) => (
              <Card key={file.name} variant="outlined" sx={{ minWidth: 0 }}>
                <CardContent sx={{ p: 1.8 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {meta.title}
                  </Typography>
                  <Typography sx={{ mt: 0.4, fontWeight: 700, wordBreak: 'break-word' }}>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.55 }}>
                    {meta.role}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    {file.sheets.length} {file.sheets.length === 1 ? 'лист' : 'листа'} · {totalRows.toLocaleString('ru-RU')} строк
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.6, color: 'primary.main', lineHeight: 1.5 }}>
                    {meta.join}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Alert severity="info" sx={{ mt: 1.2 }}>
            Фильтры применяются к результату консолидации всех источников. Исходные файлы доступны в разделе просмотра данных.
          </Alert>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ mt: 1.5 }}>
        <Tabs value={mode} onChange={handleModeChange} sx={{ px: 1.5, pt: 0.5 }}>
          <Tab value="cleanup" icon={<CleaningServicesIcon />} iconPosition="start" label="Проблемы качества" />
          <Tab value="analysis" icon={<InsightsIcon />} iconPosition="start" label="Сводка по данным" />
        </Tabs>
      </Paper>

      <Paper variant="outlined" sx={{ mt: 1.5, p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1.2 }}>
          <TextField select size="small" label="Период" value={filters.period} onChange={event => onFilterChange({ period: event.target.value })}>
            {story.filterOptions.periods.map(period => (
              <MenuItem key={period} value={period}>{periodLabel(period)}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Подразделение" value={filters.department} onChange={event => onFilterChange({ department: event.target.value })}>
            {story.filterOptions.departments.map(item => (
              <MenuItem key={item} value={item}>{item === 'all' ? 'Все подразделения' : item}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Организация" value={filters.organization} onChange={event => onFilterChange({ organization: event.target.value })}>
            {story.filterOptions.organizations.map(item => (
              <MenuItem key={item} value={item}>{item === 'all' ? 'Все организации' : item}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Тип доступа" value={filters.accessType} onChange={event => onFilterChange({ accessType: event.target.value })}>
            {story.filterOptions.accessTypes.map(item => (
              <MenuItem key={item} value={item}>{item === 'all' ? 'Все типы' : item}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Стадия" value={filters.stage} onChange={event => onFilterChange({ stage: event.target.value })}>
            {story.filterOptions.stages.map(item => (
              <MenuItem key={item} value={item}>{item === 'all' ? 'Все стадии' : item}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Источник" value={filters.source} onChange={event => onFilterChange({ source: event.target.value })}>
            {story.filterOptions.sources.map(item => (
              <MenuItem key={item} value={item}>{item === 'all' ? 'Все источники' : item}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Поиск" value={filters.search} onChange={event => onFilterChange({ search: event.target.value })} />
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* ── File tabs (VS Code style) ── */}
        {files.length > 0 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0,
            borderBottom: '1px solid', borderColor: 'divider',
            mb: 0, overflowX: 'auto',
            '&::-webkit-scrollbar': { height: 4 },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 2 },
          }}>
            {files.map((file, idx) => (
              <Box
                key={file.name}
                onClick={() => setActiveFileTabIdx(idx)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.7,
                  px: 1.75, py: 0.9,
                  cursor: 'pointer',
                  borderRight: '1px solid', borderColor: 'divider',
                  borderBottom: activeFileTabIdx === idx ? '2px solid' : '2px solid transparent',
                  borderBottomColor: activeFileTabIdx === idx ? 'primary.main' : 'transparent',
                  bgcolor: activeFileTabIdx === idx ? 'action.selected' : 'transparent',
                  color: activeFileTabIdx === idx ? 'text.primary' : 'text.secondary',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                }}
              >
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: activeFileTabIdx === idx ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {file.name}
                </Typography>
                {file.sheets[0] && (
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', ml: 0.5 }}>
                    {file.sheets[0].rows.toLocaleString('ru-RU')} стр.
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}

        {activeFileTabIdx === 0 ? (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 1.2, mt: 1.2 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {mode === 'cleanup' ? 'Строки, требующие исправления' : 'Рабочий слой после консолидации'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {filteredRows.length.toLocaleString('ru-RU')} строк после фильтрации.
                  {highlightedRowIds.size > 0 ? ` Подсвечено ${highlightedRowIds.size.toLocaleString('ru-RU')} строк по выбранному сценарию.` : ''}
                </Typography>
              </Box>
              <Chip
                icon={mode === 'cleanup' ? <CleaningServicesIcon /> : <InsightsIcon />}
                label={mode === 'cleanup' ? 'Режим исправления' : 'Режим сводки'}
                variant="outlined"
              />
            </Box>

            <TableContainer
              component={Box}
              onScroll={event => onTableScroll(event.currentTarget.scrollTop)}
              sx={{ maxHeight: WORKSPACE_VIEWPORT_HEIGHT, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'auto' }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell>Создана</TableCell>
                    <TableCell>Выдана</TableCell>
                    <TableCell>Окончание</TableCell>
                    <TableCell>Подразделение</TableCell>
                    <TableCell>Организация</TableCell>
                    <TableCell>Тип доступа</TableCell>
                    <TableCell>Стадия</TableCell>
                    <TableCell>Источник</TableCell>
                    <TableCell>СЭБ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topSpacer > 0 && (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ p: 0, border: 0, height: topSpacer }} />
                    </TableRow>
                  )}

                  {visibleRows.map(row => {
                    const highlighted = highlightedRowIds.has(row.requestId);
                    const dirty = row.hasDirtyDepartment || row.hasMissingOrganization || row.hasDateConflict || row.hasDuplicate || row.hasApprovalMismatch;

                    return (
                      <TableRow
                        key={`${row.requestId}-${row.createdAt}-${row.title}`}
                        hover
                        onClick={() => onOpenRequestRow(row)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: highlighted
                            ? 'rgba(245,200,76,0.10)'
                            : dirty
                              ? 'rgba(255,107,107,0.05)'
                              : undefined,
                        }}
                      >
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: highlighted ? 700 : 500 }}>{row.requestId}</TableCell>
                        <TableCell sx={{ minWidth: 260 }}>{row.title}</TableCell>
                        <TableCell>{row.createdAt || '—'}</TableCell>
                        <TableCell>{row.issuedAt || '—'}</TableCell>
                        <TableCell sx={{ color: row.hasDateConflict ? 'warning.main' : undefined }}>{row.expiresAt || '—'}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">{row.department}</Typography>
                            {row.hasDirtyDepartment && (
                              <Typography variant="caption" sx={{ color: 'warning.main' }}>
                                raw: {row.departmentRaw}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: row.hasMissingOrganization ? 'warning.main' : undefined }}>{row.organization}</TableCell>
                        <TableCell>{row.accessType}</TableCell>
                        <TableCell>{row.stage}</TableCell>
                        <TableCell>{row.source}</TableCell>
                        <TableCell sx={{ color: row.hasApprovalMismatch ? 'warning.main' : undefined }}>{row.sebApproval || '—'}</TableCell>
                      </TableRow>
                    );
                  })}

                  {bottomSpacer > 0 && (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ p: 0, border: 0, height: bottomSpacer }} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : (() => {
          const activeFile = files[activeFileTabIdx];
          const sheet = activeFile?.sheets[0];
          const preview = sheet?.preview ?? [];
          const headers = preview[0] ?? [];
          const dataRows = preview.slice(1);
          return (
            <Box sx={{ mt: 1.2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {activeFile.name} · {sheet?.rows?.toLocaleString('ru-RU') ?? 0} строк · {sheet?.cols ?? 0} столбцов
                {preview.length > 1 && preview.length - 1 < (sheet?.rows ?? 0) && (
                  <Typography component="span" sx={{ ml: 1, fontSize: '0.75rem', color: 'warning.main' }}>
                    (показан предпросмотр {preview.length - 1} строк)
                  </Typography>
                )}
              </Typography>
              <TableContainer
                component={Box}
                sx={{ maxHeight: WORKSPACE_VIEWPORT_HEIGHT, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'auto' }}
              >
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {headers.map((h, ci) => (
                        <TableCell key={ci} sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.76rem' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dataRows.map((row, ri) => (
                      <TableRow key={ri} hover>
                        {row.map((cell, ci) => (
                          <TableCell key={ci} sx={{ fontSize: '0.76rem', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cell || <Typography component="span" sx={{ color: 'text.disabled', fontStyle: 'italic', fontSize: '0.72rem' }}>(пусто)</Typography>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          );
        })()}

        {mode === 'cleanup' && !isCleaned && currentDirtyRows.length > 0 && (
          <Box sx={{ mt: 1.2, display: 'flex', alignItems: 'center', gap: 0.8, color: 'warning.main' }}>
            <WarningAmberIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2">
              В текущем срезе {currentDirtyRows.length.toLocaleString('ru-RU')} строк требуют подтверждения или ручной правки.
            </Typography>
          </Box>
        )}
        {mode === 'cleanup' && isCleaned && (
          <Box sx={{ mt: 1.2, display: 'flex', alignItems: 'center', gap: 0.8, color: 'success.main' }}>
            <CleaningServicesIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2">
              Исправление завершено. Слой приведён к каноническому виду и готов к моделированию.
            </Typography>
          </Box>
        )}
      </Paper>

      {mode === 'cleanup' ? (
        <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.05fr 0.95fr' }, gap: 1.5 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Проблемы качества данных</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              На этом шаге мы не строим аналитику, а приводим данные из всех источников к единому канону.
            </Typography>

            {isCleaning && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
                  ИИ-ассистент применяет нормализацию названий, сверяет справочники и чинит очевидные конфликты.
                </Typography>
                <LinearProgress variant="determinate" value={cleaningProgress} />
              </Box>
            )}

            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1 }}>
              {story.insights.map(insight => {
                const meta = severityMeta[insight.severity];
                return (
                  <Card key={insight.id} variant="outlined" sx={{ borderColor: meta.color, bgcolor: meta.bg }}>
                    <CardContent sx={{ p: 2 }}>
                      <Chip label={meta.label} size="small" sx={{ mb: 1, bgcolor: meta.bg, color: meta.color, border: `1px solid ${meta.color}` }} />
                      <Typography sx={{ fontWeight: 700 }}>{insight.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.55 }}>
                        {insight.summary}
                      </Typography>
                      <Button sx={{ mt: 1.4 }} size="small" variant="contained" onClick={() => onScenarioAction(insight.id)}>
                        Открыть
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Что уже видно</Typography>
            {selectedInsight && selectedInsightMeta ? (
              <Box sx={{ mt: 1 }}>
                <Chip label={selectedInsightMeta.label} size="small" sx={{ bgcolor: selectedInsightMeta.bg, color: selectedInsightMeta.color, border: `1px solid ${selectedInsightMeta.color}` }} />
                <Typography sx={{ mt: 1.1, fontWeight: 700 }}>{selectedInsight.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, lineHeight: 1.6 }}>
                  {selectedInsight.summary}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: selectedInsightMeta.color, fontWeight: 700 }}>
                  {selectedInsight.impact}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1.2, fontWeight: 700 }}>Рекомендация</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45, lineHeight: 1.55 }}>
                  {selectedInsight.recommendation}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Выберите один из сценариев выше. Система покажет, какие строки конфликтуют, и предложит следующий шаг.
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1 }}>
              <SummaryCard label="Проблемные строки" value={dirtyRows.length.toLocaleString('ru-RU')} caption={`${cleanCoverageBefore.toFixed(1).replace('.', ',')}% строк уже готовы`} />
              <SummaryCard label="После фильтра" value={filteredRows.length.toLocaleString('ru-RU')} caption={`${highlightedRowIds.size.toLocaleString('ru-RU')} строк подсвечено`} />
            </Box>

            {!isCleaning && !isCleaned && (
              <Button sx={{ mt: 1.5 }} size="small" variant="contained" onClick={() => onAssistantAction('clean')}>
                Исправить данные
              </Button>
            )}
          </Paper>
        </Box>
      ) : (
        <>
          <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.05fr 0.95fr' }, gap: 1.5 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Сводка по рабочему слою</Typography>
              {analysisRunning ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minHeight: 140 }}>
                  <CircularProgress size={24} />
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>Сверяем источники</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.6 }}>
                      GenBI сопоставляет загруженные источники и ищет противоречия между ними.
                    </Typography>
                  </Box>
                </Box>
              ) : analysisReady ? (
                <Box sx={{ display: 'grid', gap: 1.2 }}>
                  {story.insights.filter(insight => insight.id !== 'quality_cleanup').map(insight => {
                    const meta = severityMeta[insight.severity];
                    return (
                      <Card key={insight.id} variant="outlined" sx={{ borderColor: meta.color, bgcolor: meta.bg }}>
                        <CardContent sx={{ p: 2 }}>
                          <Chip label={meta.label} size="small" sx={{ mb: 1, bgcolor: meta.bg, color: meta.color, border: `1px solid ${meta.color}` }} />
                          <Typography sx={{ fontWeight: 700 }}>{insight.title}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8, lineHeight: 1.55 }}>
                            {insight.summary}
                          </Typography>
                          <Button sx={{ mt: 1.4 }} size="small" variant="contained" onClick={() => onScenarioAction(insight.id)}>
                            Открыть сценарий
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    Запустите сверку, и GenBI покажет основные конфликты между CRM и Excel-источниками.
                  </Typography>
                  <Button sx={{ mt: 1.5 }} size="small" variant="contained" onClick={() => onAssistantAction('analyze')}>
                    Запустить сверку
                  </Button>
                </Box>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Следующий шаг</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                После сверки и очистки GenBI предложит модель данных, соберёт детальный слой и покажет ERD по фактическим связям.
              </Typography>
              <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1 }}>
                <SummaryCard label="Подразделения" value={story.departments.length.toLocaleString('ru-RU')} caption="Канонические сущности" />
                <SummaryCard label="Организации" value={story.organizations.length.toLocaleString('ru-RU')} caption="После сверки справочника" />
                <SummaryCard label="Типы доступа" value={story.accessTypes.length.toLocaleString('ru-RU')} caption="Готовы к модели" />
              </Box>
            </Paper>
          </Box>

          <Paper variant="outlined" sx={{ mt: 1.5 }}>
            <Tabs value={breakdownTab} onChange={(_, value: BreakdownTab) => setBreakdownTab(value)} sx={{ px: 1.5, pt: 0.5 }}>
              <Tab value="periods" label="Периоды" />
              <Tab value="departments" label="Подразделения" />
              <Tab value="accessTypes" label="Типы доступа" />
            </Tabs>
            <Box sx={{ p: 2 }}>
              <BreakdownList title={activeBreakdown.title} items={activeBreakdown.items} />
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default DataWorkspace;

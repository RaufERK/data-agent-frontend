import type {
  DetailColumn,
  DetailTable,
  MockChart,
  MockChartSeries,
  MockChartSlice,
  UploadedFile,
} from '../types';
import { buildDataStory } from './dataStory';

const COLORS = {
  accent: 'var(--app-accent)',
  violet: 'var(--app-violet)',
  info: 'var(--app-info)',
  warning: 'var(--app-warning)',
  success: '#4cc38a',
  muted: 'rgba(255,255,255,0.22)',
};

const findSheet = (files: UploadedFile[], fileName: string, sheetName?: string) => {
  const file = files.find(item => item.name === fileName);
  if (!file) return null;
  if (!sheetName) return file.sheets[0] ?? null;
  return file.sheets.find(sheet => sheet.name === sheetName) ?? null;
};

const inferType = (header: string, values: string[]): string => {
  const lower = header.toLowerCase();
  if (lower.includes('дата')) return 'DATE';
  if (lower.includes('id')) return 'VARCHAR(64)';
  if (lower.includes('срок') || lower.includes('дней')) return 'INT';
  return values.every(value => value && /^\d+$/.test(value)) ? 'INT' : 'VARCHAR(255)';
};

const toColumns = (headers: string[], rows: string[][], foreignKeys: string[] = []): DetailColumn[] => (
  headers.map((header, index) => ({
    name: header.replace(/[().%]/g, '').replace(/\s+/g, '_').toLowerCase(),
    dataType: inferType(header, rows.map(row => row[index] ?? '')),
    isPK: index === 0 && /id/i.test(header),
    isFK: foreignKeys.includes(header),
    nullable: rows.some(row => !(row[index] ?? '').trim()),
  }))
);

const uniqueCount = (values: string[]) => new Set(values.filter(Boolean)).size;

const makeSeries = (name: string, values: number[], color: string): MockChartSeries => ({
  name,
  values,
  color,
  valueLabels: values.map(value => value.toLocaleString('ru-RU')),
});

const makeSlices = (items: Array<{ label: string; value: number; color: string }>): MockChartSlice[] => {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  return items.map(item => ({
    ...item,
    displayValue: `${Math.round((item.value / total) * 100)}%`,
  }));
};

const GENERIC_CATEGORY_CANDIDATES = [
  'Категория',
  'Тип доступа',
  'Контур',
  'Система',
  'Критичность',
  'Статус правила',
  'Бизнес-роль',
];

const normalizeCell = (value: string | undefined) => (value ?? '').trim();

const buildGenericDashboardCharts = (files: UploadedFile[]): MockChart[] => {
  const firstFile = files[0];
  const firstSheet = firstFile?.sheets[0];
  const preview = firstSheet?.preview ?? [];
  const [headers, ...rows] = preview;

  if (!firstSheet || !headers || headers.length === 0) {
    return [];
  }

  const normalizedRows = rows.filter(row => row.some(cell => normalizeCell(cell) !== ''));
  const totalRows = firstSheet.rows || normalizedRows.length;

  const valueCounts = (header: string) => {
    const index = headers.indexOf(header);
    if (index < 0) return [];
    const counts = new Map<string, number>();
    normalizedRows.forEach(row => {
      const value = normalizeCell(row[index]) || 'Не указано';
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };

  const preferredColumns = GENERIC_CATEGORY_CANDIDATES.filter(header => headers.includes(header));
  const fallbackColumns = headers.filter(header => {
    const counts = valueCounts(header);
    return counts.length >= 2 && counts.length <= Math.min(12, Math.max(2, normalizedRows.length));
  });
  const selectedColumns = [...preferredColumns, ...fallbackColumns.filter(header => !preferredColumns.includes(header))].slice(0, 3);

  const charts: MockChart[] = [
    {
      sourceId: `${firstSheet.name}_rows_total`,
      sourceLabel: firstFile.name,
      paletteType: 'kpi',
      title: 'Всего строк',
      type: 'kpi',
      description: `Количество строк в ${firstFile.name}`,
      metrics: ['row_count'],
      subtitle: firstSheet.name,
      value: totalRows.toLocaleString('ru-RU'),
      trend: `${headers.length} колонок`,
      color: COLORS.accent,
      sparkline: normalizedRows.slice(0, 12).map((_, index) => index + 1),
    },
  ];

  if (headers.includes('Тип доступа')) {
    charts.push({
      sourceId: `${firstSheet.name}_access_types_total`,
      sourceLabel: firstFile.name,
      paletteType: 'kpi',
      title: 'Типы доступа',
      type: 'kpi',
      description: 'Количество уникальных типов доступа',
      metrics: ['access_type'],
      subtitle: firstSheet.name,
      value: valueCounts('Тип доступа').length.toLocaleString('ru-RU'),
      trend: 'Уникальные значения',
      color: COLORS.violet,
      sparkline: valueCounts('Тип доступа').slice(0, 8).map(item => item.value),
    });
  }

  selectedColumns.forEach((header, index) => {
    const counts = valueCounts(header).slice(0, 8);
    if (counts.length === 0) return;

    charts.push({
      sourceId: `${firstSheet.name}_${index}_${header}`,
      sourceLabel: firstFile.name,
      paletteType: 'chart',
      title: `${header}: распределение`,
      type: index === 1 ? 'pie' : 'bar',
      description: `Распределение строк по колонке «${header}»`,
      metrics: [header, 'count'],
      xAxisLabel: header,
      yAxisLabel: 'Количество строк',
      categories: counts.map(item => item.label),
      series: [makeSeries('Строки', counts.map(item => item.value), [COLORS.accent, COLORS.info, COLORS.warning][index % 3])],
      slices: index === 1 ? makeSlices(
        counts.map((item, sliceIndex) => ({
          label: item.label,
          value: item.value,
          color: [COLORS.accent, COLORS.violet, COLORS.info, COLORS.warning, COLORS.success, COLORS.muted][sliceIndex % 6],
        })),
      ) : undefined,
    });
  });

  if (charts.length === 1) {
    charts.push({
      sourceId: `${firstSheet.name}_columns`,
      sourceLabel: firstFile.name,
      paletteType: 'table',
      title: 'Колонки источника',
      type: 'table',
      description: 'Структура загруженного источника',
      metrics: ['column_name'],
      table: {
        columns: ['Колонка'],
        rows: headers.slice(0, 12).map(header => [header]),
      },
    });
  }

  return charts;
};

export const generateDetailTables = (files: UploadedFile[], modelId: string): DetailTable[] => {
  if (modelId === 'no_model') {
    return [];
  }

  const requestsSheet = findSheet(files, 'crm_requests_export.xlsx', 'Запросы CRM');
  const departmentsSheet = findSheet(files, 'org_structure.xlsx', 'Подразделения');
  const organizationsSheet = findSheet(files, 'organizations_registry.xlsx', 'Организации');
  const accessMatrixSheet = findSheet(files, 'access_matrix.xlsx', 'Матрица доступа');

  if (!requestsSheet) return [];

  const [requestHeaders, ...requestRows] = requestsSheet.preview;
  const [departmentHeaders, ...departmentRows] = departmentsSheet?.preview ?? [[]];
  const [organizationHeaders, ...organizationRows] = organizationsSheet?.preview ?? [[]];
  const [accessHeaders, ...accessRows] = accessMatrixSheet?.preview ?? [[]];

  const departmentIndex = requestHeaders.indexOf('Подразделение');
  const organizationIndex = requestHeaders.indexOf('Организация');
  const stageIndex = requestHeaders.indexOf('Стадия');
  const createdAtIndex = requestHeaders.indexOf('Дата создания');

  const uniqueDepartments = uniqueCount(requestRows.map(row => row[departmentIndex] ?? ''));
  const uniqueOrganizations = uniqueCount(requestRows.map(row => row[organizationIndex] ?? ''));
  const uniqueStages = uniqueCount(requestRows.map(row => row[stageIndex] ?? ''));
  const uniquePeriods = uniqueCount(requestRows.map(row => (row[createdAtIndex] ?? '').slice(0, 7)));

  if (modelId === 'datavault') {
    return [
      {
        name: 'hub_request',
        type: 'transaction',
        columns: [
          { name: 'request_hk', dataType: 'HASH', isPK: true, isFK: false, nullable: false },
          { name: 'request_bk', dataType: 'VARCHAR(64)', isPK: false, isFK: false, nullable: false },
          { name: 'load_dts', dataType: 'DATETIME', isPK: false, isFK: false, nullable: false },
          { name: 'rec_src', dataType: 'VARCHAR(100)', isPK: false, isFK: false, nullable: false },
        ],
        rowCount: requestRows.length,
        source: 'crm_requests_export.xlsx → Запросы CRM',
      },
      {
        name: 'hub_department',
        type: 'reference',
        columns: [
          { name: 'department_hk', dataType: 'HASH', isPK: true, isFK: false, nullable: false },
          { name: 'department_bk', dataType: 'VARCHAR(255)', isPK: false, isFK: false, nullable: false },
        ],
        rowCount: uniqueDepartments,
        source: 'org_structure.xlsx → Подразделения',
      },
      {
        name: 'hub_organization',
        type: 'reference',
        columns: [
          { name: 'organization_hk', dataType: 'HASH', isPK: true, isFK: false, nullable: false },
          { name: 'organization_bk', dataType: 'VARCHAR(255)', isPK: false, isFK: false, nullable: false },
        ],
        rowCount: uniqueOrganizations,
        source: 'organizations_registry.xlsx → Организации',
      },
      {
        name: 'link_request_context',
        type: 'transaction',
        columns: [
          { name: 'request_context_hk', dataType: 'HASH', isPK: true, isFK: false, nullable: false },
          { name: 'request_hk', dataType: 'HASH', isPK: false, isFK: true, nullable: false },
          { name: 'department_hk', dataType: 'HASH', isPK: false, isFK: true, nullable: false },
          { name: 'organization_hk', dataType: 'HASH', isPK: false, isFK: true, nullable: true },
        ],
        rowCount: requestRows.length,
        source: 'crm_requests_export.xlsx → Запросы CRM',
      },
      {
        name: 'sat_request_state',
        type: 'aggregate',
        columns: [
          { name: 'request_context_hk', dataType: 'HASH', isPK: true, isFK: true, nullable: false },
          { name: 'created_at', dataType: 'DATE', isPK: false, isFK: false, nullable: false },
          { name: 'issued_at', dataType: 'DATE', isPK: false, isFK: false, nullable: true },
          { name: 'expires_at', dataType: 'DATE', isPK: false, isFK: false, nullable: true },
          { name: 'stage', dataType: 'VARCHAR(64)', isPK: false, isFK: false, nullable: false },
          { name: 'seb_approval', dataType: 'VARCHAR(64)', isPK: false, isFK: false, nullable: true },
        ],
        rowCount: requestRows.length,
        source: 'crm_requests_export.xlsx → Запросы CRM',
      },
      {
        name: 'sat_access_rule',
        type: 'reference',
        columns: toColumns(accessHeaders, accessRows),
        rowCount: accessRows.length,
        source: 'access_matrix.xlsx → Матрица доступа',
      },
    ];
  }

  if (modelId === 'snowflake') {
    return [
      {
        name: 'fact_access_requests',
        type: 'transaction',
        columns: toColumns(requestHeaders, requestRows, ['Подразделение', 'Организация', 'Тип доступа', 'Стадия']),
        rowCount: requestRows.length,
        source: 'crm_requests_export.xlsx → Запросы CRM',
      },
      {
        name: 'dim_department',
        type: 'reference',
        columns: toColumns(departmentHeaders, departmentRows, ['Блок']),
        rowCount: departmentRows.length,
        source: 'org_structure.xlsx → Подразделения',
      },
      {
        name: 'dim_organization',
        type: 'reference',
        columns: toColumns(organizationHeaders, organizationRows, ['Категория']),
        rowCount: organizationRows.length,
        source: 'organizations_registry.xlsx → Организации',
      },
      {
        name: 'dim_access_type',
        type: 'reference',
        columns: toColumns(accessHeaders, accessRows, ['Категория']),
        rowCount: accessRows.length,
        source: 'access_matrix.xlsx → Матрица доступа',
      },
      {
        name: 'dim_stage',
        type: 'reference',
        columns: [
          { name: 'stage_id', dataType: 'VARCHAR(64)', isPK: true, isFK: false, nullable: false },
          { name: 'stage_name', dataType: 'VARCHAR(255)', isPK: false, isFK: false, nullable: false },
        ],
        rowCount: uniqueStages,
        source: 'crm_requests_export.xlsx → Запросы CRM',
      },
      {
        name: 'dim_period',
        type: 'reference',
        columns: [
          { name: 'period_id', dataType: 'VARCHAR(7)', isPK: true, isFK: false, nullable: false },
          { name: 'year', dataType: 'INT', isPK: false, isFK: false, nullable: false },
          { name: 'month_num', dataType: 'INT', isPK: false, isFK: false, nullable: false },
        ],
        rowCount: uniquePeriods,
        source: 'crm_requests_export.xlsx → Запросы CRM',
      },
    ];
  }

  return [
    {
      name: 'fact_access_requests',
      type: 'transaction',
      columns: toColumns(requestHeaders, requestRows, ['Подразделение', 'Организация', 'Тип доступа', 'Стадия']),
      rowCount: requestRows.length,
      source: 'crm_requests_export.xlsx → Запросы CRM',
    },
    {
      name: 'dim_department',
      type: 'reference',
      columns: toColumns(departmentHeaders, departmentRows),
      rowCount: departmentRows.length,
      source: 'org_structure.xlsx → Подразделения',
    },
    {
      name: 'dim_organization',
      type: 'reference',
      columns: toColumns(organizationHeaders, organizationRows),
      rowCount: organizationRows.length,
      source: 'organizations_registry.xlsx → Организации',
    },
    {
      name: 'dim_access_type',
      type: 'reference',
      columns: toColumns(accessHeaders, accessRows),
      rowCount: accessRows.length,
      source: 'access_matrix.xlsx → Матрица доступа',
    },
    {
      name: 'dim_stage',
      type: 'reference',
      columns: [
        { name: 'stage_id', dataType: 'VARCHAR(64)', isPK: true, isFK: false, nullable: false },
        { name: 'stage_name', dataType: 'VARCHAR(255)', isPK: false, isFK: false, nullable: false },
      ],
      rowCount: uniqueStages,
      source: 'crm_requests_export.xlsx → Запросы CRM',
    },
  ];
};

export const generateImageDashboardCharts = (): MockChart[] => {
  return [
    {
      sourceId: 'image_total_revenue',
      sourceLabel: 'mockup',
      paletteType: 'kpi',
      title: 'Общая выручка',
      type: 'kpi',
      description: 'Суммарная выручка по sales amount',
      metrics: ['sales_amount'],
      subtitle: 'sales amount',
      value: '124,8 млн ₽',
      trend: '+8,4% к прошлому месяцу',
      colSpan: 3,
      rowSpan: 2,
      color: COLORS.accent,
      sparkline: [68, 74, 79, 84, 89, 96],
    },
    {
      sourceId: 'image_total_deals',
      sourceLabel: 'mockup',
      paletteType: 'kpi',
      title: 'Количество сделок',
      type: 'kpi',
      description: 'Количество записей sales id',
      metrics: ['sales_id'],
      subtitle: 'sales id',
      value: '15 420',
      trend: '1 980 закрыто в этом месяце',
      colSpan: 3,
      rowSpan: 2,
      color: COLORS.violet,
      sparkline: [420, 560, 640, 690, 720, 880],
    },
    {
      sourceId: 'image_avg_check',
      sourceLabel: 'mockup',
      paletteType: 'kpi',
      title: 'Средний чек',
      type: 'kpi',
      description: 'Средняя сумма amount / deals',
      metrics: ['amount', 'deals'],
      subtitle: 'amount / deals',
      value: '8 093 ₽',
      trend: '+3,1% к прошлому месяцу',
      colSpan: 3,
      rowSpan: 2,
      color: COLORS.info,
      sparkline: [7.2, 7.8, 8.1, 7.9, 8.2, 8.5],
    },
    {
      sourceId: 'image_closed_share',
      sourceLabel: 'mockup',
      paletteType: 'kpi',
      title: 'Доля закрытых сделок',
      type: 'kpi',
      description: 'Доля статуса Закрыта',
      metrics: ['status'],
      subtitle: 'status = Закрыта',
      value: '74,2%',
      trend: 'Выше цели на 4,2 п.п.',
      colSpan: 3,
      rowSpan: 2,
      color: COLORS.warning,
      sparkline: [61, 64, 66, 69, 72, 74],
    },
    {
      sourceId: 'image_revenue_by_region',
      sourceLabel: 'mockup',
      paletteType: 'chart',
      title: 'Выручка по регионам',
      type: 'bar',
      description: 'Выручка, млн руб по регионам',
      metrics: ['region', 'amount'],
      xAxisLabel: 'Регионы',
      yAxisLabel: 'Выручка, млн руб',
      colSpan: 6,
      rowSpan: 3,
      categories: ['Москва', 'Санкт-Петербург', 'Сев. Кавказ', 'Дальний Восток'],
      series: [
        makeSeries('Выручка, млн ₽', [22, 17, 14, 11], COLORS.accent),
      ],
    },
    {
      sourceId: 'image_products_status',
      sourceLabel: 'mockup',
      paletteType: 'chart',
      title: 'Сделки по продуктам и статусам',
      type: 'bar',
      description: 'Количество сделок по продуктам и статусам',
      metrics: ['product', 'status', 'count'],
      xAxisLabel: 'Продукты',
      yAxisLabel: 'Количество сделок',
      colSpan: 6,
      rowSpan: 3,
      categories: ['Ипотека', 'Кредит', 'Вклад'],
      series: [
        {
          name: 'Закрыта',
          values: [5200, 5100, 5600],
          valueLabels: ['5 200', '5 100', '5 600'],
          color: COLORS.accent,
        },
        {
          name: 'В работе',
          values: [1200, 1800, 3900],
          valueLabels: ['1 200', '1 800', '3 900'],
          color: COLORS.violet,
        },
        {
          name: 'На согласовании',
          values: [900, 1100, 2200],
          valueLabels: ['900', '1 100', '2 200'],
          color: COLORS.warning,
        },
      ],
    },
    {
      sourceId: 'image_revenue_trend',
      sourceLabel: 'mockup',
      paletteType: 'chart',
      title: 'Динамика выручки по месяцам',
      type: 'line',
      description: 'Помесячная динамика двух метрик выручки',
      metrics: ['month', 'amount'],
      xAxisLabel: 'Месяц',
      yAxisLabel: 'Выручка',
      colSpan: 8,
      rowSpan: 4,
      categories: ['янв', 'фев', 'мар', 'апр', 'май'],
      series: [
        {
          name: 'Выручка',
          values: [58, 74, 76, 82, 95],
          valueLabels: ['58', '74', '76', '82', '95'],
          color: COLORS.accent,
        },
        {
          name: 'Маржа',
          values: [18, 21, 36, 39, 47],
          valueLabels: ['18', '21', '36', '39', '47'],
          color: COLORS.violet,
        },
      ],
    },
    {
      sourceId: 'image_status_donut',
      sourceLabel: 'mockup',
      paletteType: 'chart',
      title: 'Статусы сделок',
      type: 'donut',
      description: 'Распределение сделок по статусам',
      metrics: ['status', 'count'],
      subtitle: 'Статусы|сделок',
      colSpan: 4,
      rowSpan: 4,
      slices: [
        { label: 'Закрыта', value: 1980, displayValue: '1 980', color: COLORS.accent },
        { label: 'В работе', value: 3120, displayValue: '3 120', color: COLORS.violet },
        { label: 'На согласовании', value: 1320, displayValue: '1 320', color: COLORS.warning },
      ],
    },
  ];
};

export const generateDashboardCharts = (files: UploadedFile[]): MockChart[] => {
  const story = buildDataStory(files);
  if (files.length === 0) return [];
  if (story.rows.length === 0) {
    return buildGenericDashboardCharts(files);
  }

  const topDepartments = story.departments.slice(0, 6);
  const topAccessTypes = story.accessTypes.slice(0, 6);
  const topOrganizations = story.organizations.slice(0, 6);

  return [
    {
      sourceId: 'requests_total',
      sourceLabel: 'crm_requests_export.xlsx',
      paletteType: 'kpi',
      title: 'Всего заявок',
      type: 'kpi',
      description: 'Количество заявок в объединённом массиве',
      metrics: ['request_id'],
      subtitle: 'CRM + Excel',
      value: story.metrics.find(metric => metric.id === 'crm_requests')?.value ?? '—',
      trend: story.metrics.find(metric => metric.id === 'dataset_size')?.caption ?? '',
      color: COLORS.accent,
      sparkline: story.periods.map(item => item.value),
    },
    {
      sourceId: 'dirty_rows',
      sourceLabel: 'quality checks',
      paletteType: 'kpi',
      title: 'Проблемные строки',
      type: 'kpi',
      description: 'Строки, требующие очистки перед моделированием',
      metrics: ['quality_issues'],
      subtitle: 'Качество данных',
      value: story.metrics.find(metric => metric.id === 'dirty_dimensions')?.value ?? '—',
      trend: story.metrics.find(metric => metric.id === 'ready_rate')?.value ?? '',
      color: COLORS.warning,
      sparkline: story.periods.map(item => Number(item.secondaryValue ?? '0')),
    },
    {
      sourceId: 'requests_by_department',
      sourceLabel: 'department',
      paletteType: 'chart',
      title: 'Заявки по подразделениям',
      type: 'bar',
      description: 'Распределение заявок по подразделениям',
      metrics: ['department', 'request_count'],
      xAxisLabel: 'Подразделения',
      yAxisLabel: 'Количество заявок',
      categories: topDepartments.map(item => item.label),
      series: [makeSeries('Заявки', topDepartments.map(item => item.value), COLORS.accent)],
    },
    {
      sourceId: 'requests_by_period',
      sourceLabel: 'created_at',
      paletteType: 'chart',
      title: 'Поступление заявок по месяцам',
      type: 'line',
      description: 'Динамика загрузки запросов из CRM и Excel',
      metrics: ['period', 'request_count'],
      xAxisLabel: 'Месяцы',
      yAxisLabel: 'Количество',
      categories: story.periods.map(item => item.label.toLowerCase()),
      series: [makeSeries('Заявки', story.periods.map(item => item.value), COLORS.info)],
    },
    {
      sourceId: 'requests_by_access_type',
      sourceLabel: 'access_type',
      paletteType: 'chart',
      title: 'Типы доступа',
      type: 'bar',
      description: 'Чаще всего запрашиваемые доступы',
      metrics: ['access_type', 'request_count'],
      xAxisLabel: 'Тип доступа',
      yAxisLabel: 'Количество',
      categories: topAccessTypes.map(item => item.label),
      series: [makeSeries('Заявки', topAccessTypes.map(item => item.value), COLORS.violet)],
    },
    {
      sourceId: 'stage_distribution',
      sourceLabel: 'stage',
      paletteType: 'chart',
      title: 'Стадии заявок',
      type: 'pie',
      description: 'Структура жизненного цикла запроса',
      metrics: ['stage'],
      slices: makeSlices(
        story.stages.map((item, index) => ({
          label: item.label,
          value: item.value,
          color: [COLORS.accent, COLORS.violet, COLORS.warning, COLORS.info, COLORS.success][index % 5],
        })),
      ),
    },
    {
      sourceId: 'organization_gaps',
      sourceLabel: 'organization',
      paletteType: 'chart',
      title: 'Организации в запросах',
      type: 'bar',
      description: 'Распределение по организациям',
      metrics: ['organization', 'request_count'],
      xAxisLabel: 'Организации',
      yAxisLabel: 'Количество',
      categories: topOrganizations.map(item => item.label),
      series: [makeSeries('Заявки', topOrganizations.map(item => item.value), COLORS.warning)],
    },
    {
      sourceId: 'reference_registry',
      sourceLabel: 'organizations_registry.xlsx',
      paletteType: 'table',
      title: 'Справочник организаций',
      type: 'table',
      description: 'Эталонный справочник для сверки',
      metrics: ['organization', 'status'],
      table: {
        columns: ['Организация', 'Категория', 'ИНН', 'Статус', 'Примечание'],
        rows: story.referenceRows.map(row => [row.title, row.subtitle, row.owner, row.status, row.note]),
      },
    },
  ];
};

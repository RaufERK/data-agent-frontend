import type {
  DataFilterState,
  DataStory,
  DataStoryBreakdown,
  DataStoryInsight,
  DataStoryMetric,
  DataStoryPreset,
  DataStoryReferenceRow,
  DataStoryRequestRow,
  UploadedFile,
} from '../types';

const MONTH_LABELS: Record<string, string> = {
  '2024-01': 'Янв',
  '2024-02': 'Фев',
  '2024-03': 'Мар',
  '2024-04': 'Апр',
  '2024-05': 'Май',
  '2024-06': 'Июн',
  '2024-07': 'Июл',
  '2024-08': 'Авг',
  '2024-09': 'Сен',
  '2024-10': 'Окт',
  '2024-11': 'Ноя',
  '2024-12': 'Дек',
};

const DIRTY_DEPARTMENT_MAP: Record<string, string> = {
  'департамент корпоративных продаж': 'Департамент корпоративных продаж',
  'Деп-т корпоративных продаж': 'Департамент корпоративных продаж',
  'Сопровождение клиентов': 'Департамент сопровождения клиентов',
  'Департамент сопровожд. клиентов': 'Департамент сопровождения клиентов',
  Риски: 'Департамент рисков',
  'Опер. поддержка': 'Департамент операционной поддержки',
  'Департамент операц. поддержки': 'Департамент операционной поддержки',
  'Цифровые каналы': 'Департамент цифровых каналов',
  'Деп-т цифровых каналов': 'Департамент цифровых каналов',
  Безопасность: 'Департамент безопасности',
  'Департамент ИБ': 'Департамент безопасности',
  Аналитика: 'Департамент аналитики',
  'Деп-т аналитики': 'Департамент аналитики',
  Закупки: 'Департамент закупок',
  'Деп-т закупок': 'Департамент закупок',
};

const DIRTY_ORG_MAP: Record<string, string> = {
  'организация 0003': 'Организация 0003',
  'Орг. 0003': 'Организация 0003',
  'ООО Организация 0005': 'Организация 0005',
  'Орг 0005': 'Организация 0005',
  'организация 0009': 'Организация 0009',
  'ORG 0009': 'Организация 0009',
};

const HIGH_RISK_ACCESS_TYPES = new Set([
  'Выгрузка в Excel',
  'Доступ к CRM API',
  'Редактирование справочников',
  'Администрирование ролей',
]);

const DEFAULT_STORY: DataStory = {
  datasetLabel: 'GenBI Access Requests',
  totalRows: 0,
  totalCells: 0,
  metrics: [],
  presets: [],
  insights: [],
  periods: [],
  departments: [],
  accessTypes: [],
  organizations: [],
  stages: [],
  referenceRows: [],
  rows: [],
  filterOptions: {
    periods: [],
    departments: [],
    organizations: [],
    accessTypes: [],
    stages: [],
    sources: [],
    statuses: [],
  },
};

const formatCount = (value: number) => value.toLocaleString('ru-RU');
const percent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`;

const tableToObjects = (table: string[][]) => {
  const [headers, ...rows] = table;
  if (!headers) return [];

  return rows.map(row => headers.reduce<Record<string, string>>((acc, header, index) => {
    acc[header] = row[index] ?? '';
    return acc;
  }, {}));
};

const findSheet = (files: UploadedFile[], fileName: string, sheetName: string) => {
  const file = files.find(f => f.name === fileName);
  if (!file) return null;
  const exact = file.sheets.find(s => s.name === sheetName);
  if (exact) return exact.preview;
  const ci = file.sheets.find(s => s.name.toLowerCase() === sheetName.toLowerCase());
  if (ci) return ci.preview;
  return file.sheets[0]?.preview ?? null;
};

const createBreakdowns = (
  entries: Array<{ key: string; label: string; value: number; secondaryValue?: string; secondaryLabel?: string; tone?: DataStoryBreakdown['tone'] }>,
) => entries.map<DataStoryBreakdown>((entry) => ({
  key: entry.key,
  label: entry.label,
  value: entry.value,
  formattedValue: formatCount(entry.value),
  secondaryValue: entry.secondaryValue,
  secondaryLabel: entry.secondaryLabel,
  tone: entry.tone,
}));

const getCanonicalDepartment = (value: string) => DIRTY_DEPARTMENT_MAP[value] ?? value;
const getCanonicalOrganization = (value: string) => DIRTY_ORG_MAP[value] ?? value;

export const DEFAULT_DATA_FILTERS: DataFilterState = {
  period: 'all',
  department: 'all',
  organization: 'all',
  accessType: 'all',
  stage: 'all',
  source: 'all',
  search: '',
  dirtyOnly: false,
};

export const buildDataStory = (files: UploadedFile[]): DataStory => {
  const requestsTable = findSheet(files, 'crm_requests_export.xlsx', 'Запросы CRM');
  const accessMatrixTable = findSheet(files, 'access_matrix.xlsx', 'Матрица доступа');
  const departmentsTable = findSheet(files, 'org_structure.xlsx', 'Подразделения');
  const organizationsTable = findSheet(files, 'organizations_registry.xlsx', 'Организации');

  if (!requestsTable || !accessMatrixTable || !departmentsTable || !organizationsTable) {
    return DEFAULT_STORY;
  }

  const requests = tableToObjects(requestsTable);
  const accessMatrix = tableToObjects(accessMatrixTable);
  const departments = tableToObjects(departmentsTable);
  const organizations = tableToObjects(organizationsTable);
  const totalRows = files.reduce((acc, file) => acc + file.sheets.reduce((sheetAcc, sheet) => sheetAcc + sheet.rows, 0), 0);
  const totalCells = files.reduce((acc, file) => acc + file.sheets.reduce((sheetAcc, sheet) => sheetAcc + (sheet.rows * sheet.cols), 0), 0);

  const departmentRegistry = new Set(departments.map(row => row['Каноническое название']));
  const organizationRegistry = new Set(organizations.map(row => row['Каноническое название']));
  const canonicalAccessRows = accessMatrix.filter(row => row['Базовое правило'] === 'Да');
  const accessRules = new Map((canonicalAccessRows.length > 0 ? canonicalAccessRows : accessMatrix).map(row => [row['Тип доступа'], row]));
  const requestIdCounts = new Map<string, number>();
  requests.forEach(row => {
    requestIdCounts.set(row.request_id, (requestIdCounts.get(row.request_id) ?? 0) + 1);
  });

  const rows: DataStoryRequestRow[] = requests.map(row => {
    const accessRule = accessRules.get(row['Тип доступа']);
    const periodKey = row['Дата создания']?.slice(0, 7) || 'unknown';
    const departmentRaw = row['Подразделение'] || 'Не указано';
    const department = getCanonicalDepartment(departmentRaw);
    const organizationRaw = row['Организация'] || '';
    const organization = organizationRaw ? getCanonicalOrganization(organizationRaw) : 'Не указана';
    const issuedAt = row['Дата выдачи'] || '';
    const expiresAt = row['Дата окончания'] || '';
    const hasDateConflict = Boolean(issuedAt && expiresAt && expiresAt < issuedAt);
    const hasDirtyDepartment = departmentRaw !== department || !departmentRegistry.has(department);
    const hasMissingOrganization = !organizationRaw || !organizationRegistry.has(organization);
    const hasDuplicate = (requestIdCounts.get(row.request_id) ?? 0) > 1;
    const requiresSeb = accessRule
      ? accessRule['Требует СЭБ'] === 'Да'
      : HIGH_RISK_ACCESS_TYPES.has(row['Тип доступа']);
    const hasApprovalMismatch = requiresSeb && !row['Согласование СЭБ'];

    return {
      requestId: row.request_id,
      title: row['Название'] || 'Без названия',
      createdAt: row['Дата создания'] || '',
      issuedAt,
      expiresAt,
      periodKey,
      periodLabel: MONTH_LABELS[periodKey] ?? periodKey,
      department,
      departmentRaw,
      owner: row['Владелец'] || 'Не назначен',
      accessType: row['Тип доступа'] || 'Не указан',
      organization,
      stage: row['Стадия'] || 'Не указана',
      sebApproval: row['Согласование СЭБ'] || '',
      requestType: row['Тип'] || 'Не указан',
      source: row['Источник'] || 'CRM',
      comment: row['Комментарий'] || '',
      hasDirtyDepartment,
      hasMissingOrganization,
      hasDateConflict,
      hasDuplicate,
      hasApprovalMismatch,
    };
  });

  const dirtyRows = rows.filter(row => (
    row.hasDirtyDepartment ||
    row.hasMissingOrganization ||
    row.hasDateConflict ||
    row.hasDuplicate ||
    row.hasApprovalMismatch
  ));
  const duplicateRows = rows.filter(row => row.hasDuplicate);
  const dateConflictRows = rows.filter(row => row.hasDateConflict);
  const missingOrganizationRows = rows.filter(row => row.hasMissingOrganization);
  const approvalMismatchRows = rows.filter(row => row.hasApprovalMismatch);
  const dirtyDepartmentRows = rows.filter(row => row.hasDirtyDepartment);

  const byPeriod = new Map<string, DataStoryRequestRow[]>();
  const byDepartment = new Map<string, DataStoryRequestRow[]>();
  const byAccessType = new Map<string, DataStoryRequestRow[]>();
  const byOrganization = new Map<string, DataStoryRequestRow[]>();
  const byStage = new Map<string, DataStoryRequestRow[]>();

  rows.forEach(row => {
    byPeriod.set(row.periodKey, [...(byPeriod.get(row.periodKey) ?? []), row]);
    byDepartment.set(row.department, [...(byDepartment.get(row.department) ?? []), row]);
    byAccessType.set(row.accessType, [...(byAccessType.get(row.accessType) ?? []), row]);
    byOrganization.set(row.organization, [...(byOrganization.get(row.organization) ?? []), row]);
    byStage.set(row.stage, [...(byStage.get(row.stage) ?? []), row]);
  });

  const periodEntries = Array.from(byPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      label: MONTH_LABELS[key] ?? key,
      value: items.length,
      secondaryLabel: 'Проблемные',
      secondaryValue: formatCount(items.filter(item => item.hasDuplicate || item.hasDateConflict || item.hasMissingOrganization || item.hasApprovalMismatch || item.hasDirtyDepartment).length),
      tone: key === '2024-03' ? 'critical' as const : 'neutral' as const,
    }));

  const departmentEntries = Array.from(byDepartment.entries())
    .map(([key, items]) => ({
      key,
      label: key,
      value: items.length,
      secondaryLabel: 'С проблемами',
      secondaryValue: formatCount(items.filter(item => item.hasDirtyDepartment || item.hasDateConflict || item.hasApprovalMismatch).length),
      tone: items.some(item => item.hasDirtyDepartment) ? 'warning' as const : 'neutral' as const,
    }))
    .sort((a, b) => b.value - a.value);

  const accessTypeEntries = Array.from(byAccessType.entries())
    .map(([key, items]) => ({
      key,
      label: key,
      value: items.length,
      secondaryLabel: 'Без СЭБ',
      secondaryValue: formatCount(items.filter(item => item.hasApprovalMismatch).length),
      tone: HIGH_RISK_ACCESS_TYPES.has(key) ? 'warning' as const : 'neutral' as const,
    }))
    .sort((a, b) => b.value - a.value);

  const organizationEntries = Array.from(byOrganization.entries())
    .map(([key, items]) => ({
      key,
      label: key,
      value: items.length,
      secondaryLabel: 'Проблемные',
      secondaryValue: formatCount(items.filter(item => item.hasMissingOrganization || item.hasDuplicate).length),
      tone: key === 'Не указана' ? 'critical' as const : 'neutral' as const,
    }))
    .sort((a, b) => b.value - a.value);

  const stageEntries = Array.from(byStage.entries())
    .map(([key, items]) => ({
      key,
      label: key,
      value: items.length,
      secondaryLabel: 'Строк',
      secondaryValue: formatCount(items.length),
      tone: key === 'На согласовании' ? 'warning' as const : 'neutral' as const,
    }))
    .sort((a, b) => b.value - a.value);

  const metrics: DataStoryMetric[] = [
    {
      id: 'dataset_size',
      label: 'Рабочий массив',
      value: `${formatCount(totalRows)} строк`,
      caption: `${formatCount(totalCells)} ячеек в CRM и 3 Excel-справочниках`,
      tone: 'neutral',
    },
    {
      id: 'crm_requests',
      label: 'Заявки из CRM',
      value: formatCount(rows.length),
      caption: `${formatCount(rows.filter(row => row.source === 'CRM').length)} из CRM, ${formatCount(rows.filter(row => row.source !== 'CRM').length)} из Excel`,
      tone: 'positive',
    },
    {
      id: 'duplicates',
      label: 'Дубликаты',
      value: formatCount(duplicateRows.length),
      caption: `${formatCount(new Set(duplicateRows.map(row => row.requestId)).size)} конфликтующих request_id`,
      tone: 'critical',
    },
    {
      id: 'date_conflicts',
      label: 'Конфликты дат',
      value: formatCount(dateConflictRows.length),
      caption: 'Дата окончания раньше даты выдачи',
      tone: 'critical',
    },
    {
      id: 'dirty_dimensions',
      label: 'Грязные справочники',
      value: formatCount(dirtyDepartmentRows.length + missingOrganizationRows.length),
      caption: `${formatCount(dirtyDepartmentRows.length)} подразделений и ${formatCount(missingOrganizationRows.length)} организаций`,
      tone: 'warning',
    },
    {
      id: 'ready_rate',
      label: 'Готово к модели',
      value: percent(((rows.length - dirtyRows.length) / Math.max(rows.length, 1)) * 100),
      caption: 'Доля строк без критичных противоречий',
      tone: dirtyRows.length > 0 ? 'warning' : 'positive',
    },
  ];

  const referenceRows: DataStoryReferenceRow[] = organizations.slice(0, 8).map(row => ({
    title: row['Организация'],
    subtitle: row['Категория'],
    owner: row['ИНН'],
    status: row['Статус'],
    note: 'Справочник организации',
  }));

  const insights: DataStoryInsight[] = [
    {
      id: 'duplicate_requests',
      title: 'Система нашла дубликаты заявок',
      severity: 'critical',
      summary: `Обнаружено ${formatCount(duplicateRows.length)} строк с повторяющимися request_id и одинаковыми названиями заявок.`,
      impact: 'Без дедупликации одна и та же заявка попадёт в отчёт дважды.',
      recommendation: 'Подтвердить дубликаты, оставить одну каноническую запись и пересчитать слой запросов.',
      evidence: [
        `${formatCount(new Set(duplicateRows.map(row => row.requestId)).size)} request_id встречаются более одного раза`,
        'Часть дублей пришла из повторной загрузки Excel поверх CRM-выгрузки',
        'Дубли уже подсвечены в превью и доступны для ручной проверки',
      ],
      filters: { dirtyOnly: true },
      focusAction: 'focus:insight:duplicate_requests',
      highlightedRowIds: duplicateRows.slice(0, 80).map(row => row.requestId),
    },
    {
      id: 'date_conflicts',
      title: 'Есть логические противоречия по датам',
      severity: 'critical',
      summary: `В ${formatCount(dateConflictRows.length)} заявках дата окончания доступа стоит раньше даты выдачи.`,
      impact: 'Такие записи ломают расчёт активных доступов и сроков продления.',
      recommendation: 'Исправить конфликтные даты до построения модели, иначе витрина срока доступа будет неверной.',
      evidence: [
        'Противоречия локализованы в одном массиве CRM-заявок',
        'Часть записей была изменена вручную в Excel после выгрузки',
        'Проблемные строки можно открыть прямо из workspace',
      ],
      filters: { dirtyOnly: true },
      focusAction: 'focus:insight:date_conflicts',
      highlightedRowIds: dateConflictRows.slice(0, 80).map(row => row.requestId),
    },
    {
      id: 'approval_gaps',
      title: 'Высокорисковые доступы без СЭБ',
      severity: 'warning',
      summary: `Для ${formatCount(approvalMismatchRows.length)} заявок доступ требует согласования СЭБ, но поле согласования пустое.`,
      impact: 'Нельзя надёжно отличить выданный доступ от неподтверждённого.',
      recommendation: 'Сверить матрицу доступа с выгрузкой CRM и дозаполнить missing approval id.',
      evidence: [
        'Проблема сосредоточена в CRM API, выгрузках Excel и администрировании ролей',
        'Матрица доступа уже подключена, правило можно применить автоматически',
        'После очистки эти записи станут пригодны для модели доступа',
      ],
      filters: { dirtyOnly: true },
      focusAction: 'focus:insight:approval_gaps',
      highlightedRowIds: approvalMismatchRows.slice(0, 80).map(row => row.requestId),
    },
    {
      id: 'quality_cleanup',
      title: 'Противоречия между CRM и Excel мешают консолидации',
      severity: 'warning',
      summary: `${formatCount(dirtyRows.length)} строк требуют очистки: дубликаты, конфликты дат, разные названия подразделений и отсутствующие организации.`,
      impact: 'Пока массив не приведён к канону, ERD и витрина доступа будут раздуты ложными сущностями.',
      recommendation: 'Сначала очистить и нормализовать справочники, затем выбирать модель данных.',
      evidence: [
        'Одно подразделение встречается в CRM и Excel под разными названиями',
        'Часть организаций не совпадает со справочником или не указана',
        'Чат может сразу перевести workspace в режим исправления',
      ],
      filters: { dirtyOnly: true },
      focusAction: 'focus:insight:quality_cleanup',
      highlightedRowIds: dirtyRows.slice(0, 120).map(row => row.requestId),
    },
  ];

  const presets: DataStoryPreset[] = [
    {
      id: 'all_requests',
      title: 'Все заявки',
      description: 'Полный массив CRM и Excel-источников',
      filters: {},
    },
    {
      id: 'duplicates',
      title: 'Дубликаты',
      description: 'Повторяющиеся заявки между CRM и Excel',
      insightId: 'duplicate_requests',
      filters: { dirtyOnly: true },
    },
    {
      id: 'date_conflicts',
      title: 'Конфликты дат',
      description: 'Строки с нарушенной логикой жизненного цикла доступа',
      insightId: 'date_conflicts',
      filters: { dirtyOnly: true },
    },
    {
      id: 'approval_gaps',
      title: 'Пробелы СЭБ',
      description: 'Высокорисковые доступы без номера согласования',
      insightId: 'approval_gaps',
      filters: { dirtyOnly: true },
    },
    {
      id: 'quality_cleanup',
      title: 'Исправление данных',
      description: 'Все строки, мешающие консолидации и модели',
      insightId: 'quality_cleanup',
      filters: { dirtyOnly: true },
    },
  ];

  return {
    datasetLabel: 'CRM Requests + Excel References',
    totalRows,
    totalCells,
    metrics,
    presets,
    insights,
    periods: createBreakdowns(periodEntries),
    departments: createBreakdowns(departmentEntries),
    accessTypes: createBreakdowns(accessTypeEntries),
    organizations: createBreakdowns(organizationEntries),
    stages: createBreakdowns(stageEntries),
    referenceRows,
    rows,
    filterOptions: {
      periods: ['all', ...periodEntries.map(item => item.key)],
      departments: ['all', ...Array.from(new Set(rows.map(row => row.department))).sort((a, b) => a.localeCompare(b, 'ru'))],
      organizations: ['all', ...Array.from(new Set(rows.map(row => row.organization))).sort((a, b) => a.localeCompare(b, 'ru'))],
      accessTypes: ['all', ...Array.from(new Set(rows.map(row => row.accessType))).sort((a, b) => a.localeCompare(b, 'ru'))],
      stages: ['all', ...Array.from(new Set(rows.map(row => row.stage))).sort((a, b) => a.localeCompare(b, 'ru'))],
      sources: ['all', ...Array.from(new Set(rows.map(row => row.source))).sort((a, b) => a.localeCompare(b, 'ru'))],
      statuses: [],
    },
  };
};

import type { PetalFlowConfig, PetalKey, PetalEnabled } from '../../types';

/**
 * 6 кубиков ромашки. Порядок визуальный (по кругу), но навигация НЕЛИНЕЙНАЯ —
 * пользователь сам включает/выключает нужные кубики.
 * Из любой комбинации активных кубиков можно построить дашборд.
 */
export const PETAL_FLOW_CONFIG: PetalFlowConfig[] = [
  {
    key: 'data',
    label: 'Загруженные данные',
    shortLabel: 'Данные',
    description: 'Загрузка исходных файлов и просмотр содержимого',
    section: 'data',
    color: '#4dd0e1',
    glowColor: 'rgba(77,208,225,0.45)',
    icon: 'Storage',
    steps: [
      {
        label: 'Загрузка',
        description: 'Добавьте файлы и проверьте содержимое',
        section: 'data',
        subStep: 0,
      },
    ],
  },
  {
    key: 'model',
    label: 'Модель данных',
    shortLabel: 'Модель',
    description: 'Выбор архитектуры и рекомендуемой схемы',
    section: 'model',
    color: '#ab47bc',
    glowColor: 'rgba(171,71,188,0.45)',
    icon: 'Schema',
    steps: [
      {
        label: 'Модель данных',
        description: 'Выбор архитектуры и сравнение вариантов',
        section: 'model',
        subStep: 0,
      },
      {
        label: 'ERD-схема',
        description: 'Итоговая схема связей после выбора модели',
        section: 'model',
        subStep: 2,
      },
    ],
  },
  {
    key: 'detail',
    label: 'Детальный слой',
    shortLabel: 'Дет. слой',
    description: 'Очищенные таблицы и справочники для DWH',
    section: 'model',
    color: '#66bb6a',
    glowColor: 'rgba(102,187,106,0.45)',
    icon: 'Layers',
    steps: [
      {
        label: 'Детальный слой',
        description: 'Постройте fact и reference таблицы по источникам',
        section: 'model',
        subStep: 1,
      },
    ],
  },
  {
    key: 'dashboard',
    label: 'Дашборд',
    shortLabel: 'Дашборд',
    description: 'Конструктор визуализаций',
    section: 'dashboard',
    color: '#ff6e40',
    glowColor: 'rgba(255,110,64,0.45)',
    icon: 'Dashboard',
    alwaysOn: true,
    steps: [
      {
        label: 'Конструктор',
        description: 'Соберите и настройте визуализации',
        section: 'dashboard',
        subStep: 0,
      },
    ],
  },
];

/** Все ключи в порядке визуального расположения */
export const PETAL_KEYS: PetalKey[] = PETAL_FLOW_CONFIG.map((p) => p.key);

/** Дефолтное состояние: данные + дашборд включены, остальное выключено */
export const DEFAULT_PETAL_ENABLED: PetalEnabled = {
  data: true,
  detail: false,
  mart: false,
  model: false,
  mockup: false,
  dashboard: true,
};

export function getPetalConfig(key: PetalKey): PetalFlowConfig {
  return PETAL_FLOW_CONFIG.find((item) => item.key === key) ?? PETAL_FLOW_CONFIG[0];
}

export function getPetalFromRoute(
  section: 'overview' | 'data' | 'model' | 'mart' | 'mockup' | 'dashboard',
  subStep: number,
): PetalKey | null {
  if (section === 'overview') return null;
  if (section === 'data') {
    return 'data';
  }
  if (section === 'model') {
    if (subStep <= 0) return 'model';
    if (subStep === 1) return 'detail';
    return 'model'; // subStep 2: ERD result — возвращаемся к model petal
  }
  if (section === 'mart') return 'model';
  if (section === 'mockup') return 'mockup';
  return 'dashboard';
}

export function getRouteForPetalStep(key: PetalKey, stepIndex = 0): {
  section: 'data' | 'model' | 'mart' | 'mockup' | 'dashboard';
  subStep: number;
} {
  const config = getPetalConfig(key);
  const step = config.steps[stepIndex] ?? config.steps[0];
  return { section: step.section, subStep: step.subStep };
}

/**
 * Проверяет, можно ли сформировать дашборд:
 * все включённые (не серые) кубики должны быть зелёными.
 */
export function canBuildDashboard(
  statuses: Record<PetalKey, string>,
  enabled: PetalEnabled,
): boolean {
  for (const key of PETAL_KEYS) {
    if (key === 'dashboard') continue;
    if (enabled[key] && statuses[key] !== 'green') return false;
  }
  return true;
}

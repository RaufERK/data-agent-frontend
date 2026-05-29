// ========== Project types ==========

export interface DashboardSnapshot {
  id: string;
  label: string;
  createdAt: string;
  charts: MockChart[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  files: UploadedFile[];
  imageFile: ImageFile | null;        // салфетка / макет дашборда
  issues: QualityIssue[];
  detailTables: DetailTable[];
  erdRelationships?: Array<{ from_table: string; from_col: string; to_table: string; to_col: string; confidence: number }>;
  selectedERDModel: string;
  erdGenerated: boolean;
  dashboardBuilt: boolean;
  dashboardBgTheme?: 'dark' | 'light';
  widgets: DashboardWidget[];
  dashboardCharts: MockChart[];
  dashboardHistory?: DashboardSnapshot[];
  dataVersions?: DataVersion[];
  status: ProjectStatus;
  petalStatuses: PetalStatuses;
  petalEnabled: PetalEnabled;         // какие кубики включены пользователем
}

export type ProjectStatus =
  | 'empty'
  | 'files_uploaded'
  | 'analyzing'
  | 'analyzed'
  | 'cleaning'
  | 'cleaned'
  | 'building_detail'
  | 'detail_built'
  | 'building_mart'
  | 'mart_built'
  | 'generating_erd'
  | 'erd_generated'
  | 'building_dashboard'
  | 'dashboard_built'
  | 'complete';

// Petal status: grey=отключён, yellow=в работе, green=готов
export type PetalStatus = 'grey' | 'yellow' | 'green';

export type PetalKey = 'data' | 'detail' | 'mart' | 'model' | 'mockup' | 'dashboard';

export type NavigationMode = 'flower' | 'petal';

export interface PetalStatuses {
  data: PetalStatus;
  detail: PetalStatus;
  mart: PetalStatus;
  model: PetalStatus;
  mockup: PetalStatus;
  dashboard: PetalStatus;
}

// Какие кубики активны (пользователь выбирает)
export interface PetalEnabled {
  data: boolean;
  detail: boolean;
  mart: boolean;
  model: boolean;
  mockup: boolean;
  dashboard: boolean;   // дашборд всегда true — конечная цель
}

export interface PetalStep {
  label: string;
  description: string;
  section: 'data' | 'model' | 'mart' | 'mockup' | 'dashboard';
  subStep: number;
}

export interface PetalFlowConfig {
  key: PetalKey;
  label: string;
  shortLabel: string;
  description: string;
  section: 'data' | 'model' | 'mart' | 'mockup' | 'dashboard';
  color: string;
  glowColor: string;
  icon: string;           // MUI icon name
  steps: PetalStep[];
  alwaysOn?: boolean;     // dashboard always on
}

// ========== File types ==========

export interface UploadedFile {
  name: string;
  size: string;
  sheets: SheetInfo[];
  status: 'pending' | 'analyzing' | 'done';
  _rawFile?: File;
}

export interface SheetInfo {
  name: string;
  rows: number;
  cols: number;
  preview: string[][];
}

export interface DataVersion {
  version_id: string;
  version_number: number;
  name: string;
  source_table: string;
  table_name: string;
  instruction: string;
  row_count: number;
  column_count: number;
  created_at: string;
}

export interface MockupElementStats {
  type: string;          // e.g. 'big_number', 'bar', 'line', 'pie', 'table', 'donut', ...
  label: string;         // Human-readable: 'KPI', 'Гистограмма', 'Линейный график', ...
  count: number;
  items: { title: string; confidence: number }[];
}

export interface MockupAnalysis {
  totalElements: number;
  kpiCount: number;
  chartCount: number;
  elementsByType: MockupElementStats[];
  analyzedAt: string;
}

export interface ImageFile {
  name: string;
  width: number;
  height: number;
  size: string;
  analysis: MockupAnalysis | null;
  previewUrl?: string;
}

// ========== Quality types ==========

export interface QualityIssue {
  id: number;
  severity: 'error' | 'warning' | 'info';
  file: string;
  sheet: string;
  column: string;
  description: string;
  affected: number;
  autofix: boolean;
  rows?: number[];
  fixed?: boolean;
}

export interface CleaningDiff {
  id: number;
  title: string;
  file: string;
  sheet: string;
  column: string;
  row: number;
  severity: 'error' | 'warning' | 'info';
  original: string;
  fixed: string;
  context: {
    before: string[];
    after: string[];
    headers: string[];
  };
}

// ========== Detail layer types ==========

export interface DetailTable {
  name: string;
  type: 'transaction' | 'reference' | 'aggregate';
  columns: DetailColumn[];
  rowCount: number;
  source: string;
}

export interface DetailColumn {
  name: string;
  dataType: string;
  isPK: boolean;
  isFK: boolean;
  nullable: boolean;
}

// ========== ERD types ==========

export interface ERDModel {
  id: string;
  name: string;
  description: string;
  tables: ERDTable[];
  pros: string[];
  cons: string[];
  complexity: string;
  performance: string;
  flexibility: string;
  recommended?: boolean;
}

export interface ERDTable {
  name: string;
  type: 'fact' | 'dimension' | 'hub' | 'link' | 'satellite' | 'bridge';
  columns: string[];
}

// ========== Dashboard types ==========

export interface MockChart {
  title: string;
  type: string;
  description: string;
  metrics: string[];
  colSpan?: number;
  rowSpan?: number;
  sourceId?: string;
  sourceLabel?: string;
  paletteType?: DashboardWidgetType;
  xAxisLabel?: string;
  yAxisLabel?: string;
  subtitle?: string;
  value?: string;
  trend?: string;
  color?: string;
  sparkline?: number[];
  sparklineType?: 'bar' | 'line';
  kpiBreakdown?: Array<{ label: string; value: string }>;
  categories?: string[];
  series?: MockChartSeries[];
  slices?: MockChartSlice[];
  table?: MockChartTable;
  filter?: MockChartFilter;
  // Highlight support
  highlightedCategories?: string[];
  highlightColor?: 'anomaly' | 'warning' | 'positive';
  anomalyBadge?: string;
  recommendationReason?: string;
  aggregation?: string;
  confidence?: number | null;
  insights?: string[];
  qualityScore?: number | null;
  qualityWarnings?: string[];
  // Vision-derived layout (normalised 0..1 fractions from the source image)
  position?: { left: number; top: number; width: number; height: number } | null;
  seriesColors?: string[] | null;
  stacked?: boolean;
  visualType?: string;
  progressMax?: number | null;
  userResizedLayout?: boolean;
}

export interface DashboardFilter {
  selections?: Record<string, string[]>;
  excludeRegions?: string[];
  includeRegions?: string[];
  excludeManagers?: string[];
  topN?: number;
}

export interface MockChartSeries {
  name: string;
  values: number[];
  color: string;
  valueLabels?: string[];
}

export interface MockChartSlice {
  label: string;
  value: number;
  displayValue: string;
  color: string;
}

export interface MockChartTable {
  columns: string[];
  rows: string[][];
}

export interface MockChartFilter {
  field: string;
  source: string;
  multi?: boolean;
  options: MockChartFilterOption[];
  selectedValues?: string[];
}

export interface MockChartFilterOption {
  label: string;
  value: string;
  count?: number;
}

export type DashboardWidgetType = 'kpi' | 'chart' | 'table' | 'filter';

export interface MockWidgetSource {
  id: string;
  title: string;
  description: string;
  table: string;
  fields: string[];
  widgetTypes: DashboardWidgetType[];
  accentColor: string;
}

export interface MockWidgetTemplate {
  id: string;
  sourceId: string;
  paletteType: DashboardWidgetType;
  actualType: string;
  title: string;
  summary: string;
  chart: MockChart;
}

export interface DashboardWidget {
  id: number;
  type: DashboardWidgetType;
  title: string;
  row: number;
  col: number;
}

// ========== Data workspace types ==========

export interface DataFilterState {
  period: string;
  department: string;
  organization: string;
  accessType: string;
  stage: string;
  source: string;
  search: string;
  dirtyOnly: boolean;
}

export interface DataStoryMetric {
  id: string;
  label: string;
  value: string;
  caption: string;
  tone: 'neutral' | 'warning' | 'positive' | 'critical';
}

export interface DataStoryBreakdown {
  key: string;
  label: string;
  value: number;
  formattedValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  tone?: 'neutral' | 'warning' | 'positive' | 'critical';
}

export interface DataStoryRequestRow {
  requestId: string;
  title: string;
  createdAt: string;
  issuedAt: string;
  expiresAt: string;
  periodKey: string;
  periodLabel: string;
  department: string;
  departmentRaw: string;
  owner: string;
  accessType: string;
  organization: string;
  stage: string;
  sebApproval: string;
  requestType: string;
  source: string;
  comment: string;
  hasDirtyDepartment: boolean;
  hasMissingOrganization: boolean;
  hasDateConflict: boolean;
  hasDuplicate: boolean;
  hasApprovalMismatch: boolean;
}

export interface DataStoryReferenceRow {
  title: string;
  subtitle: string;
  owner: string;
  status: string;
  note: string;
}

export interface DataStoryInsight {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'positive';
  summary: string;
  impact: string;
  recommendation: string;
  evidence: string[];
  filters: Partial<DataFilterState>;
  focusAction: string;
  highlightedRowIds: string[];
}

export interface DataStoryPreset {
  id: string;
  title: string;
  description: string;
  insightId?: string;
  filters: Partial<DataFilterState>;
}

export interface DataStory {
  datasetLabel: string;
  totalRows: number;
  totalCells: number;
  metrics: DataStoryMetric[];
  presets: DataStoryPreset[];
  insights: DataStoryInsight[];
  periods: DataStoryBreakdown[];
  departments: DataStoryBreakdown[];
  accessTypes: DataStoryBreakdown[];
  organizations: DataStoryBreakdown[];
  stages: DataStoryBreakdown[];
  referenceRows: DataStoryReferenceRow[];
  rows: DataStoryRequestRow[];
  filterOptions: {
    periods: string[];
    departments: string[];
    organizations: string[];
    accessTypes: string[];
    stages: string[];
    sources: string[];
    statuses: string[];
  };
}

// ========== Chat types ==========

export interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  options?: ChatOption[];
  messageType?: 'normal' | 'insight' | 'anomaly' | 'action_result';
  sql?: string;
  rowCount?: number;
}

export interface ChatOption {
  num: number;
  label: string;
  action: () => void;
}

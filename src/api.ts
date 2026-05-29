const BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '/api';

const TIMEOUT_MS = 60_000;
const LONG_TIMEOUT_MS = 180_000;
const IMAGE_ANALYSIS_TIMEOUT_MS = 300_000;

async function req<T>(method: string, path: string, body?: unknown, isForm = false, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const opts: RequestInit = { method, signal: controller.signal, credentials: 'include' };
  if (body) {
    if (isForm) {
      opts.body = body as FormData;
    } else {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
  }
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? res.statusText);
    }
    return res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`Превышено время ожидания ответа от сервера (${timeoutMs / 1000}с)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function reqBlob(method: string, path: string, body?: unknown): Promise<{ blob: Blob; filename?: string }> {
  const opts: RequestInit = { method, credentials: 'include' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? res.statusText);
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1].replace(/"/g, '')) : undefined;
  return { blob: await res.blob(), filename };
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface Column {
  name: string;
  type: string;
  raw_type: string;
}

export interface UploadResult {
  session_id: string;
  table_name: string;
  row_count: number;
  columns: Column[];
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface QuotaItem {
  limit: number;
  used: number;
  remaining: number;
  reset_at: string;
}

export interface QuotasResult {
  quotas: Record<'upload_files' | 'assistant_questions' | 'dashboard_generations' | 'vision_analyses', QuotaItem>;
  upload: { max_upload_mb: number };
}

export interface ModelSettingsResult {
  cloudru_model: string;
  gigachat_vision_model: string;
  overrides: Record<string, string>;
}

export interface QualityIssue {
  type: 'null' | 'duplicate' | 'case_mismatch' | 'invalid_date' | 'date_order' | 'non_numeric' | 'missing_required_approval' | 'reference_mismatch';
  count: number;
  pct?: number;
  severity: 'warning' | 'error';
  rows?: number[];
}

export interface ColumnQuality {
  column: string;
  type: string;
  severity: 'ok' | 'warning' | 'error';
  issues: QualityIssue[];
}

export interface QualityResult {
  session_id: string;
  table_name: string;
  total_rows: number;
  columns: ColumnQuality[];
  summary: { errors: number; warnings: number };
}

export interface ChatResult {
  session_id: string;
  question: string;
  sql: string;
  answer?: string;
  columns: string[];
  data: Record<string, unknown>[];
  row_count: number;
}

export interface DashboardResult {
  session_id: string;
  topic: string;
  charts: Record<string, unknown>[];
}

export interface PresentationBrief {
  title: string;
  dataset_summary: string;
  executive_summary: string[];
  key_findings: string[];
  risks: string[];
  recommended_actions: string[];
  sql_evidence?: Array<{ name: string; column?: string; sql?: string; data: Record<string, unknown>[] }>;
  profile?: Record<string, unknown>;
}

export interface PresentationBriefResult {
  session_id: string;
  brief: PresentationBrief;
}

export interface QueryResult {
  columns: string[];
  data: Record<string, unknown>[];
  row_count: number;
}

export interface TablePreviewResult extends QueryResult {
  session_id: string;
  table_name: string;
}

export interface SchemaColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_fk: boolean;
  nullable: boolean;
  role: 'pk' | 'fk' | 'dimension' | 'measure' | 'date' | 'other';
  unique_count: number;
}

export interface SchemaTable {
  name: string;
  type: 'transaction' | 'reference' | 'aggregate';
  row_count: number;
  source: string;
  columns: SchemaColumn[];
}

export interface SchemaRelationship {
  from_table: string;
  from_col: string;
  to_table: string;
  to_col: string;
  confidence: number;
}

export interface SchemaResult {
  session_id: string;
  tables: SchemaTable[];
  relationships: SchemaRelationship[];
  suggested_model: 'star' | 'snowflake' | 'flat';
}

export interface SemanticColumn {
  name: string;
  raw_type: string;
  type: 'integer' | 'float' | 'boolean' | 'datetime' | 'string';
  role: 'primary_key' | 'key' | 'date' | 'measure' | 'category' | 'geo' | 'text' | 'other';
  unique_count: number;
  null_count: number;
  sample_values: string[];
}

export interface SemanticManifest {
  session_id: string;
  tables: Array<{ name: string; row_count: number; role: 'fact' | 'dimension' | 'aggregate'; columns: SemanticColumn[] }>;
  relationships: SchemaRelationship[];
  recommended_questions: string[];
  instructions: Array<{ memory_id: string; instruction: string; scope: string; created_at: string }>;
}

export interface ModelAdviceOption {
  id: 'no_model' | 'star' | 'snowflake' | 'datavault';
  label: string;
  description: string;
  fit_score: number;
  fit_label: 'high' | 'medium' | 'low';
  summary: string;
  rationale: string[];
  tradeoffs: string[];
  needs_detail_layer: boolean;
  recommended: boolean;
  sql_evidence_ids: string[];
}

export interface ModelAdviceEvidence {
  id: string;
  title: string;
  sql: string;
  columns: string[];
  data: Record<string, unknown>[];
  row_count: number;
}

export interface ModelAdviceProfile {
  table_count: number;
  total_rows: number;
  transaction_table_count: number;
  reference_table_count: number;
  aggregate_table_count: number;
  relationship_count: number;
  average_relationship_match_rate_pct: number | null;
  hierarchy_signals: string[];
  source_complexity: 'low' | 'medium' | 'high';
}

export interface ModelAdviceResult {
  session_id: string;
  executive_summary: string;
  need_data_model: boolean;
  need_detail_layer: boolean;
  recommended_option: 'no_model' | 'star' | 'snowflake' | 'datavault';
  dataset_profile: ModelAdviceProfile;
  options: ModelAdviceOption[];
  sql_evidence: ModelAdviceEvidence[];
}

export interface CleanResult {
  session_id: string;
  cleaned_tables: Array<{
    table_name: string;
    updated_rows: number;
    actions: string[];
  }>;
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

export interface SessionHistoryItem {
  id: string;
  user_id: string;
  email?: string;
  created_at: string;
  updated_at: string;
  upload_count: number;
  chat_count: number;
}

export interface UploadHistoryItem {
  id: string;
  user_id: string;
  session_id: string;
  filename: string;
  table_name: string;
  path: string;
  row_count: number;
  created_at: string;
}

export interface SessionHistoryResult {
  session_id: string;
  uploads: UploadHistoryItem[];
  chat: Array<{ role: string; content: string; sql?: string | null; payload?: Record<string, unknown>; created_at: string }>;
}

export interface ReimportResult {
  source_session_id: string;
  session_id: string;
  uploads: Array<{ filename: string; table_name: string; row_count: number; columns: Column[] }>;
}

export type DashboardExportTarget = 'navigator' | 'datalens' | 'superset' | 'foresight' | 'visiology';

export interface VisiologyPublishResult {
  workspace_id: string;
  dataset_id: string;
  dataset_name: string;
  table_id: string;
  table_name: string;
  row_count: number;
  dashboard_guid: string;
  dashboard_url: string;
  designer_url?: string;
  widget_validation?: Array<{ title?: string; ok: boolean; message?: string | null }>;
}

export interface ForesightPublishResult {
  status: string;
  mode: string;
  temporary: boolean;
  dashboard?: { n?: string; c?: number; k?: number | null; i?: string | null };
  dashboard_title?: string;
  object_id?: string;
  object_key?: number | null;
  view_url?: string | null;
  edit_url?: string | null;
  rows: number;
  widget_types: string[];
  widget_count?: number;
  widgets?: Array<{ type: string; cube_key: number; dso_id?: string; eax_id?: string }>;
  cube_key?: number;
  cube_key_hint?: number;
  screenshot_size?: number;
  body_excerpt?: string;
}

export interface DataLensPublishResult {
  status: string;
  mode?: string;
  workbook_id: string;
  workbook_title: string;
  connection_id?: string;
  dataset_id?: string;
  dataset_name?: string;
  dashboard_id: string;
  dashboard_title: string;
  widget_count: number;
  widget_ids: string[];
  workbook_url: string;
  dashboard_url: string;
  api_base_url: string;
}

export interface ImageAnalysisResult {
  spec: Record<string, unknown>;
  vitrina: {
    FactDashboard: Array<{ widget_id: number; widget_title: string; widget_type: string; category: string | null; series: string | null; value: number | null }>;
    FactKPIs: Array<{ kpi_id: number; metric_code: string; metric_name: string; value: number | null; unit: string | null; note: string | null; sparkline_json?: string; sparkline_type?: 'bar' | 'line'; breakdown_json?: string; position?: { left: number; top: number; width: number; height: number } | null; visual_type?: string; progress_max?: number | null }>;
    widget_meta: Record<string, { title: string; type: string; color: string | null; stacked: boolean; is_horizontal: boolean; position?: { left: number; top: number; width: number; height: number } | null; series_colors?: string[] | null; gauge_value?: number | null; gauge_max?: number | null }>;
    background_theme: 'dark' | 'light';
  };
  summary: { charts_detected: number; kpis_detected: number; fact_rows: number; kpi_rows: number; widgets: number };
}

interface ImageJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: string;
  pct: number;
  label: string;
  result?: ImageAnalysisResult;
  error?: string | null;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const api = {
  register: (email: string, password: string) =>
    req<AuthUser>('POST', '/auth/register', { email, password }),

  login: (email: string, password: string) =>
    req<AuthUser>('POST', '/auth/login', { email, password }),

  logout: () =>
    req<{ ok: boolean }>('POST', '/auth/logout'),

  me: () =>
    req<AuthUser>('GET', '/auth/me'),

  getQuotas: () =>
    req<QuotasResult>('GET', '/auth/me/quotas'),

  getModelSettings: () =>
    req<ModelSettingsResult>('GET', '/admin/model-settings'),

  updateModelSettings: (settings: Partial<Pick<ModelSettingsResult, 'cloudru_model' | 'gigachat_vision_model'>>) =>
    req<ModelSettingsResult>('PUT', '/admin/model-settings', settings),

  createSession: () => req<{ session_id: string }>('POST', '/sessions'),

  listSessions: () =>
    req<{ sessions: SessionHistoryItem[] }>('GET', '/sessions'),

  getSessionHistory: (sessionId: string) =>
    req<SessionHistoryResult>('GET', `/sessions/${sessionId}/history`),

  reimportSession: (sessionId: string) =>
    req<ReimportResult>('POST', `/sessions/${sessionId}/reimport`),

  uploadFile: (sessionId: string, file: File, tableName?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (tableName) fd.append('table_name', tableName);
    return req<UploadResult>('POST', `/sessions/${sessionId}/upload`, fd, true);
  },

  listTables: (sessionId: string) =>
    req<{ session_id: string; tables: string[] }>('GET', `/sessions/${sessionId}/tables`),

  getTablePreview: (sessionId: string, tableName: string, limit = 1000) =>
    req<TablePreviewResult>('GET', `/sessions/${sessionId}/tables/${tableName}/preview?limit=${limit}`),

  getQuality: (sessionId: string, tableName: string) =>
    req<QualityResult>('GET', `/sessions/${sessionId}/quality/${tableName}`),

  chat: (sessionId: string, question: string) =>
    req<ChatResult>('POST', `/sessions/${sessionId}/chat`, { question }, false, LONG_TIMEOUT_MS),

  query: (sessionId: string, sql: string) =>
    req<QueryResult>('POST', `/sessions/${sessionId}/query`, { sql }),

  generateDashboard: (sessionId: string, topic: string) =>
    req<DashboardResult>('POST', `/sessions/${sessionId}/dashboard`, { topic }, false, LONG_TIMEOUT_MS),

  generatePresentationBrief: (sessionId: string, title: string, charts: Record<string, unknown>[]) =>
    req<PresentationBriefResult>('POST', `/sessions/${sessionId}/presentation-brief`, { title, charts }),

  exportDashboard: (target: DashboardExportTarget, payload: Record<string, unknown>) =>
    reqBlob('POST', `/export/dashboard/${target}`, payload),

  publishVisiologyDashboard: (payload: Record<string, unknown>) =>
    req<VisiologyPublishResult>('POST', '/export/dashboard/visiology/publish', payload),

  publishDataLensDashboard: (payload: Record<string, unknown>) =>
    req<DataLensPublishResult>('POST', '/export/dashboard/datalens/publish', payload),

  publishDataLensNativeDashboard: (payload: Record<string, unknown>) =>
    req<DataLensPublishResult>('POST', '/export/dashboard/datalens/publish-native', payload),

  publishForesightMvp: (payload: Record<string, unknown>) =>
    req<ForesightPublishResult>('POST', '/export/foresight/publish-mvp', payload),

  publishForesight: (payload: Record<string, unknown>) =>
    req<ForesightPublishResult>('POST', '/export/foresight/publish', payload),

  getSchema: (sessionId: string) =>
    req<SchemaResult>('GET', `/sessions/${sessionId}/schema`),

  getSemanticManifest: (sessionId: string) =>
    req<SemanticManifest>('GET', `/sessions/${sessionId}/semantic-manifest`),

  listMemory: (sessionId: string) =>
    req<{ session_id: string; items: SemanticManifest['instructions'] }>('GET', `/sessions/${sessionId}/memory`),

  addMemory: (sessionId: string, instruction: string, scope = 'project') =>
    req<{ session_id: string; item: SemanticManifest['instructions'][number] }>('POST', `/sessions/${sessionId}/memory`, { instruction, scope }),

  deleteMemory: (sessionId: string, memoryId: string) =>
    req<{ session_id: string; deleted: boolean; memory_id: string }>('DELETE', `/sessions/${sessionId}/memory/${memoryId}`),

  getModelAdvice: (sessionId: string) =>
    req<ModelAdviceResult>('GET', `/sessions/${sessionId}/model-advice`),

  cleanSession: (sessionId: string) =>
    req<CleanResult>('POST', `/sessions/${sessionId}/clean`),

  listDataVersions: (sessionId: string) =>
    req<{ session_id: string; versions: DataVersion[] }>('GET', `/sessions/${sessionId}/versions`),

  createDataVersion: (sessionId: string, instruction: string, name?: string) =>
    req<{ session_id: string; version: DataVersion }>('POST', `/sessions/${sessionId}/versions`, { instruction, name }),

  getDataVersionPreview: (sessionId: string, versionId: string, limit = 1000) =>
    req<TablePreviewResult & { version_id: string }>('GET', `/sessions/${sessionId}/versions/${versionId}/preview?limit=${limit}`),

  downloadDataVersionCsv: (sessionId: string, versionId: string) =>
    reqBlob('GET', `/sessions/${sessionId}/versions/${versionId}/csv`),

  deleteSession: (sessionId: string) =>
    req<{ deleted: string }>('DELETE', `/sessions/${sessionId}`),

  analyzeImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return req<ImageAnalysisResult>('POST', '/image/analyze', fd, true);
  },

  analyzeImageStream: async (
    file: File,
    onProgress: (stage: string, pct: number, label: string) => void,
  ): Promise<ImageAnalysisResult> => {
    const fd = new FormData();
    fd.append('file', file);
    const created = await req<{ job_id: string; status: string; pct: number; label: string }>('POST', '/image/analyze-jobs', fd, true);
    onProgress('queued', created.pct ?? 0, created.label ?? 'В очереди');

    const startedAt = Date.now();
    while (Date.now() - startedAt < IMAGE_ANALYSIS_TIMEOUT_MS) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const job = await req<ImageJobStatus>('GET', `/image/analyze-jobs/${created.job_id}`, undefined, false, TIMEOUT_MS);
      onProgress(job.stage ?? job.status, job.pct ?? 0, job.label ?? job.stage ?? job.status);
      if (job.status === 'done' && job.result) return job.result;
      if (job.status === 'failed') throw new Error(job.error ?? 'Vision analysis failed');
    }
    throw new Error(`Превышено время ожидания анализа изображения (${IMAGE_ANALYSIS_TIMEOUT_MS / 1000}с)`);
  },

  analyzeImageWithData: async (
    file: File,
    sessionId: string,
    onProgress: (stage: string, pct: number, label: string) => void,
  ): Promise<ImageAnalysisResult> => {
    const fd = new FormData();
    fd.append('file', file);
    const created = await req<{ job_id: string; status: string; pct: number; label: string }>(
      'POST', `/image/analyze-with-data?session_id=${encodeURIComponent(sessionId)}`, fd, true,
    );
    onProgress('queued', created.pct ?? 0, created.label ?? 'В очереди');
    const startedAt = Date.now();
    while (Date.now() - startedAt < IMAGE_ANALYSIS_TIMEOUT_MS) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const job = await req<ImageJobStatus>('GET', `/image/analyze-jobs/${created.job_id}`, undefined, false, TIMEOUT_MS);
      onProgress(job.stage ?? job.status, job.pct ?? 0, job.label ?? job.stage ?? job.status);
      if (job.status === 'done' && job.result) return job.result;
      if (job.status === 'failed') throw new Error(job.error ?? 'Vision analysis failed');
    }
    throw new Error(`Превышено время ожидания анализа изображения (${IMAGE_ANALYSIS_TIMEOUT_MS / 1000}с)`);
  },

  loadVitrina: (sessionId: string, vitrina: {
    FactDashboard: Array<Record<string, unknown>>;
    FactKPIs: Array<Record<string, unknown>>;
    widget_meta?: Record<string, unknown>;
  }) =>
    req<{ session_id: string; tables_created: string[] }>('POST', `/sessions/${sessionId}/vitrina`, vitrina),

  health: () => req<{ status: string }>('GET', '/health'),
};

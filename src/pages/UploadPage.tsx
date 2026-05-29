import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Chip, LinearProgress, CircularProgress, Fade, Collapse, TextField, IconButton, Modal, Tooltip, Divider } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SpeedIcon from '@mui/icons-material/Speed';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { useProject } from '../store/ProjectContext';
import { api } from '../api';

interface MockupElementGroup {
  type: string;
  label: string;
  count: number;
  items: Array<{ title: string; confidence: number }>;
}

interface MockupAnalysisResult {
  totalElements: number;
  kpiCount: number;
  chartCount: number;
  elementsByType: MockupElementGroup[];
}

const CHART_TYPE_ICONS: Record<string, React.ReactNode> = {
  big_number: <SpeedIcon sx={{ fontSize: 18 }} />,
  bar: <BarChartIcon sx={{ fontSize: 18 }} />,
  line: <ShowChartIcon sx={{ fontSize: 18 }} />,
  pie: <PieChartIcon sx={{ fontSize: 18 }} />,
};
const CHART_TYPE_COLORS: Record<string, string> = {
  big_number: 'var(--app-accent)',
  bar: 'var(--app-info)',
  line: 'var(--app-warning)',
  pie: 'var(--app-violet)',
};

type ImageState = 'idle' | 'ready' | 'analyzing' | 'done';

function chartTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    big_number: 'KPI-карточка',
    bar: 'Гистограмма',
    bar_horizontal: 'Гор.гистограмма',
    line: 'Линейный график',
    area: 'График областей',
    pie: 'Круговая диаграмма',
    donut: 'Кольцевая диаграмма',
    table: 'Таблица',
    funnel: 'Воронка',
    scatter: 'Точечная',
    sankey: 'Санки',
    radar: 'Радар',
    country_map: 'Карта',
  };
  return labels[type] ?? type;
}

const parseSparklineJson = (value: unknown): number[] | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : undefined;
  } catch {
    return undefined;
  }
};

const parseBreakdownJson = (value: unknown): Array<{ label: string; value: string }> | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .map(item => ({ label: String(item?.label ?? ''), value: String(item?.value ?? '') }))
      .filter(item => item.label && item.value);
  } catch {
    return undefined;
  }
};

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать изображение'));
  reader.readAsDataURL(file);
});

interface UploadPageProps {
  onContinue: () => void;
  onImageDashboard: () => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onContinue, onImageDashboard }) => {
  const { project, uploadFiles, startAnalysis, uploadImage, buildDashboardFromImage, pipelineRunning, pipelineStep, removeFile, ensureBackendSession, sessionId } = useProject();

  const dataInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const buildDashboardButtonRef = useRef<HTMLButtonElement>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [imageState, setImageState] = useState<ImageState>('idle');
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ stage: string; pct: number; label: string } | null>(null);
  const [detectedNames, setDetectedNames] = useState<string[]>([]);
  const [analysisResult, setAnalysisResult] = useState<MockupAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [rawVisionData, setRawVisionData] = useState<{
    widgetMeta: Record<string, { title: string; type: string; color: string | null; stacked?: boolean; is_horizontal?: boolean; position?: { left: number; top: number; width: number; height: number } | null; series_colors?: string[] | null; gauge_value?: number | null; gauge_max?: number | null }>;
    kpis: Array<{ metric_name: string; value: number | null; unit: string | null; note?: string | null; sparkline?: number[]; sparkline_type?: 'bar' | 'line'; breakdown?: Array<{ label: string; value: string }>; position?: { left: number; top: number; width: number; height: number } | null; visual_type?: string; progress_max?: number | null }>;
    factDashboard: Array<{ widget_id: number; widget_title: string; widget_type: string; category: string | null; series: string | null; value: number | null }>;
    backgroundTheme: 'dark' | 'light';
  } | null>(null);

  const files = project?.files ?? [];
  const isAnalyzing = project?.status === 'analyzing';
  const isAnalyzed = project && !['empty', 'files_uploaded', 'analyzing'].includes(project.status);
  const hasImage = imageState !== 'idle';

  useEffect(() => {
    if (!previewUrl) setImageLightboxOpen(false);
  }, [previewUrl]);

  const openImageLightbox = useCallback(() => {
    if (previewUrl) setImageLightboxOpen(true);
  }, [previewUrl]);

  const closeImageLightbox = useCallback(() => {
    setImageLightboxOpen(false);
  }, []);

  // ── Data upload ────────────────────────────────────────────────────────

  // ── Image upload ───────────────────────────────────────────────────────
  const handleImageFile = useCallback((fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setDetectedNames([file.name]);
    setImageState('ready');
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisProgress(null);
    setPendingImageFile(file);

    fileToDataUrl(file)
      .then((url) => {
        setPreviewUrl(url);
        uploadImage({
          name: file.name,
          previewUrl: url,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        });
      })
      .catch((err) => {
        console.warn('[UploadPage] image preview read failed', err);
        uploadImage({
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        });
      });
  }, [uploadImage]);

  const handleAnalyzeImage = useCallback((useSessionData = false) => {
    const file = pendingImageFile;
    if (!file) return;

    setImageState('analyzing');
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisProgress(null);

    const sid = sessionId;
    const analysisPromise = (useSessionData && sid)
      ? api.analyzeImageWithData(file, sid, (stage, pct, label) => setAnalysisProgress({ stage, pct, label }))
      : api.analyzeImageStream(file, (stage, pct, label) => setAnalysisProgress({ stage, pct, label }));

    analysisPromise
      .then(async (result) => {
        const widgetMeta = result.vitrina.widget_meta;
        const byType: Record<string, { label: string; items: { title: string; confidence: number }[] }> = {};

        Object.values(widgetMeta).forEach((w) => {
          const t = w.type;
          if (!byType[t]) byType[t] = { label: chartTypeLabel(t), items: [] };
          byType[t].items.push({ title: w.title, confidence: 0.9 });
        });

        const kpiItems = result.vitrina.FactKPIs.map((k) => ({ title: k.metric_name, confidence: 0.9 }));
        if (kpiItems.length > 0) {
          byType.big_number = { label: 'KPI-карточка', items: kpiItems };
        }

        const elementsByType: MockupElementGroup[] = Object.entries(byType).map(([type, v]) => ({
          type,
          label: v.label,
          count: v.items.length,
          items: v.items,
        }));

        setAnalysisResult({
          totalElements: result.summary.charts_detected + result.summary.kpis_detected,
          kpiCount: result.summary.kpis_detected,
          chartCount: result.summary.charts_detected,
          elementsByType,
        });
        setRawVisionData({
          widgetMeta: widgetMeta,
          kpis: result.vitrina.FactKPIs.map(k => ({
            metric_name: k.metric_name,
            value: k.value,
            unit: k.unit,
            note: k.note,
            sparkline: parseSparklineJson(k.sparkline_json),
            sparkline_type: k.sparkline_type,
            breakdown: parseBreakdownJson(k.breakdown_json),
            position: k.position,
            visual_type: k.visual_type,
            progress_max: k.progress_max,
          })),
          factDashboard: result.vitrina.FactDashboard,
          backgroundTheme: 'dark',
        });
        // Load vitrina into DuckDB session so chat can query it
        const sid = await ensureBackendSession();
        if (sid) {
          await api.loadVitrina(sid, {
            FactDashboard: result.vitrina.FactDashboard as Array<Record<string, unknown>>,
            FactKPIs: result.vitrina.FactKPIs as Array<Record<string, unknown>>,
            widget_meta: result.vitrina.widget_meta as Record<string, unknown>,
          }).catch(err => console.warn('[UploadPage] vitrina load failed', err));
        }
        setImageState('done');
        setTimeout(() => {
          buildDashboardButtonRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          buildDashboardButtonRef.current?.focus();
        }, 100);
      })
      .catch((err) => {
        console.error('[UploadPage] image analysis failed', err);
        setAnalysisError(`Не удалось завершить анализ макета: ${String(err?.message ?? err)}`);
        setImageState('done');
      });
  }, [pendingImageFile, sessionId, ensureBackendSession]);

  const handleBuildDashboard = useCallback(() => {
    const detectedCount = rawVisionData
      ? Object.keys(rawVisionData.widgetMeta ?? {}).length + (rawVisionData.kpis?.length ?? 0)
      : 0;
    if (!rawVisionData || detectedCount === 0) {
      setAnalysisError(analysisError ?? 'Анализ не вернул виджеты. Дашборд не построен.');
      return;
    }
    buildDashboardFromImage(
      rawVisionData.widgetMeta,
      rawVisionData.kpis,
      rawVisionData?.factDashboard,
      rawVisionData?.backgroundTheme ?? 'dark',
    );
    setTimeout(() => onImageDashboard(), 500);
  }, [analysisError, buildDashboardFromImage, rawVisionData, onImageDashboard]);

  const handleReset = () => {
    setImageState('idle');
    setPreviewUrl(null);
    setImageLightboxOpen(false);
    setDetectedNames([]);
    setAnalysisResult(null);
    setAnalysisError(null);
    setRawVisionData(null);
    setAnalysisProgress(null);
    setPendingImageFile(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 6,
      py: 4,
      maxWidth: 680,
      mx: 'auto',
      width: '100%',
    }}>

      {/* ── IMAGE flow ──────────────────────────────────────────────────── */}
      {hasImage && (
        <Fade in>
          <Box sx={{
            width: '100%',
            bgcolor: 'rgba(var(--app-surface-alt-rgb), 0.94)',
            border: '1px solid var(--app-border)',
            borderRadius: 3,
            p: 3,
          }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
              {/* Preview */}
              {previewUrl && (
                <Box
                  component="button"
                  type="button"
                  onClick={openImageLightbox}
                  aria-label="Открыть картинку в большом размере"
                  sx={{
                  flex: { md: '0 0 46%' },
                  borderRadius: 2, overflow: 'hidden',
                  border: '1px solid var(--app-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 200,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  position: 'relative',
                  p: 0,
                  cursor: 'zoom-in',
                  font: 'inherit',
                  '&:focus-visible': {
                    outline: '2px solid var(--app-accent)',
                    outlineOffset: 3,
                  },
                }}>
                  <img src={previewUrl} alt="макет"
                    style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'contain' }} />
                  <Tooltip title="Открыть в большом размере" arrow>
                    <Box
                      sx={{
                        position: 'absolute',
                        right: 10,
                        top: 10,
                        height: 34,
                        px: 1,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.65,
                        color: 'var(--app-text)',
                        bgcolor: 'rgba(17,17,18,0.82)',
                        border: '1px solid var(--app-border)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <OpenInFullIcon sx={{ fontSize: 18 }} />
                      Увеличить
                    </Box>
                  </Tooltip>
                </Box>
              )}

              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                  <ImageIcon sx={{ fontSize: 22, color: 'var(--app-violet)' }} />
                  <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>
                    Загружена картинка
                  </Typography>
                </Box>
                <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.88rem', mb: 2, wordBreak: 'break-all' }}>
                  {detectedNames.join(', ')}
                </Typography>

                {/* Ready — waiting for user to start analysis */}
                {imageState === 'ready' && (
                  <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.85rem', mb: 2 }}>
                    Картинка загружена. Нажмите кнопку ниже, чтобы распознать элементы дашборда.
                  </Typography>
                )}

                {/* Analyzing */}
                {imageState === 'analyzing' && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                      <AutoAwesomeIcon sx={{
                        fontSize: 18, color: 'var(--app-violet)',
                        animation: 'spin 2s linear infinite',
                        '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
                      }} />
                      <Typography sx={{ color: 'var(--app-text)', fontWeight: 600, fontSize: '0.95rem' }}>
                        Анализируем макет…
                      </Typography>
                      {analysisProgress && (
                        <Typography sx={{ ml: 'auto', color: 'var(--app-violet)', fontWeight: 700, fontSize: '0.88rem' }}>
                          {analysisProgress.pct}%
                        </Typography>
                      )}
                    </Box>
                    <LinearProgress
                      variant={analysisProgress ? 'determinate' : 'indeterminate'}
                      value={analysisProgress?.pct ?? 0}
                      sx={{
                        height: 4, borderRadius: 2,
                        bgcolor: 'rgba(var(--app-violet-rgb), 0.1)',
                        '& .MuiLinearProgress-bar': { bgcolor: 'var(--app-violet)' },
                      }}
                    />
                    {/* Stage list */}
                    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                      {[
                        { stage: 'ocr',       pct: 30, label: 'OCR — распознавание текста' },
                        { stage: 'detail',    pct: 60, label: 'Детальный анализ элементов' },
                        { stage: 'tables',    pct: 75, label: 'Извлечение таблиц' },
                        { stage: 'normalize', pct: 90, label: 'Нормализация данных' },
                        { stage: 'vitrina',   pct: 96, label: 'Генерация витрины данных' },
                      ].map(({ stage, pct, label }) => {
                        const currentPct = analysisProgress?.pct ?? 0;
                        const done = currentPct >= pct;
                        const active = !done && analysisProgress && analysisProgress.pct >= pct - 30;
                        return (
                          <Box key={stage} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {done ? (
                              <CheckCircleOutlineIcon sx={{ fontSize: 14, color: '#3fb950', flexShrink: 0 }} />
                            ) : (
                              <Box sx={{
                                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                                border: '1.5px solid',
                                borderColor: active ? 'var(--app-violet)' : 'rgba(255,255,255,0.18)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {active && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--app-violet)' }} />}
                              </Box>
                            )}
                            <Typography sx={{
                              fontSize: '0.78rem',
                              color: done ? 'var(--app-text)' : active ? 'var(--app-subtle-text)' : 'rgba(255,255,255,0.25)',
                              fontWeight: done || active ? 500 : 400,
                            }}>
                              {label}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </>
                )}

                {/* Done */}
                {imageState === 'done' && analysisResult && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
                      <AutoAwesomeIcon sx={{ fontSize: 17, color: 'var(--app-violet)' }} />
                      <Typography sx={{ color: 'var(--app-text)', fontWeight: 700, fontSize: '0.92rem' }}>
                        Найденные элементы
                      </Typography>
                      <Chip label={`${analysisResult.totalElements} шт.`} size="small" sx={{
                        ml: 'auto', height: 20,
                        bgcolor: 'rgba(var(--app-violet-rgb), 0.14)',
                        color: 'var(--app-violet)', fontWeight: 700, fontSize: '0.74rem',
                      }} />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip icon={<SpeedIcon sx={{ fontSize: 14, color: 'var(--app-accent) !important' }} />}
                        label={`${analysisResult.kpiCount} KPI`} size="small"
                        sx={{ color: 'var(--app-text)', bgcolor: 'rgba(255,255,255,0.04)', fontWeight: 600, fontSize: '0.78rem' }} />
                      <Chip icon={<BarChartIcon sx={{ fontSize: 14, color: 'var(--app-info) !important' }} />}
                        label={`${analysisResult.chartCount} графиков`} size="small"
                        sx={{ color: 'var(--app-text)', bgcolor: 'rgba(255,255,255,0.04)', fontWeight: 600, fontSize: '0.78rem' }} />
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', mb: 2.5 }}>
                      {analysisResult.elementsByType.map((group, index) => {
                        const icon = CHART_TYPE_ICONS[group.type] ?? <ViewModuleIcon sx={{ fontSize: 18 }} />;
                        const color = CHART_TYPE_COLORS[group.type] ?? '#8b949e';
                        return (
                          <Box key={group.type} sx={{
                            display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 1.25,
                            borderBottom: index < analysisResult.elementsByType.length - 1 ? '1px solid var(--app-border)' : 'none',
                          }}>
                            <Box sx={{ color, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {icon}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                                <Typography sx={{ color: 'var(--app-text)', fontWeight: 600, fontSize: '0.82rem' }}>
                                  {group.label}
                                </Typography>
                                <Typography sx={{ color, fontWeight: 700, fontSize: '0.74rem' }}>
                                  {group.count}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {group.items.map((item, idx) => (
                                  <Chip key={idx} label={item.title} size="small" sx={{
                                    height: 18, fontSize: '0.68rem',
                                    bgcolor: 'rgba(255,255,255,0.03)',
                                    color: 'var(--app-subtle-text)', borderRadius: 1,
                                  }} />
                                ))}
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </>
                )}

                {imageState === 'done' && !analysisResult && analysisError && (
                  <Box sx={{
                    border: '1px solid rgba(219,18,55,0.4)',
                    borderRadius: 2,
                    p: 1.5,
                    mb: 2,
                    bgcolor: 'rgba(219,18,55,0.08)',
                  }}>
                    <Typography sx={{ color: '#ff8f8f', fontWeight: 700, fontSize: '0.86rem', mb: 0.5 }}>
                      Ошибка анализа изображения
                    </Typography>
                    <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.8rem' }}>
                      {analysisError}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1, alignItems: 'center', width: '100%' }}>
              {imageState === 'ready' && (
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {files.length > 0 && sessionId && (
                    <Button variant="contained" size="large"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={() => handleAnalyzeImage(true)}
                      sx={{
                        px: 3, py: 1.25, fontWeight: 800, fontSize: '0.95rem',
                        background: 'linear-gradient(135deg, #1a6b3a 0%, #2ea55a 100%)',
                        boxShadow: 'none',
                        '&:hover': { boxShadow: '0 4px 20px rgba(46,165,90,0.35)' },
                      }}
                    >
                      Построить по данным файлов
                    </Button>
                  )}
                  <Button variant="contained" size="large"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => handleAnalyzeImage(false)}
                    sx={{
                      px: 3, py: 1.25, fontWeight: 800, fontSize: '0.95rem',
                      background: 'linear-gradient(135deg, var(--app-accent-strong) 0%, var(--app-accent) 100%)',
                      boxShadow: 'none',
                      '&:hover': { boxShadow: '0 4px 20px rgba(var(--app-accent-rgb), 0.3)' },
                    }}
                  >
                    {files.length > 0 ? 'Только по макету' : 'Анализировать'}
                  </Button>
                </Box>
              )}
              {imageState === 'done' && (
                <Button variant="contained" size="large"
                  ref={buildDashboardButtonRef}
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleBuildDashboard}
                  disabled={!rawVisionData || (Object.keys(rawVisionData.widgetMeta ?? {}).length + (rawVisionData.kpis?.length ?? 0)) === 0}
                  sx={{
                    px: 4, py: 1.25, fontWeight: 800, fontSize: '0.95rem',
                    background: 'linear-gradient(135deg, #7b2d8b 0%, #ab47bc 100%)',
                    boxShadow: 'none',
                    '&:hover': { boxShadow: '0 4px 20px rgba(171,71,188,0.35)' },
                    '&.Mui-disabled': { opacity: 0.45, color: 'rgba(255,255,255,0.7)' },
                  }}
                >
                  Построить дашборд
                </Button>
              )}
              {(imageState === 'ready' || imageState === 'done') && (
                <Button variant="text" onClick={handleReset}
                  sx={{ color: 'var(--app-subtle-text)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  Загрузить другой
                </Button>
              )}
            </Box>
          </Box>
        </Fade>
      )}

      {/* ── DATA flow ───────────────────────────────────────────────────── */}
      {!hasImage && (
        <Fade in key="data">
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>

            {files.length === 0 && (
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--app-text)', mb: 1 }}>
                  Загрузите данные
                </Typography>
                <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.92rem' }}>
                  Excel, CSV, JSON или картинку с макетом дашборда
                </Typography>
              </Box>
            )}

            {/* Buttons */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="outlined" size="large" startIcon={<CloudUploadIcon />}
                onClick={() => dataInputRef.current?.click()}
                sx={{ color: 'var(--app-text)', borderColor: 'var(--app-border)', borderRadius: 2.5, px: 3, '&:hover': { borderColor: 'var(--app-accent)' } }}>
                {files.length > 0 ? 'Добавить файлы' : 'Загрузить файлы'}
              </Button>
              {!isAnalyzed && (
                <Button variant="outlined" size="large" startIcon={<LinkIcon />}
                  onClick={() => setShowUrlInput(v => !v)}
                  sx={{ color: 'var(--app-text)', borderColor: 'var(--app-border)', borderRadius: 2.5, px: 3, '&:hover': { borderColor: 'var(--app-accent)' } }}>
                  Вставить ссылку
                </Button>
              )}
              <input ref={dataInputRef} type="file" multiple accept=".csv,.xlsx,.xls,.tsv,.json,.png,.jpg,.jpeg,.pdf"
                style={{ display: 'none' }} onChange={async e => {
                  const input = e.currentTarget;
                  const fileList = input.files;
                  const f = Array.from(fileList ?? []);
                  console.info('[UploadPage] file input change', {
                    count: f.length,
                    names: f.map(file => file.name),
                  });
                  if (f.length === 1 && f[0].type.startsWith('image/')) {
                    handleImageFile(fileList);
                  } else if (f.length > 0) {
                    console.info('[UploadPage] calling uploadFiles...');
                    try {
                      await uploadFiles(f);
                      console.info('[UploadPage] uploadFiles done');
                    } catch (err) {
                      console.error('[UploadPage] uploadFiles threw:', err);
                    }
                  }
                  input.value = '';
                }} />
            </Box>

            {/* URL input */}
            <Collapse in={showUrlInput} sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', gap: 1, maxWidth: 480, mx: 'auto' }}>
                <TextField size="small" fullWidth placeholder="https://example.com/data.xlsx"
                  value={urlValue} onChange={e => setUrlValue(e.target.value)}
                  InputProps={{ startAdornment: <LinkIcon sx={{ mr: 1, color: 'var(--app-subtle-text)', fontSize: 18 }} /> }}
                />
                <Button variant="contained" size="small" disabled={!urlValue.trim()}
                  sx={{ whiteSpace: 'nowrap', px: 2.5 }}>
                  Загрузить
                </Button>
              </Box>
            </Collapse>

            {/* File list */}
            {files.length > 0 && (
              <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {files.map((file, idx) => (
                  <Box key={idx} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 2, py: 1.25, borderRadius: 2,
                    bgcolor: 'rgba(var(--app-surface-alt-rgb), 0.7)',
                    border: '1px solid var(--app-border)',
                  }}>
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: 'var(--app-subtle-text)', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--app-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.7rem', color: 'var(--app-subtle-text)' }}>{file.size}</Typography>
                        {file.sheets.map(sheet => (
                          <Chip key={sheet.name} label={`${sheet.name}: ${sheet.rows.toLocaleString('ru')} строк`} size="small"
                            sx={{ height: 17, fontSize: '0.64rem', bgcolor: 'rgba(var(--app-accent-rgb), 0.08)', color: 'var(--app-subtle-text)', border: 'none' }} />
                        ))}
                      </Box>
                    </Box>
                    {file.status === 'done' && <CheckCircleOutlineIcon sx={{ fontSize: 16, color: '#3fb950', flexShrink: 0 }} />}
                    <IconButton size="small" aria-label={`Удалить файл ${file.name}`} onClick={() => removeFile(idx)}
                      sx={{ flexShrink: 0, color: 'var(--app-subtle-text)', '&:hover': { color: '#f85149' } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {/* Image mockup upload button (when files are loaded) */}
            {files.length > 0 && (
              <>
                <Divider sx={{ width: '100%', borderColor: 'var(--app-border)', my: 0.5 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)', px: 1 }}>или</Typography>
                </Divider>
                <Button variant="outlined" size="large" startIcon={<ImageIcon />}
                  onClick={() => imageInputRef.current?.click()}
                  sx={{ color: 'var(--app-violet)', borderColor: 'rgba(167,139,250,0.35)', borderRadius: 2.5, px: 3, '&:hover': { borderColor: 'var(--app-violet)', bgcolor: 'rgba(167,139,250,0.06)' } }}>
                  Загрузить макет и построить по данным
                </Button>
                <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }} onChange={e => {
                    const input = e.currentTarget;
                    handleImageFile(input.files);
                    input.value = '';
                  }} />
              </>
            )}

            {/* Analyze CTA */}
            {files.length > 0 && !isAnalyzed && (
              <Button variant="contained" size="large" fullWidth
                startIcon={isAnalyzing ? undefined : <AutoAwesomeIcon />}
                onClick={startAnalysis}
                disabled={isAnalyzing || pipelineRunning}
                sx={{
                  py: 1.5, fontSize: '0.95rem', borderRadius: 2.5,
                  background: 'linear-gradient(135deg, var(--app-accent-strong) 0%, var(--app-accent) 100%)',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: '0 4px 20px rgba(var(--app-accent-rgb), 0.3)' },
                }}
              >
                {isAnalyzing
                  ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={16} sx={{ color: '#fff' }} />{pipelineStep || 'Анализируем...'}</Box>
                  : 'Анализировать данные'}
              </Button>
            )}

            {isAnalyzed && (
              <Button variant="contained" size="large" fullWidth onClick={onContinue}
                sx={{
                  py: 1.5, fontSize: '0.95rem', borderRadius: 2.5,
                  background: 'linear-gradient(135deg, var(--app-accent-strong) 0%, var(--app-accent) 100%)',
                  boxShadow: 'none',
                }}
              >
                Перейти к данным →
              </Button>
            )}
          </Box>
        </Fade>
      )}
    </Box>

    <Modal
      open={imageLightboxOpen}
      onClose={closeImageLightbox}
      aria-labelledby="upload-image-preview-modal-title"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 1.5, md: 3 },
        bgcolor: 'rgba(0,0,0,0.76)',
      }}
    >
      <Box
        sx={{
          width: 'min(96vw, 1440px)',
          height: 'min(92vh, 960px)',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(20,20,22,0.98)',
          border: '1px solid var(--app-border-strong)',
          borderRadius: 2,
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 52,
            px: 2,
            borderBottom: '1px solid var(--app-border)',
            flexShrink: 0,
          }}
        >
          <ImageIcon sx={{ fontSize: 20, color: 'var(--app-violet)' }} />
          <Typography
            id="upload-image-preview-modal-title"
            sx={{ color: 'var(--app-text)', fontWeight: 700, fontSize: '0.95rem', minWidth: 0, flex: 1 }}
            noWrap
          >
            {detectedNames[0] || 'Загруженная картинка'}
          </Typography>
          <Tooltip title="Закрыть" arrow>
            <IconButton
              aria-label="Закрыть полноразмерное изображение"
              onClick={closeImageLightbox}
              sx={{
                color: 'var(--app-subtle-text)',
                '&:hover': { color: 'var(--app-text)', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box
          onClick={closeImageLightbox}
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 1, md: 2 },
            overflow: 'auto',
            cursor: 'zoom-out',
          }}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Загруженная картинка в большом размере"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                cursor: 'default',
              }}
            />
          )}
        </Box>
      </Box>
    </Modal>
    </>
  );
};

export default UploadPage;

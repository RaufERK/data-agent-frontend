import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, Button, CircularProgress, Fade, Chip, LinearProgress, Tooltip, TextField, Collapse, IconButton, Modal } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import SpeedIcon from '@mui/icons-material/Speed';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { useProject } from '../../store/ProjectContext';
import { api } from '../../api';
import {
  UI,
  buildMockupAnalysisResult,
  detectFileType,
  flatPanelSx,
  imagePreviewFrameSx,
  type MockupAnalysisResult,
  type UploadState,
} from './canvasHelpers';
import type { MockupElementStats } from '../../types';

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать изображение'));
  reader.readAsDataURL(file);
});

const CHART_TYPE_ICONS: Record<string, React.ReactNode> = {
  big_number: <SpeedIcon sx={{ fontSize: 18 }} />,
  bar: <BarChartIcon sx={{ fontSize: 18 }} />,
  bar_horizontal: <BarChartIcon sx={{ fontSize: 18, transform: 'rotate(90deg)' }} />,
  line: <ShowChartIcon sx={{ fontSize: 18 }} />,
  area: <ShowChartIcon sx={{ fontSize: 18 }} />,
  pie: <PieChartIcon sx={{ fontSize: 18 }} />,
  donut: <DonutLargeIcon sx={{ fontSize: 18 }} />,
  table: <TableChartIcon sx={{ fontSize: 18 }} />,
};

const CHART_TYPE_COLORS: Record<string, string> = {
  big_number: 'var(--app-accent)',
  bar: 'var(--app-info)',
  bar_horizontal: 'var(--app-info)',
  line: 'var(--app-warning)',
  area: 'var(--app-warning)',
  pie: 'var(--app-violet)',
  donut: 'var(--app-violet)',
  table: 'var(--app-subtle-text)',
};

const Canvas: React.FC = () => {
  const {
    project, uploadFiles, uploadImage, buildDashboard,
    goToPetalStep, openPetal, clearData, dataActionRef,
  } = useProject();

  const [state, setState] = useState<UploadState>('idle');
  const [detectedNames, setDetectedNames] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [previewData, setPreviewData] = useState<string[][] | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MockupAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDashboard = !!project?.dashboardBuilt;

  useEffect(() => {
    if (!previewUrl) setImageLightboxOpen(false);
  }, [previewUrl]);

  const openImageLightbox = useCallback(() => {
    if (previewUrl) setImageLightboxOpen(true);
  }, [previewUrl]);

  const closeImageLightbox = useCallback(() => {
    setImageLightboxOpen(false);
  }, []);

  const renderImagePreview = useCallback((maxHeight: number) => {
    if (!previewUrl) return null;

    return (
      <Box
        component="button"
        type="button"
        onClick={openImageLightbox}
        aria-label="Открыть картинку в большом размере"
        sx={{
          ...imagePreviewFrameSx,
          position: 'relative',
          p: 0,
          border: 0,
          cursor: 'zoom-in',
          font: 'inherit',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 1,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0)',
            transition: 'box-shadow 160ms ease, background 160ms ease',
            pointerEvents: 'none',
          },
          '&:hover::after, &:focus-visible::after': {
            boxShadow: `inset 0 0 0 1px ${UI.borderStrong}`,
            background: 'rgba(255,255,255,0.025)',
          },
          '&:hover .preview-open-icon, &:focus-visible .preview-open-icon': {
            opacity: 1,
            transform: 'translateY(0)',
          },
          '&:focus-visible': {
            outline: `2px solid ${UI.accent}`,
            outlineOffset: 3,
          },
        }}
      >
        <img
          src={previewUrl}
          alt="preview"
          style={{ display: 'block', width: '100%', maxHeight, objectFit: 'contain' }}
        />
        <Tooltip title="Открыть в большом размере" arrow>
          <Box
            className="preview-open-icon"
            sx={{
              position: 'absolute',
              right: 10,
              top: 10,
              minWidth: 34,
              height: 34,
              px: 1,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.65,
              color: UI.text,
              bgcolor: 'rgba(17,17,18,0.82)',
              border: `1px solid ${UI.border}`,
              opacity: 1,
              transform: 'translateY(0)',
              transition: 'opacity 160ms ease, transform 160ms ease',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <OpenInFullIcon sx={{ fontSize: 18 }} />
            Увеличить
          </Box>
        </Tooltip>
      </Box>
    );
  }, [openImageLightbox, previewUrl]);

  const handleLoadDemoScenario = useCallback(() => {
    setState('uploading');
    setDetectedNames([
      'crm_requests_export.xlsx',
      'access_matrix.xlsx',
      'org_structure.xlsx',
      'organizations_registry.xlsx',
    ]);
    setPreviewUrl(null);
    setPreviewData(null);

    setTimeout(() => {
      uploadFiles();
      setState('detected_data');
    }, 500);
  }, [uploadFiles]);

  const processFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;

    setState('uploading');
    setDetectedNames(files.map(f => f.name));
    setPreviewUrl(null);
    setPreviewData(null);

    // Determine dominant type: if any image → image flow, otherwise data
    const imageFiles = files.filter(f => detectFileType(f.name) === 'image');
    const dataFiles = files.filter(f => detectFileType(f.name) !== 'image');
    const dominantKind = imageFiles.length > 0 && dataFiles.length === 0 ? 'image' : dataFiles.length > 0 && imageFiles.length === 0 ? 'data' : 'mixed';

    // Build preview for first relevant file
    const firstImage = imageFiles[0];
    const firstCsv = dataFiles.find(f => f.name.toLowerCase().endsWith('.csv'));
    let imagePreviewUrl: string | undefined;
    let imagePreviewPromise: Promise<string> | undefined;

    if (firstImage && firstImage.type.startsWith('image/')) {
      imagePreviewPromise = fileToDataUrl(firstImage);
      imagePreviewPromise
        .then((url) => {
          imagePreviewUrl = url;
          setPreviewUrl(url);
        })
        .catch((err) => console.warn('[Canvas] image preview read failed', err));
    }
    if (firstCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          const lines = text.split('\n').filter(l => l.trim()).slice(0, 6);
          const rows = lines.map(l => l.split(',').map(c => c.trim().slice(0, 20)));
          setPreviewData(rows);
        }
      };
      reader.readAsText(firstCsv.slice(0, 4096));
    }

    setTimeout(async () => {
      if (imagePreviewPromise) {
        imagePreviewUrl = await imagePreviewPromise.catch(() => undefined);
      }
      if (dominantKind === 'image') {
        uploadImage(firstImage ? {
          name: firstImage.name,
          previewUrl: imagePreviewUrl,
          size: `${(firstImage.size / (1024 * 1024)).toFixed(1)} MB`,
        } : undefined);
        setState('detected_image');
        setTimeout(() => {
          setState('analyzing_image');
          api.analyzeImage(firstImage).then(result => {
            setAnalysisResult(buildMockupAnalysisResult(result));
            setState('analyzed_image');
          }).catch(err => {
            console.error('Image analysis failed:', err);
            setAnalysisError(String(err?.message ?? err));
            setState('analyzed_image');
          });
        }, 800);
      } else if (dominantKind === 'mixed') {
        uploadImage(firstImage ? {
          name: firstImage.name,
          previewUrl: imagePreviewUrl,
          size: `${(firstImage.size / (1024 * 1024)).toFixed(1)} MB`,
        } : undefined);
        uploadFiles();
        setState('detected_mixed');
        setTimeout(() => {
          setState('analyzing_mixed');
          api.analyzeImage(firstImage).then(result => {
            setAnalysisResult(buildMockupAnalysisResult(result));
            setState('analyzed_mixed');
          }).catch(err => {
            console.error('Image analysis failed:', err);
            setAnalysisError(String(err?.message ?? err));
            setState('analyzed_mixed');
          });
        }, 800);
      } else {
        // data only
        uploadFiles();
        setState('detected_data');
      }
    }, 1200);
  }, [uploadFiles, uploadImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) processFiles(droppedFiles);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) processFiles(selectedFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFiles]);

  const handleBuildDashboard = useCallback(() => {
    setState('building_dashboard');
    buildDashboard();
    setTimeout(() => {
      setState('done');
      goToPetalStep('dashboard', 0);
    }, 2200);
  }, [buildDashboard, goToPetalStep]);

  const handleGoToData = useCallback(() => {
    setState('idle');
    openPetal('data');
    if ((project?.dashboardCharts ?? []).length > 0) {
      setTimeout(() => dataActionRef.current?.('view:vitrina'), 150);
    }
  }, [openPetal, project?.dashboardCharts, dataActionRef]);

  const handleReset = useCallback(async () => {
    setState('idle');
    setPreviewUrl(null);
    setImageLightboxOpen(false);
    setPreviewData(null);
    setDetectedNames([]);
    setAnalysisResult(null);
    await clearData();
  }, [clearData]);

  // Already has dashboard
  if (hasDashboard) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, gap: 3 }}>
        <DashboardIcon sx={{ fontSize: 64, color: UI.accent }} />
        <Typography variant="h5" sx={{ color: UI.text, fontWeight: 700 }}>Дашборд готов!</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={() => goToPetalStep('dashboard', 0)}>
            Открыть дашборд
          </Button>
          <Button variant="outlined" onClick={handleReset}
            sx={{ color: UI.muted, borderColor: UI.border }}>
            Загрузить ещё
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flex: 1, minHeight: 0, gap: 3, px: 2,
      }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.pdf,.csv,.xlsx,.xls,.tsv,.json"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* Idle state: drop zone */}
      {state === 'idle' && (
        <Fade in>
          <Paper
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              width: '100%', maxWidth: 600, p: 6, textAlign: 'center',
              borderRadius: 6,
              border: `2px dashed ${dragOver ? UI.accent : UI.border}`,
              bgcolor: dragOver ? UI.accentSoftStrong : UI.surfaceAlt,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': { borderColor: UI.accent, bgcolor: UI.accentSoft },
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 64, color: dragOver ? UI.accent : UI.borderStrong, mb: 2 }} />
            <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700, mb: 1 }}>
              Перетащите файлы или нажмите для загрузки
            </Typography>
            <Typography sx={{ color: UI.muted, mb: 2, fontSize: '0.9rem' }}>
              Для текущего демо нужен сценарий CRM + Excel-справочники. Его можно загрузить одной кнопкой ниже.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<StorageIcon />}
                onClick={(e) => { e.stopPropagation(); handleLoadDemoScenario(); }}
              >
                Загрузить демо-сценарий
              </Button>
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                sx={{ color: UI.text, borderColor: UI.border }}
              >
                Выбрать файлы
              </Button>
              <Button
                variant="outlined"
                startIcon={<LinkIcon />}
                onClick={(e) => { e.stopPropagation(); setShowUrlInput(prev => !prev); }}
                sx={{ color: UI.text, borderColor: UI.border }}
              >
                Вставить ссылку
              </Button>
            </Box>
            <Typography sx={{ color: UI.muted, fontSize: '0.8rem', mb: showUrlInput ? 1.5 : 0 }}>
              Кнопка выше автоматически подтянет `CRM-выгрузку` и `3 Excel-справочника` для нового GenBI сценария.
            </Typography>
            <Collapse in={showUrlInput}>
              <Box
                onClick={e => e.stopPropagation()}
                sx={{ display: 'flex', gap: 1, mt: 2, maxWidth: 480, mx: 'auto' }}
              >
                <TextField
                  size="small"
                  fullWidth
                  placeholder="https://example.com/data.xlsx"
                  value={urlValue}
                  onChange={e => setUrlValue(e.target.value)}
                  InputProps={{
                    startAdornment: <LinkIcon sx={{ mr: 1, color: UI.muted, fontSize: 18 }} />,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255,255,255,0.04)',
                      borderRadius: 1.5,
                      borderColor: UI.border,
                    },
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={!urlValue.trim()}
                  sx={{ whiteSpace: 'nowrap', px: 2.5 }}
                >
                  Загрузить
                </Button>
              </Box>
            </Collapse>
          </Paper>
        </Fade>
      )}

      {/* Uploading */}
      {state === 'uploading' && (
        <Fade in>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ color: UI.accent, mb: 2 }} />
            <Typography sx={{ color: UI.text, fontWeight: 600 }}>
              Загружаю {detectedNames.length > 1 ? `${detectedNames.length} файлов` : detectedNames[0]}...
            </Typography>
          </Box>
        </Fade>
      )}

      {/* Detected IMAGE → short flash before analysis */}
      {state === 'detected_image' && (
        <Fade in>
          <Paper sx={flatPanelSx}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
              {previewUrl && (
                <Box sx={{ flex: { md: '0 0 46%' } }}>
                  {renderImagePreview(320)}
                </Box>
              )}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                  <ImageIcon sx={{ fontSize: 24, color: 'var(--app-violet)' }} />
                  <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700 }}>
                    Загружена картинка
                  </Typography>
                </Box>
                <Typography sx={{ color: UI.muted, mb: 2, fontSize: '0.9rem', wordBreak: 'break-word' }}>
                  {detectedNames.join(', ')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={22} sx={{ color: 'var(--app-violet)' }} />
                  <Typography sx={{ color: UI.text, fontWeight: 600 }}>
                    Подготавливаю анализ макета…
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Analyzing IMAGE → spinner + progress */}
      {state === 'analyzing_image' && (
        <Fade in>
          <Paper sx={flatPanelSx}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
              {previewUrl && (
                <Box sx={{ flex: { md: '0 0 46%' } }}>
                  {renderImagePreview(340)}
                </Box>
              )}

              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                  <ImageIcon sx={{ fontSize: 24, color: 'var(--app-violet)' }} />
                  <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700 }}>
                    Загружена картинка
                  </Typography>
                </Box>
                <Typography sx={{ color: UI.muted, mb: 2, fontSize: '0.9rem', wordBreak: 'break-word' }}>
                  {detectedNames.join(', ')}
                </Typography>

                <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <AutoAwesomeIcon sx={{
                    fontSize: 20, color: 'var(--app-violet)',
                    animation: 'spin 2s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }} />
                  <Typography sx={{ color: UI.text, fontWeight: 600, fontSize: '0.95rem' }}>
                    Анализируем макет…
                  </Typography>
                </Box>
                <LinearProgress sx={{
                  height: 4,
                  bgcolor: 'rgba(var(--app-violet-rgb), 0.1)',
                  '& .MuiLinearProgress-bar': { bgcolor: 'var(--app-violet)' },
                }} />
                <Typography sx={{ color: UI.muted, fontSize: '0.82rem', mt: 1 }}>
                  Распознаём элементы: KPI, графики, таблицы…
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Analyzed IMAGE → error state */}
      {state === 'analyzed_image' && !analysisResult && analysisError && (
        <Fade in>
          <Paper sx={{ ...flatPanelSx, borderColor: 'rgba(219,18,55,0.4)' }}>
            <Typography variant="h6" sx={{ color: '#ff6b6b', mb: 1 }}>Ошибка анализа изображения</Typography>
            <Typography sx={{ color: UI.muted, mb: 2, fontSize: '0.88rem' }}>{analysisError}</Typography>
            <Button variant="outlined" onClick={handleReset} sx={{ color: UI.muted, borderColor: UI.border }}>
              Попробовать снова
            </Button>
          </Paper>
        </Fade>
      )}

      {/* Analyzed IMAGE → stats + build button */}
      {state === 'analyzed_image' && analysisResult && (
        <Fade in>
          <Paper sx={flatPanelSx}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
              {previewUrl && (
                <Box sx={{ flex: { md: '0 0 46%' } }}>
                  {renderImagePreview(360)}
                </Box>
              )}

              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
                  <ImageIcon sx={{ fontSize: 24, color: 'var(--app-violet)' }} />
                  <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700 }}>
                    Загружена картинка
                  </Typography>
                </Box>
                <Typography sx={{ color: UI.muted, fontSize: '0.9rem', mb: 2, wordBreak: 'break-word' }}>
                  {detectedNames.join(', ')}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 18, color: 'var(--app-violet)' }} />
                  <Typography sx={{ color: UI.text, fontWeight: 700, fontSize: '0.95rem' }}>
                    Найденные элементы
                  </Typography>
                  <Chip
                    label={`${analysisResult.totalElements} шт.`}
                    size="small"
                    sx={{
                      ml: 'auto',
                      height: 22,
                      bgcolor: 'rgba(var(--app-violet-rgb), 0.14)',
                      color: 'var(--app-violet)',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<SpeedIcon sx={{ fontSize: 15, color: `${UI.accent} !important` }} />}
                    label={`${analysisResult.kpiCount} KPI`}
                    size="small"
                    sx={{ color: UI.text, bgcolor: 'rgba(255,255,255,0.04)', fontWeight: 600, fontSize: '0.8rem' }}
                  />
                  <Chip
                    icon={<BarChartIcon sx={{ fontSize: 15, color: `var(--app-info) !important` }} />}
                    label={`${analysisResult.chartCount} графиков`}
                    size="small"
                    sx={{ color: UI.text, bgcolor: 'rgba(255,255,255,0.04)', fontWeight: 600, fontSize: '0.8rem' }}
                  />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', mb: 3 }}>
                  {analysisResult.elementsByType.map((group: MockupElementStats, index: number) => {
                    const icon = CHART_TYPE_ICONS[group.type] || <ViewModuleIcon sx={{ fontSize: 18 }} />;
                    const color = CHART_TYPE_COLORS[group.type] || '#8b949e';
                    return (
                      <Box key={group.type} sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.25,
                        py: 1.25,
                        borderBottom: index < analysisResult.elementsByType.length - 1 ? `1px solid ${UI.border}` : 'none',
                      }}>
                        <Box sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28,
                          color,
                          flexShrink: 0, mt: 0.1,
                        }}>
                          {icon}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                            <Typography sx={{ color: UI.text, fontWeight: 600, fontSize: '0.84rem' }}>
                              {group.label}
                            </Typography>
                            <Typography sx={{ color, fontWeight: 700, fontSize: '0.75rem' }}>
                              {group.count}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {group.items.map((item, idx) => (
                              <Tooltip
                                key={idx}
                                title={`Уверенность: ${Math.round(item.confidence * 100)}%`}
                                arrow placement="top"
                              >
                                <Chip
                                  label={item.title}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.72rem',
                                    bgcolor: 'rgba(255,255,255,0.03)',
                                    color: UI.muted,
                                    cursor: 'default',
                                    borderRadius: 1,
                                  }}
                                />
                              </Tooltip>
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained" size="large" startIcon={<AutoAwesomeIcon />}
                onClick={handleBuildDashboard}
                sx={{ px: 4, py: 1.5, fontWeight: 800, fontSize: '1rem' }}
              >
                ПОСТРОИТЬ ДАШБОРД
              </Button>
              <Button variant="text" onClick={handleReset}
                sx={{ color: UI.muted, bgcolor: 'rgba(255,255,255,0.03)' }}>
                Загрузить другой
              </Button>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Detected MIXED (image + data) → flash before analysis */}
      {state === 'detected_mixed' && (
        <Fade in>
          <Paper sx={flatPanelSx}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
              {previewUrl && (
                <Box sx={{ flex: { md: '0 0 46%' } }}>
                  {renderImagePreview(320)}
                </Box>
              )}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                  <ImageIcon sx={{ fontSize: 24, color: 'var(--app-violet)' }} />
                  <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700 }}>
                    Макет + данные
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                  {detectedNames.map((name, i) => {
                    const isImg = detectFileType(name) === 'image';
                    return (
                      <Chip key={i} size="small"
                        icon={isImg
                          ? <ImageIcon sx={{ fontSize: 14, color: 'var(--app-violet) !important' }} />
                          : <StorageIcon sx={{ fontSize: 14, color: `${UI.accent} !important` }} />}
                        label={name}
                        sx={{ fontSize: '0.76rem', color: UI.muted, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 }}
                      />
                    );
                  })}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={22} sx={{ color: 'var(--app-violet)' }} />
                  <Typography sx={{ color: UI.text, fontWeight: 600 }}>
                    Подготавливаю анализ…
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Analyzing MIXED → spinner + progress */}
      {state === 'analyzing_mixed' && (
        <Fade in>
          <Paper sx={flatPanelSx}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
              {previewUrl && (
                <Box sx={{ flex: { md: '0 0 46%' } }}>
                  {renderImagePreview(340)}
                </Box>
              )}
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                  <ImageIcon sx={{ fontSize: 24, color: 'var(--app-violet)' }} />
                  <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700 }}>
                    Макет + данные
                  </Typography>
                </Box>

                <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <AutoAwesomeIcon sx={{
                    fontSize: 20, color: 'var(--app-violet)',
                    animation: 'spin 2s linear infinite',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }} />
                  <Typography sx={{ color: UI.text, fontWeight: 600, fontSize: '0.95rem' }}>
                    Анализируем макет и данные…
                  </Typography>
                </Box>
                <LinearProgress sx={{
                  height: 4,
                  bgcolor: 'rgba(var(--app-violet-rgb), 0.1)',
                  '& .MuiLinearProgress-bar': { bgcolor: 'var(--app-violet)' },
                }} />
                <Typography sx={{ color: UI.muted, fontSize: '0.82rem', mt: 1 }}>
                  Распознаём элементы макета и сопоставляем с данными…
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Analyzed MIXED → mockup results + data info + actions */}
      {state === 'analyzed_mixed' && analysisResult && (
        <Fade in>
          <Paper sx={{ ...flatPanelSx, maxWidth: 1060 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'stretch' }}>
              {/* Left: image preview */}
              {previewUrl && (
                <Box sx={{ flex: { md: '0 0 38%' } }}>
                  {renderImagePreview(340)}
                </Box>
              )}

              {/* Right: analysis + data */}
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Mockup analysis header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 20, color: 'var(--app-violet)' }} />
                  <Typography sx={{ color: UI.text, fontWeight: 700, fontSize: '0.95rem' }}>
                    Распознанные элементы
                  </Typography>
                  <Chip
                    label={`${analysisResult.totalElements} шт.`}
                    size="small"
                    sx={{
                      ml: 'auto', height: 22,
                      bgcolor: 'rgba(var(--app-violet-rgb), 0.14)',
                      color: 'var(--app-violet)',
                      fontWeight: 700, fontSize: '0.78rem',
                    }}
                  />
                </Box>

                {/* Compact element chips */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {analysisResult.elementsByType.map((group: MockupElementStats) => {
                    const icon = CHART_TYPE_ICONS[group.type] || <ViewModuleIcon sx={{ fontSize: 15 }} />;
                    const color = CHART_TYPE_COLORS[group.type] || '#8b949e';
                    return (
                      <Chip
                        key={group.type}
                        icon={<Box sx={{ display: 'flex', color: `${color} !important` }}>{icon}</Box>}
                        label={`${group.label} × ${group.count}`}
                        size="small"
                        sx={{ color: UI.text, bgcolor: 'rgba(255,255,255,0.04)', fontWeight: 600, fontSize: '0.78rem' }}
                      />
                    );
                  })}
                </Box>

                {/* Data section */}
                <Box sx={{
                  p: 2, borderRadius: 2, mb: 2,
                  border: '1px solid rgba(var(--app-accent-rgb), 0.25)',
                  bgcolor: 'rgba(var(--app-accent-rgb), 0.04)',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 18, color: UI.accent }} />
                    <Typography sx={{ color: UI.text, fontWeight: 700, fontSize: '0.9rem' }}>
                      Данные загружены
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {detectedNames.filter(n => detectFileType(n) !== 'image').map((name, i) => (
                      <Chip key={i} size="small"
                        icon={<StorageIcon sx={{ fontSize: 14, color: `${UI.accent} !important` }} />}
                        label={name}
                        sx={{ fontSize: '0.76rem', color: UI.muted, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 }}
                      />
                    ))}
                  </Box>
                  <Typography sx={{ color: UI.muted, fontSize: '0.8rem', mt: 1 }}>
                    Данные будут автоматически сопоставлены с элементами макета
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained" size="large" startIcon={<AutoAwesomeIcon />}
                onClick={handleBuildDashboard}
                sx={{ px: 4, py: 1.5, fontWeight: 800, fontSize: '1rem' }}
              >
                ПОСТРОИТЬ ДАШБОРД
              </Button>
              <Button variant="outlined" onClick={handleGoToData}
                sx={{ color: UI.accent, borderColor: 'rgba(var(--app-accent-rgb), 0.3)', '&:hover': { borderColor: UI.accent, bgcolor: UI.accentSoft } }}>
                Посмотреть данные
              </Button>
              <Button variant="text" onClick={handleReset}
                sx={{ color: UI.muted, bgcolor: 'rgba(255,255,255,0.03)' }}>
                Загрузить другие
              </Button>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Detected DATA → preview + options */}
      {state === 'detected_data' && (
        <Fade in>
          <Paper sx={{
            width: '100%', maxWidth: 620, p: 4, textAlign: 'center',
            borderRadius: 6, border: '1px solid rgba(var(--app-accent-rgb), 0.3)',
            bgcolor: 'rgba(var(--app-accent-rgb), 0.06)',
          }}>
            <TableChartIcon sx={{ fontSize: 40, color: UI.accent, mb: 1 }} />
            <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700, mb: 0.5 }}>
              Загружены данные
            </Typography>
            <Typography sx={{ color: UI.muted, mb: 2, fontSize: '0.88rem' }}>
              {detectedNames.join(', ')}
            </Typography>

            {/* CSV preview table */}
            {previewData && (
              <Box sx={{
                mb: 2.5, borderRadius: 2, overflow: 'auto',
                border: `1px solid ${UI.border}`, bgcolor: UI.panel,
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <tbody>
                    {previewData.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{
                            padding: '6px 10px',
                            borderBottom: `1px solid ${UI.border}`,
                            color: ri === 0 ? UI.accent : 'var(--app-muted)',
                            fontWeight: ri === 0 ? 700 : 400,
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                          }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}

            <Typography sx={{ color: 'var(--app-muted)', mb: 2.5, fontSize: '0.92rem' }}>
              Можно проанализировать качество или сразу построить дашборд.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" startIcon={<DashboardIcon />} onClick={handleBuildDashboard}>
                Сразу дашборд
              </Button>
              <Button variant="outlined" onClick={handleGoToData}
                sx={{ color: UI.accent, borderColor: 'rgba(var(--app-accent-rgb), 0.3)', '&:hover': { borderColor: UI.accent, bgcolor: UI.accentSoft } }}>
                Анализ данных
              </Button>
              <Button variant="outlined" onClick={handleReset}
                sx={{ color: UI.muted, borderColor: UI.border }}>
                Другой файл
              </Button>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Building dashboard */}
      {state === 'building_dashboard' && (
        <Fade in>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ color: UI.accent, mb: 2 }} size={56} />
            <Typography variant="h6" sx={{ color: UI.text, fontWeight: 700 }}>
              Строю дашборд...
            </Typography>
            <Typography sx={{ color: UI.muted, mt: 0.5 }}>
              AI генерирует визуализации на основе загруженного файла
            </Typography>
          </Box>
        </Fade>
      )}

      {/* Done */}
      {state === 'done' && (
        <Fade in>
          <Box sx={{ textAlign: 'center' }}>
            <DashboardIcon sx={{ fontSize: 64, color: UI.accent, mb: 2 }} />
            <Typography variant="h5" sx={{ color: UI.text, fontWeight: 700, mb: 2 }}>
              Дашборд готов!
            </Typography>
            <Button variant="contained" onClick={() => goToPetalStep('dashboard', 0)}>
              Открыть дашборд
            </Button>
          </Box>
        </Fade>
      )}
      </Box>

      <Modal
        open={imageLightboxOpen}
        onClose={closeImageLightbox}
        aria-labelledby="image-preview-modal-title"
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
            position: 'relative',
            width: 'min(96vw, 1440px)',
            height: 'min(92vh, 960px)',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'rgba(20,20,22,0.98)',
            border: `1px solid ${UI.borderStrong}`,
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
              borderBottom: `1px solid ${UI.border}`,
              flexShrink: 0,
            }}
          >
            <ImageIcon sx={{ fontSize: 20, color: 'var(--app-violet)' }} />
            <Typography
              id="image-preview-modal-title"
              sx={{ color: UI.text, fontWeight: 700, fontSize: '0.95rem', minWidth: 0, flex: 1 }}
              noWrap
            >
              {detectedNames.find(name => detectFileType(name) === 'image') || detectedNames[0] || 'Загруженная картинка'}
            </Typography>
            <Tooltip title="Закрыть" arrow>
              <IconButton
                aria-label="Закрыть полноразмерное изображение"
                onClick={closeImageLightbox}
                sx={{
                  color: UI.muted,
                  '&:hover': { color: UI.text, bgcolor: 'rgba(255,255,255,0.06)' },
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

export default Canvas;

import React from 'react';
import { Box, Typography, Button, Paper, Chip, LinearProgress, Tooltip } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import TableChartIcon from '@mui/icons-material/TableChart';
import SpeedIcon from '@mui/icons-material/Speed';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useProject } from '../store/ProjectContext';
import type { MockupElementStats } from '../types';

const CHART_TYPE_ICONS: Record<string, React.ReactNode> = {
  big_number: <SpeedIcon sx={{ fontSize: 20 }} />,
  bar: <BarChartIcon sx={{ fontSize: 20 }} />,
  bar_horizontal: <BarChartIcon sx={{ fontSize: 20, transform: 'rotate(90deg)' }} />,
  line: <ShowChartIcon sx={{ fontSize: 20 }} />,
  area: <ShowChartIcon sx={{ fontSize: 20 }} />,
  pie: <PieChartIcon sx={{ fontSize: 20 }} />,
  donut: <DonutLargeIcon sx={{ fontSize: 20 }} />,
  table: <TableChartIcon sx={{ fontSize: 20 }} />,
  pivot_table: <TableChartIcon sx={{ fontSize: 20 }} />,
};

const CHART_TYPE_COLORS: Record<string, string> = {
  big_number: '#4dd0e1',
  bar: '#66bb6a',
  bar_horizontal: '#66bb6a',
  line: '#ffa726',
  area: '#ffa726',
  pie: '#ef5350',
  donut: '#ab47bc',
  table: '#78909c',
  pivot_table: '#78909c',
};

const MockupPage: React.FC = () => {
  const { project, uploadImage, buildDashboard, goToPetalStep } = useProject();
  const hasImage = !!project?.imageFile;
  const analysis = project?.imageFile?.analysis ?? null;
  const isAnalyzing = hasImage && !analysis;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: '#e6edf3', mb: 0.5 }}>
        Макет дашборда
      </Typography>
      <Typography sx={{ color: '#8b949e', mb: 3, fontSize: '0.92rem' }}>
        Загрузите скетч или фотографию салфетки — AI сгенерирует структуру дашборда на её основе.
      </Typography>

      {!hasImage ? (
        <Paper
          sx={{
            p: 6, textAlign: 'center', borderRadius: 4,
            border: '2px dashed #30363d',
            bgcolor: 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            '&:hover': { borderColor: '#78909c', bgcolor: 'rgba(120,144,156,0.06)' },
          }}
          onClick={uploadImage}
        >
          <CloudUploadIcon sx={{ fontSize: 56, color: '#484f58', mb: 2 }} />
          <Typography sx={{ color: '#8b949e', fontSize: '1rem', mb: 1 }}>
            Нажмите, чтобы загрузить макет
          </Typography>
          <Typography sx={{ color: '#484f58', fontSize: '0.84rem' }}>
            PNG, JPG, PDF — фото салфетки, скриншот, Figma-экспорт
          </Typography>
        </Paper>
      ) : (
        <Box>
          {/* File info */}
          <Paper sx={{
            p: 3, borderRadius: 4, border: '1px solid #30363d',
            bgcolor: 'rgba(255,255,255,0.03)', mb: 3,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <ImageIcon sx={{ fontSize: 36, color: '#78909c' }} />
              <Box>
                <Typography sx={{ color: '#e6edf3', fontWeight: 700 }}>
                  {project.imageFile!.name}
                </Typography>
                <Typography sx={{ color: '#8b949e', fontSize: '0.84rem' }}>
                  {project.imageFile!.width} × {project.imageFile!.height} • {project.imageFile!.size}
                </Typography>
              </Box>
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                label="Загружен"
                size="small"
                sx={{ ml: 'auto', bgcolor: 'rgba(46,160,67,0.12)', color: '#3fb950', border: '1px solid rgba(46,160,67,0.2)' }}
              />
            </Box>

            {/* Placeholder for image preview */}
            <Box sx={{
              width: '100%', height: 300, borderRadius: 3,
              bgcolor: 'rgba(120,144,156,0.08)', border: '1px solid #30363d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Box sx={{ textAlign: 'center' }}>
                <ImageIcon sx={{ fontSize: 48, color: '#484f58', mb: 1 }} />
                <Typography sx={{ color: '#8b949e', fontSize: '0.9rem' }}>Превью макета</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Analysis block */}
          {isAnalyzing ? (
            <Paper sx={{
              p: 3, borderRadius: 4, border: '1px solid #30363d',
              bgcolor: 'rgba(255,255,255,0.03)', mb: 3,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <AutoAwesomeIcon sx={{ fontSize: 22, color: '#4dd0e1', animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
                <Typography sx={{ color: '#e6edf3', fontWeight: 600, fontSize: '0.95rem' }}>
                  Анализируем макет…
                </Typography>
              </Box>
              <LinearProgress sx={{
                borderRadius: 2, height: 6,
                bgcolor: 'rgba(77,208,225,0.1)',
                '& .MuiLinearProgress-bar': { bgcolor: '#4dd0e1', borderRadius: 2 },
              }} />
              <Typography sx={{ color: '#8b949e', fontSize: '0.82rem', mt: 1 }}>
                Распознаём элементы: KPI, графики, таблицы…
              </Typography>
            </Paper>
          ) : analysis ? (
            <Paper sx={{
              p: 3, borderRadius: 4, border: '1px solid rgba(77,208,225,0.25)',
              bgcolor: 'rgba(77,208,225,0.04)', mb: 3,
            }}>
              {/* Summary header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <AutoAwesomeIcon sx={{ fontSize: 22, color: '#4dd0e1' }} />
                <Typography sx={{ color: '#e6edf3', fontWeight: 700, fontSize: '1rem' }}>
                  Результат анализа
                </Typography>
                <Chip
                  label={`${analysis.totalElements} элементов`}
                  size="small"
                  sx={{ ml: 'auto', bgcolor: 'rgba(77,208,225,0.15)', color: '#4dd0e1', fontWeight: 600, border: '1px solid rgba(77,208,225,0.3)' }}
                />
              </Box>

              {/* KPI / Charts summary chips */}
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
                <Chip
                  icon={<SpeedIcon sx={{ fontSize: 16, color: '#4dd0e1 !important' }} />}
                  label={`${analysis.kpiCount} KPI`}
                  size="small"
                  variant="outlined"
                  sx={{ color: '#e6edf3', borderColor: '#30363d', fontWeight: 600 }}
                />
                <Chip
                  icon={<BarChartIcon sx={{ fontSize: 16, color: '#66bb6a !important' }} />}
                  label={`${analysis.chartCount} графиков`}
                  size="small"
                  variant="outlined"
                  sx={{ color: '#e6edf3', borderColor: '#30363d', fontWeight: 600 }}
                />
              </Box>

              {/* Breakdown by type */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {analysis.elementsByType.map((group: MockupElementStats) => {
                  const icon = CHART_TYPE_ICONS[group.type] || <ViewModuleIcon sx={{ fontSize: 20 }} />;
                  const color = CHART_TYPE_COLORS[group.type] || '#8b949e';
                  return (
                    <Box key={group.type} sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1.5,
                      p: 1.5, borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.02)',
                      border: '1px solid #21262d',
                      transition: 'border-color 0.2s',
                      '&:hover': { borderColor: color },
                    }}>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36, borderRadius: 2,
                        bgcolor: `${color}18`, color,
                        flexShrink: 0, mt: 0.25,
                      }}>
                        {icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ color: '#e6edf3', fontWeight: 600, fontSize: '0.88rem' }}>
                            {group.label}
                          </Typography>
                          <Chip
                            label={group.count}
                            size="small"
                            sx={{
                              height: 20, minWidth: 24,
                              bgcolor: `${color}22`, color,
                              fontWeight: 700, fontSize: '0.75rem',
                            }}
                          />
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
                                  height: 22, fontSize: '0.76rem',
                                  bgcolor: 'rgba(255,255,255,0.04)',
                                  color: '#8b949e',
                                  border: '1px solid #21262d',
                                  cursor: 'default',
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
            </Paper>
          ) : null}

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              disabled={isAnalyzing}
              onClick={() => { buildDashboard(); goToPetalStep('dashboard', 0); }}
              sx={{
                textTransform: 'none', fontWeight: 700,
                background: isAnalyzing
                  ? 'rgba(255,255,255,0.08)'
                  : 'linear-gradient(135deg, #4dd0e1 0%, #26c6da 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)' },
              }}
            >
              {isAnalyzing ? 'Анализируем…' : 'Сгенерировать дашборд по макету'}
            </Button>
            <Button variant="outlined" onClick={uploadImage}
              sx={{ textTransform: 'none', color: '#8b949e', borderColor: '#30363d' }}>
              Загрузить другой макет
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MockupPage;

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Chip, LinearProgress, Button, Menu, MenuItem, Divider, IconButton, TextField,
  Drawer, Tooltip, Collapse,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import StorageIcon from '@mui/icons-material/Storage';
import LayersIcon from '@mui/icons-material/Layers';
import SchemaIcon from '@mui/icons-material/Schema';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useProject } from '../../store/ProjectContext';
import { getPetalConfig } from './petalFlow';
import { api, type QuotasResult } from '../../api';
import type { PetalKey, PetalStatus } from '../../types';

const statusLabels: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'info' | 'error' }> = {
  empty: { label: 'Новый', color: 'default' },
  files_uploaded: { label: 'Файлы загружены', color: 'info' },
  analyzing: { label: 'Анализ...', color: 'warning' },
  cleaning: { label: 'Очистка...', color: 'warning' },
  cleaned: { label: 'Данные очищены', color: 'success' },
  building_detail: { label: 'Строим модель...', color: 'warning' },
  detail_built: { label: 'Модель построена', color: 'info' },
  building_mart: { label: 'Строим витрины...', color: 'warning' },
  mart_built: { label: 'Витрины готовы', color: 'info' },
  generating_erd: { label: 'Генерация...', color: 'warning' },
  erd_generated: { label: 'Модель готова', color: 'success' },
  building_dashboard: { label: 'Строим дашборд...', color: 'warning' },
  dashboard_built: { label: 'Дашборд готов', color: 'success' },
  complete: { label: 'Завершён', color: 'success' },
};

interface PipelineItem {
  key: PetalKey;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
}

interface PipelineGroup {
  type: 'group';
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  tooltip: string;
  children: PipelineItem[];
}

type PipelineEntry = (PipelineItem & { type: 'item' }) | PipelineGroup;

const PIPELINE_ENTRIES: PipelineEntry[] = [
  { type: 'item', key: 'data', label: 'Загруженные данные', sublabel: 'STG', icon: <StorageIcon />, color: '#4dd0e1' },
  {
    type: 'group',
    label: 'Проектирование',
    sublabel: 'DWH → ERD',
    icon: <SchemaIcon />,
    color: '#ab47bc',
    tooltip: 'Для продвинутых пользователей: детальный слой и ERD-моделирование',
    children: [
      { key: 'detail', label: 'Детальный слой', sublabel: 'DWH', icon: <LayersIcon />, color: '#66bb6a' },
      { key: 'model', label: 'Проектирование данных', sublabel: 'ERD', icon: <SchemaIcon />, color: '#ab47bc' },
    ],
  },
  { type: 'item', key: 'dashboard', label: 'Дашборд', sublabel: 'Результат', icon: <DashboardIcon />, color: '#ff6e40' },
];

function StatusIcon({ status }: { status: PetalStatus }) {
  if (status === 'green') return <CheckCircleIcon sx={{ fontSize: 18, color: '#3fb950' }} />;
  if (status === 'yellow') return <HourglassBottomIcon sx={{ fontSize: 18, color: '#d29922' }} />;
  return null;
}

const TopBar: React.FC<{ onOpenHelp?: () => void }> = ({ onOpenHelp }) => {
  const {
    projects, project, activeProjectId, switchProject, createProject, renameProject,
    pipelineRunning, pipelineStep, navigationMode, activePetal, returnToFlower,
    openPetal,
  } = useProject();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [designExpanded, setDesignExpanded] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [quotas, setQuotas] = useState<QuotasResult | null>(null);

  const statuses = project?.petalStatuses ?? { data: 'grey', detail: 'grey', mart: 'grey', model: 'grey', mockup: 'grey', dashboard: 'grey' };

  const status = project
    ? (project.status === 'analyzed' ? null : statusLabels[project.status] || statusLabels.empty)
    : null;
  const activePetalLabel = activePetal ? getPetalConfig(activePetal).label : null;
  const quotaSummary = useMemo(() => {
    if (!quotas) return null;
    const items = Object.values(quotas.quotas);
    const limit = items.reduce((sum, item) => sum + item.limit, 0);
    const used = items.reduce((sum, item) => sum + item.used, 0);
    return { used, limit, pct: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0 };
  }, [quotas]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.getQuotas()
        .then(result => { if (alive) setQuotas(result); })
        .catch(() => { if (alive) setQuotas(null); });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const startRename = () => {
    if (!project) return;
    setRenameValue(project.name);
    setRenameMode(true);
  };
  const confirmRename = () => {
    if (project && renameValue.trim()) renameProject(project.id, renameValue.trim());
    setRenameMode(false);
  };

  return (
    <Box sx={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 56,
      bgcolor: 'rgba(var(--app-surface-rgb), 0.92)', backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--app-border)',
      display: 'flex', alignItems: 'center', px: { xs: 2, md: 3 }, zIndex: 1100, gap: 1.5,
      }}>
      {/* Burger menu */}
      <IconButton aria-label="Открыть меню предметных областей" onClick={() => setDrawerOpen(true)}
        sx={{ color: 'var(--app-subtle-text)', '&:hover': { color: 'var(--app-text)', bgcolor: 'rgba(var(--app-accent-rgb), 0.1)' } }}>
        <MenuIcon />
      </IconButton>

      {renameMode && project ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <TextField size="small" autoFocus value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameMode(false); }}
            sx={{ minWidth: 260, '& .MuiOutlinedInput-root': { height: 36 }, '& input': { color: 'var(--app-text)' } }}
          />
          <IconButton size="small" aria-label="Сохранить название области" onClick={confirmRename} sx={{ color: 'var(--app-accent)' }}><CheckIcon sx={{ fontSize: 18 }} /></IconButton>
          <IconButton size="small" aria-label="Отменить переименование области" onClick={() => setRenameMode(false)} sx={{ color: 'var(--app-subtle-text)' }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
      ) : (
        <>
          <Button onClick={e => setAnchor(e.currentTarget)}
            startIcon={<FolderOpenIcon sx={{ fontSize: 18 }} />}
            endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
            sx={{
              px: 1.5,
              py: 0.65,
              color: 'var(--app-text)',
              bgcolor: 'rgba(var(--app-panel-rgb), 0.94)',
              border: '1px solid var(--app-border)',
              '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb), 0.1)' },
            }}
          >
            {project ? project.name : 'Предметные области'}
          </Button>
          {project && (
            <IconButton size="small" aria-label={`Переименовать область ${project.name}`} onClick={startRename}
              sx={{ color: 'var(--app-subtle-text)', border: '1px solid var(--app-border)', bgcolor: 'rgba(var(--app-panel-rgb), 0.92)', '&:hover': { color: 'var(--app-text)', bgcolor: 'rgba(var(--app-accent-rgb), 0.1)' } }}>
              <EditIcon sx={{ fontSize: 17 }} />
            </IconButton>
          )}
        </>
      )}

      {status && <Chip label={status.label} color={status.color} size="small" sx={{ fontSize: '0.7rem', height: 22 }} />}

      {navigationMode === 'petal' && (
        <>
          {activePetalLabel && <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)' }}>{activePetalLabel}</Typography>}
          <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />} onClick={returnToFlower}
            sx={{ px: 1.5, py: 0.45, color: 'var(--app-accent)', border: '1px solid rgba(var(--app-accent-rgb), 0.3)', bgcolor: 'rgba(var(--app-accent-rgb), 0.08)', '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb), 0.14)' } }}>
            К обзору
          </Button>
        </>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {pipelineRunning && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LinearProgress sx={{ width: 120, borderRadius: 2 }} />
          <Typography variant="caption" sx={{ color: 'var(--app-accent)', whiteSpace: 'nowrap' }}>{pipelineStep}</Typography>
        </Box>
      )}

      {quotaSummary && (
        <Tooltip title={`Пакет за 24 часа: ${quotaSummary.used}/${quotaSummary.limit}. Upload cap: ${quotas?.upload.max_upload_mb ?? 0} MB`}>
          <Box sx={{ width: 136, display: { xs: 'none', md: 'block' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
              <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', fontSize: '0.68rem' }}>Пакет</Typography>
              <Typography variant="caption" sx={{ color: 'var(--app-subtle-text)', fontSize: '0.68rem' }}>{quotaSummary.used}/{quotaSummary.limit}</Typography>
            </Box>
            <LinearProgress variant="determinate" value={quotaSummary.pct} sx={{ height: 5, borderRadius: 99 }} />
          </Box>
        </Tooltip>
      )}

      {onOpenHelp && (
        <Tooltip title="Как пользоваться сервисом">
          <IconButton
            aria-label="Открыть обучение"
            onClick={onOpenHelp}
            size="small"
            sx={{
              color: 'var(--app-subtle-text)',
              border: '1px solid var(--app-border)',
              bgcolor: 'rgba(var(--app-panel-rgb), 0.92)',
              width: 32,
              height: 32,
              '&:hover': { color: 'var(--app-accent)', borderColor: 'rgba(var(--app-accent-rgb), 0.4)', bgcolor: 'rgba(var(--app-accent-rgb), 0.08)' },
            }}
          >
            <HelpOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 280, bgcolor: 'var(--app-surface)', border: '1px solid var(--app-border)' } } }}>
        <MenuItem onClick={() => { createProject(`Предметная область ${projects.length + 1}`); setAnchor(null); }} sx={{ fontSize: '0.9rem' }}>
          <AddIcon sx={{ fontSize: 17, mr: 1.25, color: 'var(--app-accent)' }} /> Создать предметную область
        </MenuItem>
        <Divider sx={{ borderColor: 'var(--app-border)' }} />
        {projects.length === 0
          ? <MenuItem disabled sx={{ fontSize: '0.85rem' }}>Пока нет предметных областей</MenuItem>
          : projects.map(item => (
            <MenuItem key={item.id} onClick={() => { switchProject(item.id); setAnchor(null); }}
              sx={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ color: 'var(--app-text)', fontSize: '0.9rem' }}>{item.name}</Typography>
                <Typography noWrap sx={{ color: 'var(--app-subtle-text)', fontSize: '0.72rem' }}>
                  {item.files.length} файлов{item.dashboardBuilt ? ' • дашборд готов' : ''}
                </Typography>
              </Box>
              {item.id === activeProjectId && <CheckIcon sx={{ fontSize: 16, color: 'var(--app-accent)' }} />}
            </MenuItem>
          ))
        }
      </Menu>

      {/* Pipeline drawer (burger) */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 300, bgcolor: 'var(--app-surface)', borderRight: '1px solid var(--app-border)' } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, mb: 2 }}>
            Блоки пайплайна
          </Typography>

          {PIPELINE_ENTRIES.map((entry, idx) => {
            if (entry.type === 'item') {
              const st = statuses[entry.key];
              return (
                <Box
                  key={entry.key}
                  onClick={() => { openPetal(entry.key); setDrawerOpen(false); }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: 1.5, mb: 0.5, borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: activePetal === entry.key ? `${entry.color}18` : `${entry.color}08`,
                    border: `1px solid ${activePetal === entry.key ? entry.color : `${entry.color}22`}`,
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: `${entry.color}18`, borderColor: `${entry.color}55`, transform: 'translateX(2px)' },
                  }}
                >
                  <Box sx={{ color: entry.color, display: 'flex', '& .MuiSvgIcon-root': { fontSize: 22 } }}>
                    {entry.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: 'var(--app-text)', fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.2 }}>
                      {entry.label}
                    </Typography>
                    <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.72rem' }}>
                      {entry.sublabel}
                    </Typography>
                  </Box>
                  <StatusIcon status={st} />
                </Box>
              );
            }

            // Group (Проектирование)
            const group = entry;
            const groupActive = group.children.some(c => activePetal === c.key);
            const groupHasGreen = group.children.some(c => statuses[c.key] === 'green');
            const groupHasYellow = group.children.some(c => statuses[c.key] === 'yellow');
            const groupStatus: PetalStatus = group.children.every(c => statuses[c.key] === 'green') ? 'green'
              : (groupHasYellow || groupHasGreen) ? 'yellow' : 'grey';

            return (
              <Box key={`group-${idx}`}>
                <Tooltip
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5 }}>Для продвинутых пользователей</Typography>
                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.4 }}>{group.tooltip}</Typography>
                    </Box>
                  }
                  placement="right"
                  arrow
                >
                  <Box
                    onClick={() => setDesignExpanded(!designExpanded)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      p: 1.5, mb: 0.5, borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: groupActive ? `${group.color}18` : `${group.color}08`,
                      border: `1px solid ${groupActive ? group.color : (designExpanded ? `${group.color}44` : `${group.color}22`)}`,
                      transition: 'all 0.2s',
                      '&:hover': { bgcolor: `${group.color}18`, borderColor: `${group.color}55`, transform: 'translateX(2px)' },
                    }}
                  >
                    <Box sx={{ color: group.color, display: 'flex', '& .MuiSvgIcon-root': { fontSize: 22 } }}>
                      {group.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: 'var(--app-text)', fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.2 }}>
                        {group.label}
                      </Typography>
                      <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.72rem' }}>
                        {group.sublabel}
                      </Typography>
                    </Box>
                    <StatusIcon status={groupStatus} />
                    <ExpandMoreIcon sx={{
                      fontSize: 18, color: 'var(--app-subtle-text)',
                      transform: designExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }} />
                  </Box>
                </Tooltip>

                <Collapse in={designExpanded}>
                  <Box sx={{ pl: 2, borderLeft: `2px solid ${group.color}33`, ml: 2.5, mt: 0.25, mb: 0.5 }}>
                    {group.children.map(child => {
                      const st = statuses[child.key];
                      return (
                        <Box
                          key={child.key}
                          onClick={() => { openPetal(child.key); setDrawerOpen(false); }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.25,
                            p: 1, mb: 0.25, borderRadius: 1.5,
                            cursor: 'pointer',
                            bgcolor: activePetal === child.key ? `${child.color}18` : `${child.color}06`,
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: `${child.color}15` },
                          }}
                        >
                          <Box sx={{ color: child.color, display: 'flex', '& .MuiSvgIcon-root': { fontSize: 18 } }}>
                            {child.icon}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ color: 'var(--app-muted)', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2 }}>
                              {child.label}
                            </Typography>
                            <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.68rem' }}>
                              {child.sublabel}
                            </Typography>
                          </Box>
                          <StatusIcon status={st} />
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Drawer>
    </Box>
  );
};

export default TopBar;

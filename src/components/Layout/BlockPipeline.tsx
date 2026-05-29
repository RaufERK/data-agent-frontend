import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import LayersIcon from '@mui/icons-material/Layers';
import ImageIcon from '@mui/icons-material/Image';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchemaIcon from '@mui/icons-material/Schema';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import type { PetalKey, PetalStatuses, PetalEnabled, PetalStatus } from '../../types';

interface BlockPipelineProps {
  statuses: PetalStatuses;
  enabled: PetalEnabled;
  activeBlock: PetalKey | null;
  selectedBlock: PetalKey | null;
  projectName?: string;
  mode: 'hero' | 'compact';
  onBlockClick: (key: PetalKey) => void;
  onBlockSelect?: (key: PetalKey) => void;
  onToggle?: (key: PetalKey) => void;
}

interface BlockDef {
  key: PetalKey;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
}

// Пайплайн данных: STG → DWH → ERD
const DATA_PIPELINE: BlockDef[] = [
  { key: 'data', label: 'Загруженные данные', sublabel: 'STG', icon: <StorageIcon />, color: '#4dd0e1' },
  { key: 'detail', label: 'Детальный слой', sublabel: 'DWH', icon: <LayersIcon />, color: '#66bb6a' },
  { key: 'model', label: 'ERD-модель', sublabel: 'Проектирование', icon: <SchemaIcon />, color: '#ab47bc' },
];

function getStatusColor(status: PetalStatus) {
  if (status === 'green') return { bg: 'rgba(46,160,67,0.15)', border: '#3fb950', dot: '#2ea043' };
  if (status === 'yellow') return { bg: 'rgba(210,153,34,0.12)', border: '#d29922', dot: '#d29922' };
  return { bg: 'rgba(110,118,129,0.06)', border: '#30363d', dot: '#484f58' };
}

function StatusDot({ status }: { status: PetalStatus }) {
  if (status === 'green') return <CheckCircleIcon sx={{ fontSize: 16, color: '#3fb950' }} />;
  if (status === 'yellow') return <HourglassBottomIcon sx={{ fontSize: 16, color: '#d29922' }} />;
  return null;
}

const BlockPipeline: React.FC<BlockPipelineProps> = ({
  statuses, enabled, activeBlock, selectedBlock, projectName, mode,
  onBlockClick, onBlockSelect, onToggle: _onToggle,
}) => {
  const isHero = mode === 'hero';
  const blockH = isHero ? 90 : 64;
  const blockW = isHero ? 160 : 120;

  const renderBlock = (b: BlockDef, showArrowAfter: boolean) => {
    const status = statuses[b.key];
    const isEnabled = enabled[b.key];
    const isActive = activeBlock === b.key;
    const isSelected = selectedBlock === b.key;
    const sc = getStatusColor(status);
    const hl = isActive || isSelected;

    return (
      <React.Fragment key={b.key}>
        <Paper
          elevation={0}
          onMouseEnter={() => onBlockSelect?.(b.key)}
          onClick={() => onBlockClick(b.key)}
          sx={{
            width: blockW, minHeight: blockH,
            p: isHero ? 1.5 : 1,
            borderRadius: 2.5,
            border: `2px solid ${hl ? b.color : sc.border}`,
            bgcolor: hl ? `${b.color}18` : sc.bg,
            opacity: !isEnabled && status === 'grey' ? 0.45 : 1,
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 0.5,
            boxShadow: hl ? `0 0 20px ${b.color}44` : 'none',
            transform: hl ? 'scale(1.05)' : 'scale(1)',
            '&:hover': {
              borderColor: b.color,
              bgcolor: `${b.color}14`,
              boxShadow: `0 0 16px ${b.color}33`,
            },
            position: 'relative',
          }}
        >
          <Box sx={{ color: hl ? b.color : (status === 'grey' ? '#6e7681' : b.color), '& .MuiSvgIcon-root': { fontSize: isHero ? 28 : 22 } }}>
            {b.icon}
          </Box>
          <Typography sx={{
            fontSize: isHero ? '0.78rem' : '0.65rem',
            fontWeight: 700,
            color: hl ? '#e6edf3' : (status === 'grey' ? '#6e7681' : '#c9d1d9'),
            textAlign: 'center', lineHeight: 1.15,
          }}>
            {b.label}
          </Typography>
          <Typography sx={{ fontSize: isHero ? '0.65rem' : '0.55rem', color: '#8b949e', textAlign: 'center' }}>
            {b.sublabel}
          </Typography>
          {status !== 'grey' && (
            <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
              <StatusDot status={status} />
            </Box>
          )}
        </Paper>
        {showArrowAfter && (
          <ArrowForwardIcon sx={{
            fontSize: isHero ? 22 : 16,
            color: '#484f58',
            mx: isHero ? 0.5 : 0.25,
            alignSelf: 'center',
          }} />
        )}
      </React.Fragment>
    );
  };

  const mockupStatus = statuses.mockup;
  const mockupSc = getStatusColor(mockupStatus);
  const mockupHl = activeBlock === 'mockup' || selectedBlock === 'mockup';
  const dashStatus = statuses.dashboard;
  const dashSc = getStatusColor(dashStatus);
  const dashHl = activeBlock === 'dashboard' || selectedBlock === 'dashboard';

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isHero ? 3 : 1.5 }}>
      {/* Project name (hero only) */}
      {isHero && projectName && (
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.03em', mb: 1 }}>
          {projectName}
        </Typography>
      )}

      {/* Main layout: [Constructor area] => [Dashboard] */}
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: isHero ? 3 : 1.5, width: '100%', justifyContent: 'center' }}>

        {/* Left: Constructor area */}
        <Paper
          elevation={0}
          sx={{
            flex: isHero ? '0 1 auto' : 1,
            borderRadius: 3,
            border: '1px solid #30363d',
            bgcolor: 'rgba(255,255,255,0.02)',
            p: isHero ? 2.5 : 1.5,
            display: 'flex', flexDirection: 'column', gap: isHero ? 2 : 1,
          }}
        >
          {/* Top: Макет дашборда */}
          <Paper
            elevation={0}
            onMouseEnter={() => onBlockSelect?.('mockup')}
            onClick={() => onBlockClick('mockup')}
            sx={{
              p: isHero ? 1.5 : 1,
              borderRadius: 2,
              border: `2px solid ${mockupHl ? '#78909c' : mockupSc.border}`,
              bgcolor: mockupHl ? 'rgba(120,144,156,0.15)' : mockupSc.bg,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 1.5,
              opacity: !enabled.mockup && mockupStatus === 'grey' ? 0.45 : 1,
              transition: 'all 0.25s ease',
              '&:hover': { borderColor: '#78909c', bgcolor: 'rgba(120,144,156,0.1)' },
              position: 'relative',
            }}
          >
            <ImageIcon sx={{ fontSize: isHero ? 28 : 20, color: mockupHl ? '#78909c' : '#6e7681' }} />
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#c9d1d9', fontSize: isHero ? '0.88rem' : '0.72rem' }}>
                Макет дашборда
              </Typography>
              <Typography sx={{ color: '#8b949e', fontSize: isHero ? '0.72rem' : '0.6rem' }}>
                Загрузка салфетки / скетча
              </Typography>
            </Box>
            {mockupStatus !== 'grey' && (
              <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
                <StatusDot status={mockupStatus} />
              </Box>
            )}
          </Paper>

          {/* Middle: Data pipeline STG → DWH → ERD */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 0 }}>
            {DATA_PIPELINE.map((b, i) => renderBlock(b, i < DATA_PIPELINE.length - 1))}
          </Box>

          {/* Bottom: Проектирование данных */}
          <Paper
            elevation={0}
            sx={{
              p: isHero ? 1 : 0.75,
              borderRadius: 2,
              border: '1px solid #21262d',
              bgcolor: 'rgba(255,255,255,0.015)',
              display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center',
            }}
          >
            <SchemaIcon sx={{ fontSize: 16, color: '#484f58' }} />
            <Typography sx={{ color: '#484f58', fontSize: isHero ? '0.76rem' : '0.62rem', fontWeight: 600 }}>
              Архитектура и ERD
            </Typography>
          </Paper>
        </Paper>

        {/* Arrow to dashboard */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ArrowForwardIcon sx={{ fontSize: isHero ? 32 : 22, color: '#484f58' }} />
        </Box>

        {/* Right: Dashboard result */}
        <Paper
          elevation={0}
          onMouseEnter={() => onBlockSelect?.('dashboard')}
          onClick={() => onBlockClick('dashboard')}
          sx={{
            width: isHero ? 180 : 120,
            borderRadius: 3,
            border: `2px solid ${dashHl ? '#ff6e40' : dashSc.border}`,
            bgcolor: dashHl ? 'rgba(255,110,64,0.12)' : dashSc.bg,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 1,
            p: isHero ? 2.5 : 1.5,
            transition: 'all 0.25s ease',
            boxShadow: dashHl ? '0 0 24px rgba(255,110,64,0.3)' : 'none',
            transform: dashHl ? 'scale(1.04)' : 'scale(1)',
            '&:hover': {
              borderColor: '#ff6e40',
              bgcolor: 'rgba(255,110,64,0.1)',
              boxShadow: '0 0 20px rgba(255,110,64,0.25)',
            },
            position: 'relative',
          }}
        >
          <DashboardIcon sx={{ fontSize: isHero ? 40 : 28, color: dashHl ? '#ff6e40' : '#6e7681' }} />
          <Typography sx={{
            fontWeight: 800, fontSize: isHero ? '1.1rem' : '0.8rem',
            color: dashHl ? '#e6edf3' : '#c9d1d9',
          }}>
            Дашборд
          </Typography>
          {dashStatus !== 'grey' && (
            <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
              <StatusDot status={dashStatus} />
            </Box>
          )}
        </Paper>
      </Box>

      {/* Storemap label (bottom-right, as on whiteboard) */}
      {isHero && (
        <Box sx={{ alignSelf: 'flex-end', mt: -1 }}>
          <Typography sx={{ color: '#484f58', fontSize: '0.72rem', fontStyle: 'italic' }}>
            сторимэп
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default BlockPipeline;

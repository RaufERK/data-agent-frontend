import React, { useMemo, useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import LayersIcon from '@mui/icons-material/Layers';
import SchemaIcon from '@mui/icons-material/Schema';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ImageIcon from '@mui/icons-material/Image';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { PetalKey, PetalStatuses, PetalEnabled } from '../../types';
import { PETAL_FLOW_CONFIG } from './petalFlow';

interface PetalNavProps {
  petals: PetalStatuses;
  petalEnabled: PetalEnabled;
  activePetal: PetalKey | null;
  mode: 'hero' | 'docked';
  projectName?: string;
  onPetalClick: (key: PetalKey) => void;
  onPetalSelect?: (key: PetalKey) => void;   // для панели свойств снизу
  onCenterClick?: () => void;
}

// 5 лепестков по кругу; mart оставлен только для совместимости типов.
const PETAL_ANGLES: Record<PetalKey, number> = {
  data: -90,        // top
  detail: 30,       // bottom-right
  mart: 90,
  model: 90,        // bottom
  mockup: 150,      // bottom-left
  dashboard: 210,   // top-left
};

const PETAL_ICONS: Record<PetalKey, React.ReactElement> = {
  data: <StorageIcon />,
  detail: <LayersIcon />,
  mart: <LayersIcon />,
  model: <SchemaIcon />,
  mockup: <ImageIcon />,
  dashboard: <DashboardIcon />,
};

function getStatusVisual(status: string) {
  switch (status) {
    case 'green':
      return {
        label: 'Готово',
        icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
        dotColor: '#2ea043',
        borderColor: '#3fb950',
        bg: 'rgba(46,160,67,0.12)',
      };
    case 'yellow':
      return {
        label: 'В работе',
        icon: <HourglassBottomIcon sx={{ fontSize: 14 }} />,
        dotColor: '#d29922',
        borderColor: '#d29922',
        bg: 'rgba(210,153,34,0.10)',
      };
    default: // grey
      return {
        label: 'Не активен',
        icon: <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />,
        dotColor: '#484f58',
        borderColor: '#30363d',
        bg: 'rgba(110,118,129,0.06)',
      };
  }
}

const MODE_DIMS = {
  hero: { centerSize: 156, petalSize: 130, orbitRadius: 240, padding: 100 },
  docked: { centerSize: 80, petalSize: 72, orbitRadius: 114, padding: 28 },
} as const;

const PetalNav: React.FC<PetalNavProps> = ({
  petals,
  petalEnabled,
  activePetal,
  mode,
  projectName,
  onPetalClick,
  onPetalSelect,
  onCenterClick,
}) => {
  const [hovered, setHovered] = useState<PetalKey | null>(null);
  const dims = MODE_DIMS[mode];
  const containerSize = dims.orbitRadius * 2 + dims.petalSize + dims.padding;
  const cx = containerSize / 2;
  const cy = containerSize / 2;

  const activeCount = useMemo(
    () => PETAL_FLOW_CONFIG.filter(({ key }) => petals[key] !== 'grey').length,
    [petals],
  );
  const greenCount = useMemo(
    () => PETAL_FLOW_CONFIG.filter(({ key }) => petals[key] === 'green').length,
    [petals],
  );

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box
        sx={{
          position: 'relative',
          width: containerSize,
          height: containerSize,
          maxWidth: '100%',
          transform: mode === 'hero'
            ? { xs: 'scale(0.58)', sm: 'scale(0.72)', md: 'scale(0.88)', lg: 'scale(1)' }
            : 'none',
          transformOrigin: 'center top',
          mt: mode === 'hero' ? { xs: -20, sm: -12, md: 0 } : 0,
          mb: mode === 'hero' ? { xs: -100, sm: -70, md: -24, lg: 0 } : 0,
        }}
      >
        {/* SVG connections */}
        <svg
          width={containerSize}
          height={containerSize}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {PETAL_FLOW_CONFIG.map((pc, i) => {
            const angle = PETAL_ANGLES[pc.key];
            const rad = (angle - 90) * (Math.PI / 180);
            const px = cx + dims.orbitRadius * Math.cos(rad);
            const py = cy + dims.orbitRadius * Math.sin(rad);
            const next = PETAL_FLOW_CONFIG[(i + 1) % PETAL_FLOW_CONFIG.length];
            const nextRad = (PETAL_ANGLES[next.key] - 90) * (Math.PI / 180);
            const npx = cx + dims.orbitRadius * Math.cos(nextRad);
            const npy = cy + dims.orbitRadius * Math.sin(nextRad);
            const isActive = petals[pc.key] !== 'grey';
            const isHighlighted = hovered === pc.key || activePetal === pc.key;

            return (
              <React.Fragment key={pc.key}>
                {/* Radial line to center */}
                <line
                  x1={cx} y1={cy} x2={px} y2={py}
                  stroke={isActive ? pc.color : '#30363d'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isActive ? 'none' : '6,4'}
                  opacity={isHighlighted ? 0.85 : 0.3}
                  style={{ transition: 'all 0.3s ease' }}
                />
                {/* Arc line to next petal */}
                <line
                  x1={px} y1={py} x2={npx} y2={npy}
                  stroke={isActive && petals[next.key] !== 'grey' ? '#3fb950' : '#21262d'}
                  strokeWidth={1}
                  strokeDasharray={isActive && petals[next.key] !== 'grey' ? 'none' : '4,5'}
                  opacity={0.22}
                />
              </React.Fragment>
            );
          })}
        </svg>

        {/* Center hub */}
        <Box
          onClick={onCenterClick}
          sx={{
            position: 'absolute',
            left: cx - dims.centerSize / 2,
            top: cy - dims.centerSize / 2,
            width: dims.centerSize,
            height: dims.centerSize,
            borderRadius: '50%',
            bgcolor: 'rgba(77,208,225,0.07)',
            border: '2px solid rgba(77,208,225,0.45)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            boxShadow: '0 0 36px rgba(77,208,225,0.14), inset 0 0 28px rgba(77,208,225,0.05)',
            cursor: onCenterClick ? 'pointer' : 'default',
            transition: 'all 0.3s ease',
            '&:hover': onCenterClick ? {
              boxShadow: '0 0 50px rgba(77,208,225,0.22), inset 0 0 34px rgba(77,208,225,0.08)',
              borderColor: 'rgba(77,208,225,0.7)',
            } : undefined,
          }}
        >
          <Typography sx={{ color: '#4dd0e1', fontWeight: 800, fontSize: mode === 'hero' ? '1.5rem' : '1rem', lineHeight: 1, letterSpacing: '-0.03em' }}>
            GenBI
          </Typography>
          <Typography sx={{ mt: 0.4, fontSize: mode === 'hero' ? '0.72rem' : '0.58rem', color: '#8b949e' }}>
            {mode === 'hero' ? 'Конструктор' : 'К обзору'}
          </Typography>
        </Box>

        {/* Petals */}
        {PETAL_FLOW_CONFIG.map((pc) => {
          const angle = PETAL_ANGLES[pc.key];
          const rad = (angle - 90) * (Math.PI / 180);
          const px = cx + dims.orbitRadius * Math.cos(rad) - dims.petalSize / 2;
          const py = cy + dims.orbitRadius * Math.sin(rad) - dims.petalSize / 2;
          const status = petals[pc.key];
          const sv = getStatusVisual(status);
          const hl = hovered === pc.key || activePetal === pc.key;
          const enabled = petalEnabled[pc.key];

          return (
            <Box
              key={pc.key}
              onMouseEnter={() => {
                setHovered(pc.key);
                onPetalSelect?.(pc.key);
              }}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onPetalClick(pc.key)}
              sx={{
                position: 'absolute',
                left: px,
                top: py,
                width: dims.petalSize,
                height: dims.petalSize,
                borderRadius: '50%',
                bgcolor: hl ? `${pc.color}22` : sv.bg,
                border: `2px solid ${hl ? pc.color : sv.borderColor}`,
                boxShadow: hl
                  ? `0 0 30px ${pc.glowColor}, 0 10px 28px rgba(0,0,0,0.3)`
                  : status === 'grey'
                    ? '0 4px 14px rgba(0,0,0,0.16)'
                    : `0 0 14px ${pc.glowColor}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 3,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hl ? 'scale(1.12)' : 'scale(1)',
                opacity: !enabled && status === 'grey' ? 0.5 : 1,
              }}
            >
              <Box sx={{
                color: hl ? pc.color : (status === 'grey' ? '#6e7681' : pc.color),
                display: 'flex', mb: 0.3,
                '& .MuiSvgIcon-root': { fontSize: mode === 'hero' ? 26 : 20 },
              }}>
                {PETAL_ICONS[pc.key]}
              </Box>
              <Typography
                sx={{
                  fontSize: mode === 'hero' ? '0.76rem' : '0.58rem',
                  fontWeight: 700,
                  color: hl ? '#e6edf3' : (status === 'grey' ? '#6e7681' : '#c9d1d9'),
                  textAlign: 'center',
                  lineHeight: 1.05,
                  px: 0.4,
                }}
              >
                {pc.shortLabel}
              </Typography>

              {/* Status dot */}
              {status !== 'grey' && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: sv.dotColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {status === 'green'
                    ? <CheckCircleIcon sx={{ fontSize: 11, color: '#fff' }} />
                    : <HourglassBottomIcon sx={{ fontSize: 10, color: '#fff' }} />
                  }
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Project name and progress (hero mode only) */}
      {mode === 'hero' && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.03em' }}>
            {projectName || 'Новая предметная область'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1.25 }}>
            <Chip
              label={`${greenCount}/${activeCount} готово`}
              size="small"
              sx={{
                height: 24,
                bgcolor: 'rgba(46,160,67,0.1)',
                color: '#3fb950',
                border: '1px solid rgba(46,160,67,0.2)',
              }}
            />
            <Chip
              label={`${activeCount}/${PETAL_FLOW_CONFIG.length} активно`}
              size="small"
              sx={{
                height: 24,
                bgcolor: 'rgba(77,208,225,0.1)',
                color: '#4dd0e1',
                border: '1px solid rgba(77,208,225,0.2)',
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PetalNav;

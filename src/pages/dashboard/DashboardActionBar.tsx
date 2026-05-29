import { Box, Button, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BarChartIcon from '@mui/icons-material/BarChart';
import FilterListIcon from '@mui/icons-material/FilterList';
import TableChartIcon from '@mui/icons-material/TableChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import type { DashboardExportTarget } from '../../api';
import type { DashboardWidgetType } from '../../types';

export type ExportActionTarget = DashboardExportTarget | 'foresight_publish' | 'datalens_publish' | 'datalens_native_publish';

const PALETTE_ITEMS: Array<{ type: DashboardWidgetType; label: string; icon: React.ReactNode }> = [
  { type: 'kpi', label: 'KPI', icon: <TrendingUpIcon /> },
  { type: 'chart', label: 'График', icon: <BarChartIcon /> },
  { type: 'table', label: 'Таблица', icon: <TableChartIcon /> },
  { type: 'filter', label: 'Фильтр', icon: <FilterListIcon /> },
];

const INTEGRATION_ACTIONS: Array<{ target: ExportActionTarget; label: string; icon: 'download' | 'share' }> = [
  { target: 'navigator', label: 'Навигатор', icon: 'download' },
  { target: 'datalens', label: 'DataLens', icon: 'download' },
  { target: 'datalens_publish', label: 'DataLens publish', icon: 'share' },
  { target: 'datalens_native_publish', label: 'DataLens native', icon: 'share' },
  { target: 'superset', label: 'Superset', icon: 'download' },
  { target: 'foresight', label: 'Foresight', icon: 'download' },
  { target: 'foresight_publish', label: 'Foresight publish', icon: 'share' },
  { target: 'visiology', label: 'Visiology', icon: 'share' },
];

interface DashboardActionBarProps {
  exportMenuAnchorEl: HTMLElement | null;
  exportMenuOpen: boolean;
  integrationMenuAnchorEl: HTMLElement | null;
  integrationMenuOpen: boolean;
  exportingTarget: ExportActionTarget | null;
  mockupPreviewUrl?: string;
  sourceImageOpen?: boolean;
  onOpenAddFlow: (type: DashboardWidgetType) => void;
  onSetExportMenuAnchorEl: (anchor: HTMLElement | null) => void;
  onSetIntegrationMenuAnchorEl: (anchor: HTMLElement | null) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportPdf: () => void;
  onExportPresentation: () => void;
  onIntegrationAction: (target: ExportActionTarget) => void;
  onToggleSourceImage?: () => void;
}

export const DashboardActionBar: React.FC<DashboardActionBarProps> = ({
  exportMenuAnchorEl,
  exportMenuOpen,
  integrationMenuAnchorEl,
  integrationMenuOpen,
  exportingTarget,
  mockupPreviewUrl,
  sourceImageOpen,
  onOpenAddFlow,
  onSetExportMenuAnchorEl,
  onSetIntegrationMenuAnchorEl,
  onExportPng,
  onExportSvg,
  onExportPdf,
  onExportPresentation,
  onIntegrationAction,
  onToggleSourceImage,
}) => (
  <Box
    sx={{
      position: 'sticky',
      top: 0,
      zIndex: 12,
      mb: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.5,
      flexWrap: 'wrap',
      px: 1,
      py: 0.8,
      borderRadius: 1.5,
      bgcolor: 'rgba(var(--app-bg-rgb), 0.92)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 10px 28px rgba(0,0,0,0.24)',
      backdropFilter: 'blur(14px)',
    }}
  >
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      {PALETTE_ITEMS.map(item => (
        <Button
          key={item.type}
          variant="text"
          size="small"
          startIcon={item.icon}
          endIcon={<AddIcon />}
          onClick={() => onOpenAddFlow(item.type)}
          sx={{ textTransform: 'none', px: 1.2, bgcolor: 'rgba(var(--app-surface-alt-rgb), 0.72)' }}
        >
          {item.label}
        </Button>
      ))}
    </Box>

    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      {mockupPreviewUrl && (
        <Button
          variant={sourceImageOpen ? 'contained' : 'outlined'}
          size="small"
          startIcon={<CompareArrowsIcon />}
          onClick={onToggleSourceImage}
          sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
        >
          Исходное изображение
        </Button>
      )}
      <Button
        variant="contained"
        size="small"
        startIcon={<DownloadIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        onMouseEnter={(event) => onSetExportMenuAnchorEl(event.currentTarget)}
        onClick={(event) => onSetExportMenuAnchorEl(event.currentTarget)}
      >
        Экспорт
      </Button>
      <Menu
        anchorEl={exportMenuAnchorEl}
        open={exportMenuOpen}
        onClose={() => onSetExportMenuAnchorEl(null)}
        MenuListProps={{ onMouseLeave: () => onSetExportMenuAnchorEl(null), dense: true }}
        PaperProps={{ sx: { bgcolor: '#1e2130', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.10)' } }}
        slotProps={{ paper: { sx: { bgcolor: '#1e2130', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.10)' } } }}
      >
        <MenuItem onClick={() => { onSetExportMenuAnchorEl(null); onExportPng(); }} sx={{ color: '#f8fafc', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
          <DownloadIcon fontSize="small" sx={{ mr: 1 }} /> PNG
        </MenuItem>
        <MenuItem onClick={() => { onSetExportMenuAnchorEl(null); onExportSvg(); }} sx={{ color: '#f8fafc', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
          <DownloadIcon fontSize="small" sx={{ mr: 1 }} /> SVG
        </MenuItem>
        <MenuItem onClick={() => { onSetExportMenuAnchorEl(null); onExportPdf(); }} sx={{ color: '#f8fafc', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
          <DownloadIcon fontSize="small" sx={{ mr: 1 }} /> PDF
        </MenuItem>
      </Menu>

      <Button variant="contained" size="small" startIcon={<SlideshowIcon />} onClick={onExportPresentation}>
        Презентация
      </Button>

      <Button
        variant="contained"
        size="small"
        startIcon={<ShareIcon />}
        endIcon={<KeyboardArrowDownIcon />}
        disabled={Boolean(exportingTarget)}
        onMouseEnter={(event) => onSetIntegrationMenuAnchorEl(event.currentTarget)}
        onClick={(event) => onSetIntegrationMenuAnchorEl(event.currentTarget)}
      >
        {exportingTarget ? 'Интеграция...' : 'Интеграции'}
      </Button>
      <Menu
        anchorEl={integrationMenuAnchorEl}
        open={integrationMenuOpen}
        onClose={() => onSetIntegrationMenuAnchorEl(null)}
        MenuListProps={{ onMouseLeave: () => onSetIntegrationMenuAnchorEl(null), dense: true }}
        PaperProps={{ sx: { bgcolor: '#1e2130', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.10)' } }}
        slotProps={{ paper: { sx: { bgcolor: '#1e2130', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.10)' } } }}
      >
        {INTEGRATION_ACTIONS.map(action => (
          <MenuItem
            key={action.target}
            disabled={Boolean(exportingTarget)}
            onClick={() => onIntegrationAction(action.target)}
            sx={{ color: '#f8fafc', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
          >
            {action.icon === 'share' ? <ShareIcon fontSize="small" sx={{ mr: 1 }} /> : <DownloadIcon fontSize="small" sx={{ mr: 1 }} />}
            {exportingTarget === action.target ? 'Выполняется...' : action.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  </Box>
);

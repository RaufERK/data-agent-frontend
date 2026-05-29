import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import TableChartIcon from '@mui/icons-material/TableChart';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';

export type AppStep = 'upload' | 'data' | 'model' | 'dashboard' | 'subject';

const PIPELINE: { key: AppStep; label: string; sublabel: string; icon: React.ReactNode }[] = [
  { key: 'upload',    label: 'Загрузка',  sublabel: 'Файлы и источники',  icon: <UploadFileIcon sx={{ fontSize: 20 }} /> },
  { key: 'data',      label: 'Данные',    sublabel: 'Просмотр и очистка', icon: <TableChartIcon sx={{ fontSize: 20 }} /> },
  { key: 'model',     label: 'Модель',    sublabel: 'Проектирование ERD',  icon: <AccountTreeIcon sx={{ fontSize: 20 }} /> },
  { key: 'dashboard', label: 'Дашборд',   sublabel: 'Визуализация',       icon: <DashboardIcon sx={{ fontSize: 20 }} /> },
];

interface StepSidebarProps {
  currentStep: AppStep;
  onStepClick: (step: AppStep) => void;
  completedSteps: Set<AppStep>;
  domainLabel?: string;
  onHelpClick?: () => void;
}

const StepSidebar: React.FC<StepSidebarProps> = ({ currentStep, onStepClick, completedSteps, onHelpClick }) => {
  const handleKeyboardClick = (event: React.KeyboardEvent, action?: () => void) => {
    if (!action) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <Box sx={{
      width: 64,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      bgcolor: 'rgba(var(--app-surface-rgb), 0.95)',
      borderRight: '1px solid var(--app-border)',
      py: 2,
      gap: 0.5,
      flexShrink: 0,
    }}>
      {/* Pipeline steps */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
        {PIPELINE.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isDone = completedSteps.has(step.key);
          const isDashboard = step.key === 'dashboard';
          const isAccessible = idx === 0
            || completedSteps.has(PIPELINE[idx - 1].key)
            || (isDashboard && completedSteps.has('data'))
            || isDone
            || isActive;
          return (
            <Tooltip key={step.key} title={
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{step.label}</Typography>
                <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>{step.sublabel}</Typography>
              </Box>
            } placement="right" arrow>
              <Box
                role="button"
                tabIndex={isAccessible ? 0 : -1}
                aria-label={`${step.label}. ${step.sublabel}`}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={!isAccessible}
                onClick={() => isAccessible && onStepClick(step.key)}
                onKeyDown={(event) => handleKeyboardClick(event, isAccessible ? () => onStepClick(step.key) : undefined)}
                sx={{
                width: 44, height: 44, borderRadius: 2.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isAccessible ? 'pointer' : 'default',
                transition: 'all 0.2s',
                bgcolor: isActive ? 'rgba(var(--app-accent-rgb), 0.16)' : isDone ? 'rgba(var(--app-accent-rgb), 0.06)' : 'transparent',
                border: isActive ? '1.5px solid var(--app-accent)' : isDone ? '1.5px solid rgba(var(--app-accent-rgb), 0.35)' : '1.5px solid transparent',
                color: isActive ? 'var(--app-accent)' : isDone ? 'rgba(var(--app-accent-rgb), 0.7)' : isAccessible ? 'var(--app-subtle-text)' : 'rgba(var(--app-subtle-text-rgb), 0.3)',
                '&:hover': isAccessible ? { bgcolor: 'rgba(var(--app-accent-rgb), 0.1)', color: 'var(--app-accent)', border: '1.5px solid rgba(var(--app-accent-rgb), 0.4)' } : {},
                '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 },
              }}>
                {step.icon}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Subject area button */}
      <Tooltip title={
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Предметная область</Typography>
          <Typography sx={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>Обзор проекта</Typography>
        </Box>
      } placement="right" arrow>
        <Box
          role="button"
          tabIndex={0}
          aria-label="Предметная область. Обзор проекта"
          aria-current={currentStep === 'subject' ? 'page' : undefined}
          onClick={() => onStepClick('subject')}
          onKeyDown={(event) => handleKeyboardClick(event, () => onStepClick('subject'))}
          sx={{
          width: 44, height: 44, borderRadius: 2.5, mb: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s',
          bgcolor: currentStep === 'subject' ? 'rgba(var(--app-accent-rgb), 0.16)' : 'transparent',
          border: currentStep === 'subject' ? '1.5px solid var(--app-accent)' : '1.5px solid transparent',
          color: currentStep === 'subject' ? 'var(--app-accent)' : 'var(--app-subtle-text)',
          '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb), 0.1)', color: 'var(--app-accent)', border: '1.5px solid rgba(var(--app-accent-rgb), 0.4)' },
          '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 },
        }}>
          <FolderSpecialIcon sx={{ fontSize: 20 }} />
        </Box>
      </Tooltip>

      {/* Help button */}
      <Tooltip title="Как пользоваться" placement="right" arrow>
        <Box
          role="button"
          tabIndex={0}
          aria-label="Открыть обучение"
          onClick={onHelpClick}
          onKeyDown={(event) => handleKeyboardClick(event, onHelpClick)}
          sx={{
            width: 36, height: 36,
            borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--app-subtle-text)',
            border: '1.5px solid var(--app-border)',
            transition: 'all 0.2s',
            '&:hover': {
              color: 'var(--app-accent)',
              borderColor: 'rgba(var(--app-accent-rgb), 0.4)',
              bgcolor: 'rgba(var(--app-accent-rgb), 0.08)',
            },
            '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 },
          }}
        >
          <HelpOutlineIcon sx={{ fontSize: 18 }} />
        </Box>
      </Tooltip>
    </Box>
  );
};

export default StepSidebar;

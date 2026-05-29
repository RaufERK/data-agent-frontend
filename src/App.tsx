import React, { useState, useCallback, useRef } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Alert, Box, Button, CircularProgress, LinearProgress, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import OnboardingModal from './components/Layout/OnboardingModal';
import ErrorBoundary from './components/ErrorBoundary';
import { ProjectProvider, useProject } from './store/ProjectContext';
import ModelPage from './pages/ModelPage';
import DashboardPage from './pages/DashboardPage';
import ChatPanel from './components/Chat/ChatPanel';
import StepSidebar, { type AppStep } from './components/Layout/StepSidebar';
import UploadPage from './pages/UploadPage';
import DataView from './pages/DataView';
import SubjectPage from './pages/SubjectPage';
import { api, type AuthUser, type QuotasResult } from './api';

const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 680;
const DEFAULT_CHAT_WIDTH = 360;

const APP_COLORS = {
  bg: '#181819',
  surface: '#1f1f22',
  panel: '#262629',
  border: '#565b62',
  borderStrong: '#7d838a',
  text: '#f2f4f7',
  subtleText: '#b2b8bf',
  accent: '#21a19a',
  accentStrong: '#107f8c',
  warning: '#ffdd64',
  warningStrong: '#ffb13b',
  success: '#21a19a',
  danger: '#db1237',
  info: '#198cfe',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: APP_COLORS.accent, dark: APP_COLORS.accentStrong, contrastText: APP_COLORS.text },
    secondary: { main: APP_COLORS.warning, contrastText: APP_COLORS.bg },
    success: { main: APP_COLORS.success },
    warning: { main: APP_COLORS.warningStrong },
    error: { main: APP_COLORS.danger },
    info: { main: APP_COLORS.info },
    background: {
      default: APP_COLORS.bg,
      paper: APP_COLORS.surface,
    },
    divider: APP_COLORS.border,
    text: {
      primary: APP_COLORS.text,
      secondary: APP_COLORS.subtleText,
      disabled: APP_COLORS.borderStrong,
    },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: '"SB Sans Text", "SBSansUI", "Segoe UI", sans-serif',
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 700, letterSpacing: '-0.02em' },
    button: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: 'transparent',
          color: 'var(--app-text)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 6,
          paddingLeft: 20,
          paddingRight: 20,
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, var(--app-accent-strong) 0%, var(--app-accent) 100%)',
          boxShadow: 'none',
          '&:hover': {
            background: 'linear-gradient(135deg, var(--app-accent) 0%, var(--app-accent-strong) 100%)',
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
          '&:hover': {
            borderColor: 'var(--app-accent)',
            backgroundColor: 'rgba(var(--app-accent-rgb), 0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          boxShadow: 'var(--app-shadow)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          boxShadow: 'var(--app-shadow)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: 'var(--app-subtle-text)',
          borderRadius: 5,
          '&:hover': {
            backgroundColor: 'rgba(var(--app-accent-rgb), 0.1)',
            color: 'var(--app-text)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(var(--app-surface-rgb), 0.92)',
            '& fieldset': { borderColor: 'var(--app-border)' },
            '&:hover fieldset': { borderColor: 'var(--app-border-strong)' },
            '&.Mui-focused fieldset': {
              borderColor: 'var(--app-warning)',
              boxShadow: '0 0 0 1px var(--app-warning)',
            },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(var(--app-accent-rgb), 0.12)',
          borderRadius: 6,
        },
        bar: {
          borderRadius: 6,
          background: 'linear-gradient(90deg, var(--app-accent-strong) 0%, var(--app-warning) 100%)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'var(--app-border)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'var(--app-panel)',
          color: 'var(--app-text)',
          border: '1px solid var(--app-border)',
        },
      },
    },
  },
});

// ── step accessibility ────────────────────────────────────────────────────────
const getCompletedSteps = (status: string): Set<AppStep> => {
  const done = new Set<AppStep>();
  const order: Record<string, AppStep[]> = {
    files_uploaded: ['upload'],
    analyzing: ['upload'],
    analyzed: ['upload', 'data'],
    cleaning: ['upload', 'data'],
    cleaned: ['upload', 'data'],
    building_detail: ['upload', 'data'],
    detail_built: ['upload', 'data'],
    building_mart: ['upload', 'data'],
    mart_built: ['upload', 'data'],
    generating_erd: ['upload', 'data'],
    erd_generated: ['upload', 'data', 'model'],
    building_dashboard: ['upload', 'data', 'model'],
    dashboard_built: ['upload', 'data', 'model', 'dashboard'],
    complete: ['upload', 'data', 'model', 'dashboard'],
  };
  (order[status] ?? []).forEach(s => done.add(s));
  return done;
};

const QUOTA_LABELS: Record<keyof QuotasResult['quotas'], string> = {
  upload_files: 'Файлы',
  assistant_questions: 'Вопросы',
  dashboard_generations: 'Дашборды',
  vision_analyses: 'Картинки',
};

const QUOTA_ORDER: Array<keyof QuotasResult['quotas']> = [
  'vision_analyses',
  'assistant_questions',
  'upload_files',
  'dashboard_generations',
];

const formatUploadLimit = (maxUploadMb: number): string => {
  if (maxUploadMb >= 1024) {
    const gb = maxUploadMb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} ГБ`;
  }
  return `${maxUploadMb} МБ`;
};

const QuotaUsageBar: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [quotas, setQuotas] = useState<QuotasResult | null>(null);

  React.useEffect(() => {
    let alive = true;
    const load = () => {
      Promise.all([api.me(), api.getQuotas()])
        .then(([nextUser, nextQuotas]) => {
          if (!alive) return;
          setUser(nextUser);
          setQuotas(nextQuotas);
        })
        .catch(() => {
          if (!alive) return;
          setUser(null);
          setQuotas(null);
        });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!quotas || user?.role === 'admin') return null;

  return (
    <Box sx={{
      flexShrink: 0,
      px: { xs: 1.5, md: 2 },
      py: 1,
      borderBottom: '1px solid var(--app-border)',
      bgcolor: 'rgba(var(--app-panel-rgb), 0.72)',
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' },
      gap: 1,
    }}>
      {QUOTA_ORDER.map(key => {
        const item = quotas.quotas[key];
        const pct = item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0;
        const color = pct >= 90 ? 'var(--app-danger)' : pct >= 70 ? 'var(--app-warning-strong)' : 'var(--app-accent)';
        return (
          <Tooltip key={key} title={`${QUOTA_LABELS[key]} за 24 часа: использовано ${item.used} из ${item.limit}. Осталось ${item.remaining}.`}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
                <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{QUOTA_LABELS[key]}</Typography>
                <Typography sx={{ color: 'var(--app-text)', fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {item.used}/{item.limit}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  height: 6,
                  borderRadius: 99,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': { bgcolor: color, background: color },
                }}
              />
            </Box>
          </Tooltip>
        );
      })}
      <Tooltip title={`Ограничение размера одного загружаемого файла: ${formatUploadLimit(quotas.upload.max_upload_mb)}.`}>
        <Box sx={{
          minWidth: 0,
          border: '1px solid var(--app-border)',
          borderRadius: 1,
          px: 1,
          py: 0.65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          bgcolor: 'rgba(var(--app-surface-rgb), 0.72)',
        }}>
          <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Размер файла</Typography>
          <Typography sx={{ color: 'var(--app-text)', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
            до {formatUploadLimit(quotas.upload.max_upload_mb)}
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
};

const SberLogo: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="8" fill="#21A038"/>
    <path d="M32.6 15.3L34 16.7C31.2 10.2 24.7 5.7 17.1 6C9.1 6.4 2.6 12.9 2.1 20.9C1.5 29.5 8.4 36.7 17 37C23.7 37.3 29.4 33.4 32 27.6L26.8 25.2C25.2 28.7 21.6 31.1 17.4 31C11.8 30.8 7.2 26.3 7 20.6C6.8 14.8 11.3 10 17 10C20.2 10 23 11.4 24.9 13.6L20.4 18.1L32.6 15.3Z" fill="white"/>
  </svg>
);

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const nextUser = await api.login(email, password);
      localStorage.removeItem('data_agent_projects_v1');
      localStorage.removeItem('data_agent_session_v1');
      setUser(nextUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <Box className="triplex-night-app" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'var(--app-bg)' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box className="triplex-night-app" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'var(--app-bg)', p: 3 }}>
        <Paper sx={{ width: '100%', maxWidth: 420, p: 3 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h5">Вход</Typography>
              <Typography variant="body2" color="text.secondary">Data Agent</Typography>
            </Box>

            <Button
              variant="contained"
              size="large"
              startIcon={<SberLogo />}
              href="/api/oidc/login"
              sx={{
                bgcolor: '#21A038',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                py: 1.4,
                '&:hover': { bgcolor: '#1a8030' },
              }}
            >
              Войти через Sberanalytics
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { project, activeProjectId, chatCollapsed, setChatCollapsed, activeSection, triggerStepMessage } = useProject();

  const [currentStep, setCurrentStep] = useState<AppStep>('upload');
  const prevProjectIdRef = React.useRef<string | null>(activeProjectId);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('genbi:onboarding:v1') !== 'done');
  const dragging = useRef(false);

  const status = project?.status ?? 'empty';
  const completedSteps = getCompletedSteps(status);

  const DOMAIN_LABELS: Record<string, string> = {
    genbi_access_requests: 'Управление доступами',
    dashboard_mockup: 'Дашборд по макету',
  };
  const domainLabel = project ? (DOMAIN_LABELS[project.name] ?? project.name) : undefined;

  // When active project changes (switch or create) → go to subject page
  React.useEffect(() => {
    if (activeProjectId !== prevProjectIdRef.current) {
      prevProjectIdRef.current = activeProjectId;
      setCurrentStep('subject');
    }
  }, [activeProjectId]);


  // Sync with context navigation (e.g. ModelPage calls goToPetalStep('dashboard'))
  React.useEffect(() => {
    if (activeSection === 'dashboard') setCurrentStep('dashboard');
    else if (activeSection === 'model' || activeSection === 'mart') setCurrentStep('model');
    else if (activeSection === 'data') setCurrentStep('data');
  }, [activeSection]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const container = document.getElementById('app-main-area');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, rect.right - ev.clientX));
      setChatWidth(newWidth);
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const goToStep = useCallback((step: AppStep) => {
    setCurrentStep(step);
    if (step !== 'subject') triggerStepMessage(step);
  }, [triggerStepMessage]);

  const closeOnboarding = useCallback(() => {
    localStorage.setItem('genbi:onboarding:v1', 'done');
    setOnboardingOpen(false);
  }, []);

  React.useEffect(() => {
    const collapseOnMobile = () => {
      if (window.innerWidth <= 700) setChatCollapsed(true);
    };
    collapseOnMobile();
    window.addEventListener('resize', collapseOnMobile);
    return () => window.removeEventListener('resize', collapseOnMobile);
  }, [setChatCollapsed]);

  const renderPage = () => {
    switch (currentStep) {
      case 'subject':
        return <SubjectPage onNavigate={goToStep} />;
      case 'upload':
        return <UploadPage onContinue={() => goToStep('data')} onImageDashboard={() => goToStep('dashboard')} />;
      case 'data':
        return <DataView onContinue={() => goToStep('model')} />;
      case 'model':
        return <ModelPage />;
      case 'dashboard':
        return <DashboardPage />;
    }
  };

  return (
    <Box className="triplex-night-app" sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'var(--app-bg)' }}>
      <OnboardingModal open={onboardingOpen} onClose={closeOnboarding} />

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <StepSidebar
        currentStep={currentStep}
        onStepClick={setCurrentStep}
        completedSteps={completedSteps}
        domainLabel={domainLabel}
        onHelpClick={() => setOnboardingOpen(true)}
      />

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <Box id="app-main-area" sx={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minWidth: 0 }}>

        {/* Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <QuotaUsageBar />
          {/* Page */}
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {renderPage()}
          </Box>
        </Box>

        {/* Drag handle */}
        {!chatCollapsed && (
          <Box
            onMouseDown={handleMouseDown}
            sx={{
              width: 5, cursor: 'col-resize', flexShrink: 0,
              bgcolor: 'transparent',
              '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb), 0.2)' },
              transition: 'background-color 0.2s',
            }}
          />
        )}

        {/* Chat panel — always mounted so ChatPanel handles collapsed state itself */}
        <Box sx={{
          width: chatCollapsed ? 0 : chatWidth,
          minWidth: chatCollapsed ? 0 : MIN_CHAT_WIDTH,
          maxWidth: MAX_CHAT_WIDTH,
          height: '100%',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width 0.2s',
        }}>
          <ChatPanel />
        </Box>
      </Box>
    </Box>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthGate>
          <ProjectProvider>
            <AppContent />
          </ProjectProvider>
        </AuthGate>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;

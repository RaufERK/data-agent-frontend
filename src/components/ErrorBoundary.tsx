import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Box
        className="triplex-night-app"
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'var(--app-bg)',
          p: 3,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 560 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Интерфейс столкнулся с ошибкой</Typography>
            <Typography sx={{ fontSize: '0.9rem' }}>
              Обновите страницу. Если ошибка повторится, сохраните текущий сценарий и проверьте консоль разработчика.
            </Typography>
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
        </Box>
      </Box>
    );
  }
}

export default ErrorBoundary;

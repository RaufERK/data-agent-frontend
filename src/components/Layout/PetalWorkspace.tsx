import React from 'react';
import { Box } from '@mui/material';

interface PetalWorkspaceProps {
  children: React.ReactNode;
}

const PetalWorkspace: React.FC<PetalWorkspaceProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'auto',
        p: { xs: 2, md: 3 },
        background: 'linear-gradient(180deg, rgba(var(--app-surface-rgb), 0.98) 0%, rgba(var(--app-panel-rgb), 0.98) 100%)',
      }}>
        {children}
      </Box>
    </Box>
  );
};

export default PetalWorkspace;

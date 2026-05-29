import React from 'react';
import { Box } from '@mui/material';
import Canvas from '../components/Canvas/Canvas';

const ProjectOverview: React.FC = () => {
  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
      <Box sx={{
        width: '100%', height: '100%', p: { xs: 2.5, md: 4 },
        background: 'radial-gradient(circle at top, rgba(var(--app-accent-rgb), 0.12), rgba(var(--app-bg-rgb), 0.98) 62%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        overflow: 'auto',
      }}>
        <Canvas />
      </Box>
    </Box>
  );
};

export default ProjectOverview;

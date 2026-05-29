import { Box, Typography } from '@mui/material';
import type { CleaningDiff } from '../../types';

interface DataDiffPreviewProps {
  diff: CleaningDiff;
}

export const DataDiffPreview: React.FC<DataDiffPreviewProps> = ({ diff }) => (
  <Box sx={{ borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${diff.context.headers.length}, minmax(0, 1fr))`, bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid', borderColor: 'divider' }}>
      {diff.context.headers.map(header => (
        <Box key={header} sx={{ px: 1.1, py: 0.7 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{header}</Typography>
        </Box>
      ))}
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${diff.context.before.length}, minmax(0, 1fr))`, bgcolor: 'rgba(248,81,73,0.08)', borderBottom: '1px solid', borderColor: 'divider' }}>
      {diff.context.before.map((value, idx) => {
        const changed = value !== diff.context.after[idx];
        return (
          <Box key={idx} sx={{ px: 1.1, py: 0.8 }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.76rem', color: changed ? 'error.main' : 'text.secondary', textDecoration: changed ? 'line-through' : 'none' }}>
              {value || '(пусто)'}
            </Typography>
          </Box>
        );
      })}
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${diff.context.after.length}, minmax(0, 1fr))`, bgcolor: 'rgba(63,185,80,0.08)' }}>
      {diff.context.after.map((value, idx) => {
        const changed = value !== diff.context.before[idx];
        return (
          <Box key={idx} sx={{ px: 1.1, py: 0.8 }}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.76rem', color: changed ? 'success.main' : 'text.secondary' }}>
              {value || '(пусто)'}
            </Typography>
          </Box>
        );
      })}
    </Box>
  </Box>
);

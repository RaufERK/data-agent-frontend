import React, { useState } from 'react';
import {
  Box, Typography, Divider, LinearProgress, Button,
  IconButton, TextField, Collapse, Tooltip, Menu, MenuItem,
} from '@mui/material';
import SchemaIcon from '@mui/icons-material/Schema';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { useProject } from '../../store/ProjectContext';

const SIDEBAR_WIDTH = 272;

const activateOnKeyboard = (event: React.KeyboardEvent, action: () => void) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
};

function getProjectArtifacts(project: {
  files: { name: string }[];
  imageFile: { name: string } | null;
  erdGenerated: boolean;
  dashboardBuilt: boolean;
  detailTables: { name: string }[];
  selectedERDModel: string;
}) {
  const items: { icon: React.ReactNode; label: string }[] = [];
  project.files.forEach(f => {
    items.push({ icon: <DescriptionIcon sx={{ fontSize: 16 }} />, label: f.name });
  });
  if (project.imageFile) {
    items.push({ icon: <ImageIcon sx={{ fontSize: 16 }} />, label: project.imageFile.name });
  }
  if (project.detailTables.length > 0) {
    items.push({ icon: <TableChartIcon sx={{ fontSize: 16 }} />, label: `Детальный слой (${project.detailTables.length})` });
  }
  if (project.erdGenerated) {
    const names: Record<string, string> = { no_model: 'Без модели', star: 'Звезда', snowflake: 'Снежинка', datavault: 'Data Vault' };
    items.push({ icon: <SchemaIcon sx={{ fontSize: 16 }} />, label: `Модель: ${names[project.selectedERDModel] || project.selectedERDModel}` });
  }
  if (project.dashboardBuilt) {
    items.push({ icon: <BarChartIcon sx={{ fontSize: 16 }} />, label: 'Дашборд' });
  }
  return items;
}

const Sidebar: React.FC = () => {
  const {
    projects, activeProjectId, switchProject,
    runFullPipeline, pipelineRunning, pipelineStep,
    createProject, renameProject, deleteProject,
  } = useProject();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; projectId: string } | null>(null);

  const handleBuildAll = () => {
    void runFullPipeline();
  };

  return (
    <Box sx={{
      width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH, height: '100vh',
      bgcolor: '#010409', borderRight: '1px solid #30363d',
      display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, zIndex: 1200,
    }}>
      <Box sx={{ p: 2.5, pb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.5px' }}>BI Painter</Typography>
        <Typography variant="caption" sx={{ color: '#8b949e' }}>GenBI Platform</Typography>
      </Box>
      <Divider sx={{ borderColor: '#30363d' }} />

      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: '#8b949e', textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.8px', fontWeight: 700 }}>
            Предметные области ({projects.length})
          </Typography>
          <Tooltip title="Новая предметная область">
            <IconButton size="small" aria-label="Создать новую предметную область" onClick={() => createProject(`Предметная область ${projects.length + 1}`)}
              sx={{ color: '#8b949e', '&:hover': { color: '#4dd0e1' } }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {projects.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <FolderOpenIcon sx={{ fontSize: 32, color: '#30363d', mb: 0.5 }} />
            <Typography variant="caption" sx={{ color: '#484f58', display: 'block' }}>Загрузите данные, чтобы начать</Typography>
          </Box>
        )}

        <Box sx={{ maxHeight: 200, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#30363d', borderRadius: 2 } }}>
          {projects.map(proj => {
            const isActive = proj.id === activeProjectId;
            const isExpanded = expandedId === proj.id;
            const isRenaming = renamingId === proj.id;
            const artifacts = getProjectArtifacts(proj);

            return (
              <Box key={proj.id} sx={{ mb: 0.5 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', px: 1, py: 0.5, borderRadius: 1,
                  bgcolor: isActive ? 'rgba(77,208,225,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid #4dd0e1' : '2px solid transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                }}>
                  <IconButton size="small" aria-label={`${isExpanded ? 'Свернуть' : 'Развернуть'} область ${proj.name}`} onClick={() => setExpandedId(isExpanded ? null : proj.id)}
                    sx={{ p: 0.25, mr: 0.5, color: '#484f58' }}>
                    {isExpanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                  </IconButton>

                  {isRenaming ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 0.5 }}>
                      <TextField size="small" variant="standard" autoFocus value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && renameValue.trim()) { renameProject(proj.id, renameValue.trim()); setRenamingId(null); } if (e.key === 'Escape') setRenamingId(null); }}
                        sx={{ '& input': { color: '#e6edf3', fontSize: '0.75rem' }, '& .MuiInput-underline:before': { borderColor: '#30363d' } }}
                      />
                      <IconButton size="small" aria-label="Сохранить название области" onClick={() => { if (renameValue.trim()) renameProject(proj.id, renameValue.trim()); setRenamingId(null); }} sx={{ p: 0.25, color: '#3fb950' }}>
                        <CheckIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton size="small" aria-label="Отменить переименование области" onClick={() => setRenamingId(null)} sx={{ p: 0.25, color: '#f85149' }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-label={`Открыть предметную область ${proj.name}`}
                      aria-current={isActive ? 'page' : undefined}
                      sx={{ flexGrow: 1, cursor: 'pointer', minWidth: 0, '&:focus-visible': { outline: '2px solid #4dd0e1', outlineOffset: 2 } }}
                      onClick={() => switchProject(proj.id)}
                      onKeyDown={(event) => activateOnKeyboard(event, () => switchProject(proj.id))}
                    >
                      <Typography variant="body2" noWrap sx={{ color: isActive ? '#e6edf3' : '#8b949e', fontWeight: isActive ? 600 : 400, fontSize: '0.8rem' }}>
                        {proj.name}
                      </Typography>
                      <Typography variant="caption" noWrap sx={{ color: '#484f58', fontSize: '0.6rem' }}>
                        {proj.files.length > 0 ? `${proj.files.length} файлов` : 'пусто'}
                        {proj.dashboardBuilt ? ' • Дашборд' : ''}
                      </Typography>
                    </Box>
                  )}

                  {!isRenaming && (
                    <IconButton size="small" aria-label={`Открыть меню области ${proj.name}`} onClick={e => setMenuAnchor({ el: e.currentTarget, projectId: proj.id })}
                      sx={{ p: 0.25, color: '#484f58', '&:hover': { color: '#8b949e' } }}>
                      <MoreVertIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>

                <Collapse in={isExpanded}>
                  <Box sx={{ ml: 3.5, mt: 0.25, mb: 0.5 }}>
                    {artifacts.length === 0
                      ? <Typography variant="caption" sx={{ color: '#484f58', fontSize: '0.65rem', fontStyle: 'italic' }}>Нет артефактов</Typography>
                      : artifacts.map((art, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.3, px: 0.75, borderRadius: 0.5 }}>
                          <Box sx={{ color: '#8b949e' }}>{art.icon}</Box>
                          <Typography variant="caption" noWrap sx={{ color: '#8b949e', fontSize: '0.7rem' }}>{art.label}</Typography>
                        </Box>
                      ))
                    }
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { bgcolor: '#161b22', border: '1px solid #30363d', minWidth: 160 } } }}>
        <MenuItem onClick={() => { const p = projects.find(pp => pp.id === menuAnchor?.projectId); if (p) { setRenameValue(p.name); setRenamingId(p.id); } setMenuAnchor(null); }}
          sx={{ fontSize: '0.8rem' }}>
          <EditIcon sx={{ fontSize: 16, mr: 1.5, color: '#8b949e' }} /> Переименовать
        </MenuItem>
        <MenuItem onClick={() => { if (menuAnchor) deleteProject(menuAnchor.projectId); setMenuAnchor(null); }}
          sx={{ fontSize: '0.8rem', color: '#f85149' }}>
          <DeleteIcon sx={{ fontSize: 16, mr: 1.5 }} /> Удалить
        </MenuItem>
      </Menu>

      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ borderColor: '#30363d' }} />

      <Box sx={{ p: 2 }}>
        {pipelineRunning ? (
          <Box>
            <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />
            <Typography variant="caption" sx={{ color: '#4dd0e1', display: 'block', textAlign: 'center' }}>{pipelineStep}</Typography>
          </Box>
        ) : (
          <Button fullWidth variant="contained" startIcon={<RocketLaunchIcon />} onClick={handleBuildAll}
            sx={{
              py: 1.5, fontWeight: 700, textTransform: 'none', fontSize: '0.9rem',
              background: 'linear-gradient(135deg, #4dd0e1 0%, #26c6da 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #26c6da 0%, #00bcd4 100%)' },
            }}>
            Построить дашборд
          </Button>
        )}
      </Box>
    </Box>
  );
};

export { SIDEBAR_WIDTH };
export default Sidebar;

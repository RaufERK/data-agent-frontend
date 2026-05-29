import React, { useEffect, useState } from 'react';
import {
  Box, Typography, IconButton, TextField, Tooltip, Chip,
  Button, Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartIcon from '@mui/icons-material/TableChart';
import ImageIcon from '@mui/icons-material/Image';
import SchemaIcon from '@mui/icons-material/Schema';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HistoryIcon from '@mui/icons-material/History';
import ReplayIcon from '@mui/icons-material/Replay';
import { useProject } from '../store/ProjectContext';
import { api, type AuthUser, type ModelSettingsResult, type SessionHistoryItem } from '../api';
import type { AppStep } from '../components/Layout/StepSidebar';

// ── Domain detection (keyword-based, no backend needed) ───────────────────────
const DOMAIN_RULES: { domain: string; emoji: string; color: string; keywords: string[]; metrics: string[] }[] = [
  {
    domain: 'Продажи / CRM', emoji: '💼', color: '#4dd0e1',
    keywords: ['продаж', 'клиент', 'сделк', 'воронк', 'лид', 'заказ', 'выручк', 'менеджер', 'конверс'],
    metrics: ['Выручка', 'Кол-во сделок', 'Конверсия', 'Средний чек', 'Новые клиенты'],
  },
  {
    domain: 'Финансы', emoji: '💰', color: '#66bb6a',
    keywords: ['бюджет', 'расход', 'доход', 'прибыл', 'платеж', 'деньг', 'руб', 'финанс', 'затрат'],
    metrics: ['Доходы', 'Расходы', 'Прибыль', 'Бюджет', 'Отклонение'],
  },
  {
    domain: 'Логистика', emoji: '🚚', color: '#ffb43b',
    keywords: ['доставк', 'склад', 'маршрут', 'перевоз', 'груз', 'отгруз', 'транспорт', 'заказ'],
    metrics: ['SLA доставки', 'Объём склада', 'Кол-во отгрузок', 'Задержки', 'Маршруты'],
  },
  {
    domain: 'Тендеры / Закупки', emoji: '📋', color: '#ab47bc',
    keywords: ['тендер', 'закупк', 'заявк', 'участник', 'победител', 'поставщик', 'договор', 'лот'],
    metrics: ['Кол-во заявок', 'Экономия', 'Победители', 'Сроки', 'Поставщики'],
  },
  {
    domain: 'Строительство', emoji: '🏗️', color: '#ff6e40',
    keywords: ['строитель', 'объект', 'смет', 'подряд', 'монтаж', 'ремонт', 'проект'],
    metrics: ['Объекты', 'Сметная стоимость', 'Выполнение', 'Подрядчики', 'Сроки'],
  },
  {
    domain: 'HR / Персонал', emoji: '👥', color: '#4fc3f7',
    keywords: ['сотрудник', 'персонал', 'кадр', 'отпуск', 'зарплат', 'штат', 'должност', 'табель'],
    metrics: ['Численность', 'Текучесть', 'ФОТ', 'Отсутствия', 'Вакансии'],
  },
];

function detectDomain(files: { sheets: { preview: string[][] }[] }[]) {
  if (files.length === 0) return null;
  const allText = files.flatMap(f =>
    f.sheets.flatMap(s => (s.preview[0] ?? []).concat(s.preview.slice(1, 5).flatMap(r => r)))
  ).join(' ').toLowerCase();

  let best: typeof DOMAIN_RULES[0] | null = null;
  let bestScore = 0;
  for (const rule of DOMAIN_RULES) {
    const score = rule.keywords.filter(kw => allText.includes(kw)).length;
    if (score > bestScore) { bestScore = score; best = rule; }
  }
  return bestScore >= 1 ? best : null;
}

// ── Artifact card ─────────────────────────────────────────────────────────────
function ArtifactCard({ icon, label, sublabel, onDelete, onClick }: {
  icon: React.ReactNode; label: string; sublabel?: string;
  onDelete?: () => void; onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <Box
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${label}${sublabel ? `. ${sublabel}` : ''}` : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 1.5, py: 1, borderRadius: 1.5,
        border: '1px solid var(--app-border)',
        bgcolor: hover ? 'rgba(var(--app-accent-rgb),0.05)' : 'var(--app-surface)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      <Box sx={{ color: 'var(--app-accent)', display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--app-text)' }}>{label}</Typography>
        {sublabel && <Typography noWrap sx={{ fontSize: '0.68rem', color: 'var(--app-subtle-text)' }}>{sublabel}</Typography>}
      </Box>
      {onDelete && hover && (
        <Tooltip title="Удалить">
          <IconButton size="small" aria-label={`Удалить ${label}`} onClick={e => { e.stopPropagation(); onDelete(); }}
            sx={{ p: 0.25, color: '#f87171', '&:hover': { bgcolor: 'rgba(248,113,113,0.12)' } }}>
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--app-subtle-text)' }}>
          {title}
        </Typography>
        {action}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {children}
      </Box>
    </Box>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface SubjectPageProps { onNavigate: (step: AppStep) => void; }

const SubjectPage: React.FC<SubjectPageProps> = ({ onNavigate }) => {
  const {
    project, projects, activeProjectId,
    renameProject, deleteProject, createProject, switchProject,
    removeFileByName, removeDataVersion, removeDashboardSnapshot, removeImageFile, sessionId, adoptBackendSession,
  } = useProject();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [reimportingSessionId, setReimportingSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [modelSettings, setModelSettings] = useState<ModelSettingsResult | null>(null);
  const [cloudruModel, setCloudruModel] = useState('');
  const [visionModel, setVisionModel] = useState('');

  useEffect(() => {
    let alive = true;
    api.listSessions()
      .then(result => { if (alive) setSessions(result.sessions ?? []); })
      .catch(() => { if (alive) setSessions([]); });
    return () => { alive = false; };
  }, [sessionId, project?.files.length, project?.dashboardHistory?.length]);

  useEffect(() => {
    let alive = true;
    api.me()
      .then(current => {
        if (!alive) return;
        setUser(current);
        if (current.role === 'admin') {
          api.getModelSettings().then(settings => {
            if (!alive) return;
            setModelSettings(settings);
            setCloudruModel(settings.cloudru_model);
            setVisionModel(settings.gigachat_vision_model);
          }).catch(() => undefined);
        }
      })
      .catch(() => { if (alive) setUser(null); });
    return () => { alive = false; };
  }, []);

  if (!project) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <FolderSpecialIcon sx={{ fontSize: 56, color: 'var(--app-border)' }} />
        <Typography sx={{ color: 'var(--app-subtle-text)', fontSize: '1rem' }}>Нет активной предметной области</Typography>
        <Button variant="outlined" startIcon={<AddIcon />}
          onClick={() => createProject(`Предметная область ${projects.length + 1}`)}
          sx={{ textTransform: 'none' }}>
          Создать предметную область
        </Button>
      </Box>
    );
  }

  const domain = detectDomain(project.files);
  const dataVersions = project.dataVersions ?? [];
  const dashboardCharts = project.dashboardCharts ?? [];

  const startRename = () => { setNameValue(project.name); setEditingName(true); };
  const commitRename = () => {
    if (nameValue.trim()) renameProject(project.id, nameValue.trim());
    setEditingName(false);
  };

  const reimportSession = async (sourceSessionId: string) => {
    setReimportingSessionId(sourceSessionId);
    try {
      const result = await api.reimportSession(sourceSessionId);
      adoptBackendSession(result.session_id);
      onNavigate('data');
    } finally {
      setReimportingSessionId(null);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await api.deleteSession(id);
    } catch { /* ignore */ }
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const saveModelSettings = async () => {
    const result = await api.updateModelSettings({
      cloudru_model: cloudruModel,
      gigachat_vision_model: visionModel,
    });
    setModelSettings(result);
    setCloudruModel(result.cloudru_model);
    setVisionModel(result.gigachat_vision_model);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* ── Left: project list ────────────────────────────────────────────── */}
      <Box sx={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--app-border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        bgcolor: 'var(--app-surface)',
      }}>
        <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--app-subtle-text)' }}>
            Области ({projects.length})
          </Typography>
          <Tooltip title="Новая предметная область">
            <IconButton size="small" aria-label="Создать новую предметную область"
              onClick={() => { const name = `Предметная область ${projects.length + 1}`; createProject(name); }}
              sx={{ color: 'var(--app-subtle-text)', '&:hover': { color: 'var(--app-accent)' } }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider sx={{ borderColor: 'var(--app-border)' }} />
        <Box sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
          {projects.map(p => {
            const isActive = p.id === activeProjectId;
            return (
              <Box
                key={p.id}
                onClick={() => switchProject(p.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    switchProject(p.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Открыть предметную область ${p.name}`}
                sx={{
                px: 2, py: 0.9, cursor: 'pointer',
                borderLeft: isActive ? '2px solid var(--app-accent)' : '2px solid transparent',
                bgcolor: isActive ? 'rgba(var(--app-accent-rgb),0.07)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb),0.05)' },
                '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: -2 },
                transition: 'all 0.12s',
              }}>
                <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--app-text)' : 'var(--app-subtle-text)' }}>
                  {p.name}
                </Typography>
                <Typography noWrap sx={{ fontSize: '0.65rem', color: 'var(--app-subtle-text)' }}>
                  {p.files.length > 0 ? `${p.files.length} файл${p.files.length > 1 ? 'а' : ''}` : 'пусто'}
                  {p.dashboardBuilt ? ' · Дашборд' : ''}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Right: subject detail ─────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{
            width: 52, height: 52, borderRadius: 2, flexShrink: 0,
            bgcolor: domain ? `${domain.color}18` : 'rgba(var(--app-accent-rgb),0.1)',
            border: `1px solid ${domain ? `${domain.color}40` : 'rgba(var(--app-accent-rgb),0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem',
          }}>
            {domain ? domain.emoji : '📁'}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <TextField size="small" autoFocus variant="standard" value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false); }}
                  sx={{ '& input': { fontSize: '1.3rem', fontWeight: 700, color: 'var(--app-text)' }, '& .MuiInput-underline:before': { borderColor: 'var(--app-border)' } }}
                />
                <IconButton size="small" aria-label="Сохранить название области" onClick={commitRename} sx={{ color: '#3fb950' }}><CheckIcon sx={{ fontSize: 16 }} /></IconButton>
                <IconButton size="small" aria-label="Отменить переименование области" onClick={() => setEditingName(false)} sx={{ color: 'var(--app-subtle-text)' }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--app-text)' }}>{project.name}</Typography>
                <Tooltip title="Переименовать">
                  <IconButton size="small" aria-label={`Переименовать область ${project.name}`} onClick={startRename} sx={{ color: 'var(--app-subtle-text)', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {domain && (
                <Chip label={`${domain.emoji} ${domain.domain}`} size="small"
                  sx={{ fontSize: '0.72rem', bgcolor: `${domain.color}18`, color: domain.color, border: `1px solid ${domain.color}40` }} />
              )}
              <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)' }}>
                Создан {new Date(project.createdAt).toLocaleDateString('ru')}
              </Typography>
            </Box>
          </Box>

          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon sx={{ fontSize: 14 }} />}
            onClick={() => deleteProject(project.id)}
            sx={{ fontSize: '0.72rem', px: 1.25, py: 0.4, flexShrink: 0 }}>
            Удалить область
          </Button>
        </Box>

        <Divider sx={{ borderColor: 'var(--app-border)' }} />

        {/* Domain metrics hints */}
        {domain && (
          <Section title="Ключевые метрики домена">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {domain.metrics.map(m => (
                <Chip key={m} label={m} size="small" icon={<AutoAwesomeIcon sx={{ fontSize: '12px !important' }} />}
                  sx={{ fontSize: '0.72rem', bgcolor: `${domain.color}12`, color: domain.color, border: `1px solid ${domain.color}30` }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'var(--app-subtle-text)', mt: 0.5 }}>
              Попросите ассистента построить дашборд по этим метрикам
            </Typography>
          </Section>
        )}

        {user?.role === 'admin' && modelSettings && (
          <Section title="Admin · настройки моделей">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' }, gap: 1 }}>
              <TextField
                size="small"
                label="Text LLM"
                value={cloudruModel}
                onChange={e => setCloudruModel(e.target.value)}
              />
              <TextField
                size="small"
                label="Vision LLM"
                value={visionModel}
                onChange={e => setVisionModel(e.target.value)}
              />
              <Button variant="outlined" size="small" onClick={saveModelSettings} sx={{ textTransform: 'none' }}>
                Сохранить
              </Button>
            </Box>
          </Section>
        )}

        {/* Files */}
        {sessions.length > 0 && (
          <Section title={`История загрузок (${sessions.length})`}>
            {sessions.slice(0, 8).map(item => (
              <ArtifactCard
                key={item.id}
                icon={<HistoryIcon sx={{ fontSize: 18, color: '#4dd0e1' }} />}
                label={`${item.upload_count} загрузок · ${item.chat_count} сообщений`}
                sublabel={`${new Date(item.updated_at).toLocaleString('ru')} · ${item.id.slice(0, 8)}`}
                onClick={() => reimportSession(item.id)}
                onDelete={() => deleteSession(item.id)}
              />
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button
                size="small"
                startIcon={<ReplayIcon sx={{ fontSize: 14 }} />}
                disabled={!sessionId || reimportingSessionId === sessionId}
                onClick={() => sessionId && reimportSession(sessionId)}
                sx={{ fontSize: '0.72rem', textTransform: 'none', color: 'var(--app-accent)' }}
              >
                {reimportingSessionId ? 'Переимпорт...' : 'Переимпортировать текущий кейс'}
              </Button>
            </Box>
          </Section>
        )}

        {/* Files */}
        <Section
          title={`Файлы (${project.files.length})`}
          action={
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 13 }} />}
              onClick={() => onNavigate('upload')}
              sx={{ fontSize: '0.7rem', px: 1, py: 0.2, color: 'var(--app-accent)', textTransform: 'none', minWidth: 0 }}>
              Добавить
            </Button>
          }
        >
          {project.files.length === 0 ? (
            <Box sx={{ py: 2, textAlign: 'center', border: '1px dashed var(--app-border)', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--app-subtle-text)' }}>Нет загруженных файлов</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => onNavigate('upload')}
                sx={{ mt: 1, fontSize: '0.72rem', textTransform: 'none' }}>
                Загрузить файл
              </Button>
            </Box>
          ) : project.files.map(f => (
            <ArtifactCard
              key={f.name}
              icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 18 }} />}
              label={f.name}
              sublabel={`${f.sheets[0]?.rows.toLocaleString('ru') ?? 0} строк · ${f.sheets[0]?.cols ?? 0} столбцов`}
              onClick={() => onNavigate('data')}
              onDelete={() => removeFileByName(f.name)}
            />
          ))}
        </Section>

        {/* Data versions */}
        {dataVersions.length > 0 && (
          <Section title={`Версии данных (${dataVersions.length})`}>
            {dataVersions.map(v => (
              <ArtifactCard
                key={v.version_id}
                icon={<TableChartIcon sx={{ fontSize: 18, color: '#a78bfa' }} />}
                label={v.name}
                sublabel={`${v.row_count.toLocaleString('ru')} строк · ${v.column_count} столбцов`}
                onClick={() => onNavigate('data')}
                onDelete={removeDataVersion ? () => removeDataVersion(v.version_id) : undefined}
              />
            ))}
          </Section>
        )}

        {/* Dashboard */}
        {(project.dashboardBuilt || dashboardCharts.length > 0) && (
          <Section title={`Дашборд (${(project.dashboardHistory ?? []).length || 1} версий)`}>
            {(project.dashboardHistory ?? []).length > 0
              ? (project.dashboardHistory ?? []).map(snap => (
                <ArtifactCard
                  key={snap.id}
                  icon={<BarChartIcon sx={{ fontSize: 18, color: '#ff6e40' }} />}
                  label={snap.label}
                  sublabel={`${snap.charts.length} чартов · ${new Date(snap.createdAt).toLocaleDateString('ru')}`}
                  onClick={() => onNavigate('dashboard')}
                  onDelete={() => removeDashboardSnapshot(snap.id)}
                />
              ))
              : (
                <ArtifactCard
                  icon={<BarChartIcon sx={{ fontSize: 18, color: '#ff6e40' }} />}
                  label="Дашборд"
                  sublabel={`${dashboardCharts.length} чартов`}
                  onClick={() => onNavigate('dashboard')}
                />
              )
            }
          </Section>
        )}

        {/* ERD */}
        {project.erdGenerated && (
          <Section title="Модель данных">
            <ArtifactCard
              icon={<SchemaIcon sx={{ fontSize: 18, color: '#ab47bc' }} />}
              label={`ERD — ${({ no_model: 'Без модели', star: 'Звезда', snowflake: 'Снежинка', datavault: 'Data Vault' } as Record<string, string>)[project.selectedERDModel] || project.selectedERDModel}`}
              sublabel={`${project.erdRelationships?.length ?? 0} связей`}
              onClick={() => onNavigate('model')}
            />
          </Section>
        )}

        {/* Image mockup */}
        {project.imageFile && (
          <Section title="Макет">
            <ArtifactCard
              icon={<ImageIcon sx={{ fontSize: 18, color: '#60a5fa' }} />}
              label={project.imageFile.name}
              sublabel={`${project.imageFile.width}×${project.imageFile.height}`}
              onClick={() => onNavigate('dashboard')}
              onDelete={() => removeImageFile()}
            />
          </Section>
        )}

        {/* Quick actions */}
        <Divider sx={{ borderColor: 'var(--app-border)' }} />
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<AddIcon />}
            onClick={() => onNavigate('upload')}
            sx={{ fontSize: '0.78rem', textTransform: 'none' }}>
            Загрузить файл
          </Button>
          <Button variant="outlined" size="small" startIcon={<BarChartIcon />}
            onClick={() => onNavigate('dashboard')}
            sx={{ fontSize: '0.78rem', textTransform: 'none' }}>
            Открыть дашборд
          </Button>
          {project.files.length > 0 && (
            <Button variant="outlined" size="small" startIcon={<TableChartIcon />}
              onClick={() => onNavigate('data')}
              sx={{ fontSize: '0.78rem', textTransform: 'none' }}>
              Просмотр данных
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SubjectPage;

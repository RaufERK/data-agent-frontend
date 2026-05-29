import { useState, useCallback } from 'react';
import { Dialog, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// ── Animated illustrations ────────────────────────────────────────────────────

const css = `
@keyframes ob-zone-pulse {
  0%,100% { border-color: rgba(33,161,154,0.45); background: rgba(33,161,154,0.04); }
  50%      { border-color: rgba(33,161,154,1);    background: rgba(33,161,154,0.1); }
}
@keyframes ob-icon-bounce {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-5px); }
}
@keyframes ob-file-fly {
  0%  { left: 60px; top: 30px; opacity: 0; transform: scale(0.7) rotate(-8deg); }
  30% { opacity: 1; transform: scale(1) rotate(0deg); }
  60% { left: 50%; top: 50%; transform: translate(-50%,-50%) scale(1); opacity: 1; }
  80% { left: 50%; top: 50%; transform: translate(-50%,-50%) scale(0.85); opacity: 0.6; }
  100%{ left: 50%; top: 60%; transform: translate(-50%,-50%) scale(0); opacity: 0; }
}
@keyframes ob-progress-fill {
  0%      { width: 0%;   opacity: 0; }
  20%     { opacity: 1; }
  60%,80% { width: 100%; opacity: 1; }
  100%    { width: 100%; opacity: 0; }
}
@keyframes ob-row-in {
  to { opacity: 1; transform: translateX(0); }
}
@keyframes ob-badge-pop {
  to { opacity: 1; transform: scale(1); }
}
@keyframes ob-bubble-right {
  from { opacity: 0; transform: translateX(12px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes ob-bubble-left {
  from { opacity: 0; transform: translateX(-12px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes ob-typing {
  0%,80%,100% { transform: translateY(0); }
  40%         { transform: translateY(-5px); background: #21a19a; }
}
@keyframes ob-cursor-blink {
  0%,100% { opacity: 1; } 50% { opacity: 0; }
}
@keyframes ob-card-pop {
  from { opacity: 0; transform: translateY(10px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes ob-bar-grow {
  to { transform: scaleY(1); }
}
@keyframes ob-donut-fill {
  to { stroke-dashoffset: 28; }
}
@keyframes ob-fade-in {
  to { opacity: 1; }
}
`;

// Step 1 — file upload
function Stage1() {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* drop zone */}
      <Box sx={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 240, height: 140,
        border: '2px dashed #21a19a', borderRadius: '14px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        animation: 'ob-zone-pulse 2s ease-in-out infinite',
      }}>
        <Box sx={{ fontSize: '2rem', animation: 'ob-icon-bounce 2s ease-in-out infinite' }}>📂</Box>
        <Typography sx={{ fontSize: '0.72rem', color: '#21a19a', fontWeight: 500 }}>Перетащите файл сюда</Typography>
      </Box>
      {/* flying file */}
      <Box sx={{
        position: 'absolute', width: 44, height: 54,
        background: '#2d2d30', border: '1px solid #565b62', borderRadius: '6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.55rem', color: '#b2b8bf', fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        animation: 'ob-file-fly 3s ease-in-out infinite',
        '&::before': {
          content: '""', position: 'absolute', top: 0, right: 0,
          width: 12, height: 12, background: '#141416',
          borderBottomLeftRadius: 4, borderLeft: '1px solid #565b62', borderBottom: '1px solid #565b62',
        },
      }}>
        <Box sx={{ mt: '14px' }}>.xlsx</Box>
      </Box>
      {/* progress */}
      <Box sx={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', width: 180 }}>
        <Box sx={{ height: 4, background: '#2a2a2e', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', background: '#21a19a', borderRadius: 2, animation: 'ob-progress-fill 3s ease-in-out infinite' }} />
        </Box>
        <Typography sx={{ fontSize: '0.62rem', color: '#b2b8bf', mt: '5px', textAlign: 'center', animation: 'ob-progress-fill 3s ease-in-out infinite' }}>
          Загрузка данных…
        </Typography>
      </Box>
    </Box>
  );
}

const S2_ROWS = [
  { cells: ['ООО «Альфа»', 'В работе', 'B2B', '2026-01-12'], warn: false },
  { cells: ['АО «Бета»', 'В работе', '—', '2026-01-15'], warn: true, empty: 2 },
  { cells: ['ЗАО «Гамма»', 'Закрыта', 'B2C', '2026-01-18'], warn: false },
  { cells: ['ПАО «Дельта»', 'В работе', '—', 'не дата'], warn: true, empty: 2, warnCol: 3 },
  { cells: ['ООО «Эпсилон»', 'Выиграна', 'B2B', '2026-02-03'], warn: false },
  { cells: ['АО «Зета»', 'В работе', 'SMB', '2026-02-07'], warn: false },
];

// Step 2 — table
function Stage2() {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <Box sx={{ position: 'absolute', left: 24, right: 24, top: 20, background: '#1f1f22', border: '1px solid #2a2a2e', borderRadius: '8px', overflow: 'hidden' }}>
        {/* header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: '#2d2d30', borderBottom: '1px solid #2a2a2e' }}>
          {['Организация', 'Стадия', 'Сегмент', 'Дата'].map(h => (
            <Box key={h} sx={{ px: '10px', py: '6px', fontSize: '0.62rem', fontWeight: 600, color: '#b2b8bf', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</Box>
          ))}
        </Box>
        {/* rows */}
        {S2_ROWS.map((row, ri) => (
          <Box key={ri} sx={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
            borderBottom: '1px solid #1a1a1e',
            background: row.warn ? 'rgba(251,191,36,0.06)' : 'transparent',
            opacity: 0, transform: 'translateX(-8px)',
            animation: `ob-row-in 0.4s ease forwards ${0.1 + ri * 0.25}s`,
          }}>
            {row.cells.map((cell, ci) => (
              <Box key={ci} sx={{
                px: '10px', py: '5px', fontSize: '0.63rem',
                color: ci === (row as { warnCol?: number }).warnCol ? '#fbbf24'
                  : ci === (row as { empty?: number }).empty ? '#4a4a52'
                  : '#d0d7dd',
                fontStyle: ci === (row as { empty?: number }).empty ? 'italic' : 'normal',
              }}>{cell}</Box>
            ))}
          </Box>
        ))}
      </Box>
      <Box sx={{
        position: 'absolute', right: 28, bottom: 18,
        background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
        borderRadius: '20px', px: '12px', py: '4px',
        fontSize: '0.65rem', color: '#fbbf24', fontWeight: 600,
        opacity: 0, transform: 'scale(0.5)',
        animation: 'ob-badge-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards 1.6s',
      }}>
        ⚠ 2 проблемы найдено
      </Box>
    </Box>
  );
}

// Step 3 — chat
function Stage3() {
  return (
    <Box sx={{ position: 'absolute', inset: 16, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'flex-end' }}>
      <Box sx={{ alignSelf: 'flex-end', maxWidth: '75%', background: 'rgba(33,161,154,0.2)', border: '1px solid rgba(33,161,154,0.4)', borderRadius: '12px', px: '12px', py: '8px', fontSize: '0.68rem', color: '#e2f8f7', lineHeight: 1.45, opacity: 0, animation: 'ob-bubble-right 0.4s ease forwards 0.2s' }}>
        Сколько сделок в работе?
      </Box>
      <Box sx={{ display: 'flex', gap: '4px', alignItems: 'center', px: '12px', py: '8px', background: '#2d2d30', border: '1px solid #3a3a3e', borderRadius: '12px', width: 'fit-content', opacity: 0, animation: 'ob-bubble-left 0.3s ease forwards 0.9s' }}>
        {[0, 0.15, 0.3].map((d, i) => (
          <Box key={i} sx={{ width: 5, height: 5, borderRadius: '50%', background: '#565b62', animation: `ob-typing 1s ease-in-out ${d}s infinite` }} />
        ))}
      </Box>
      <Box sx={{ alignSelf: 'flex-start', maxWidth: '75%', background: '#2d2d30', border: '1px solid #3a3a3e', borderRadius: '12px', px: '12px', py: '8px', fontSize: '0.68rem', color: '#d0d7dd', lineHeight: 1.45, opacity: 0, animation: 'ob-bubble-left 0.4s ease forwards 2.0s' }}>
        В статусе «В работе» — <Box component="strong" sx={{ color: '#21a19a' }}>4 сделки</Box> на сумму 12.3 млн ₽.
      </Box>
      <Box sx={{ alignSelf: 'flex-end', maxWidth: '75%', background: 'rgba(33,161,154,0.2)', border: '1px solid rgba(33,161,154,0.4)', borderRadius: '12px', px: '12px', py: '8px', fontSize: '0.68rem', color: '#e2f8f7', lineHeight: 1.45, opacity: 0, animation: 'ob-bubble-right 0.4s ease forwards 2.8s' }}>
        Покажи топ-3 по сумме
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', background: '#2a2a2e', border: '1px solid #3a3a3e', borderRadius: '10px', px: '10px', py: '6px', mt: '4px', opacity: 0, animation: 'ob-fade-in 0.4s ease forwards 0.1s' }}>
        <Box sx={{ flex: 1, fontSize: '0.68rem', color: '#b2b8bf' }}>
          Введите вопрос…{' '}
          <Box component="span" sx={{ display: 'inline-block', width: '1px', height: '12px', background: '#21a19a', verticalAlign: 'middle', animation: 'ob-cursor-blink 0.7s step-end infinite' }} />
        </Box>
        <Box sx={{ width: 24, height: 24, background: '#21a19a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>↑</Box>
      </Box>
    </Box>
  );
}

const BAR_HEIGHTS = ['45%', '72%', '55%', '88%', '63%', '40%'];

// Step 4 — dashboard
function Stage4() {
  return (
    <Box sx={{ position: 'absolute', inset: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '56px 1fr', gap: 1 }}>
      {/* KPI cards */}
      {[
        { label: 'Сделок всего', val: '148', color: '#21a19a' },
        { label: 'Выиграно', val: '37', color: '#3fb950' },
        { label: 'Сумма, млн ₽', val: '84.2', color: '#21a19a' },
      ].map((kpi, i) => (
        <Box key={i} sx={{ background: '#2d2d30', border: '1px solid #2a2a2e', borderRadius: '8px', px: '12px', py: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: 0, animation: `ob-card-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards ${0.1 + i * 0.15}s` }}>
          <Typography sx={{ fontSize: '0.55rem', color: '#b2b8bf', mb: '3px' }}>{kpi.label}</Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: kpi.color }}>{kpi.val}</Typography>
        </Box>
      ))}
      {/* bar chart */}
      <Box sx={{ gridColumn: '1 / 3', background: '#2d2d30', border: '1px solid #2a2a2e', borderRadius: '8px', px: '12px', py: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '4px', opacity: 0, animation: 'ob-card-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards 0.55s' }}>
        <Typography sx={{ fontSize: '0.55rem', color: '#b2b8bf', mb: '4px' }}>Сделки по месяцам</Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: 70 }}>
          {BAR_HEIGHTS.map((h, i) => (
            <Box key={i} sx={{ flex: 1, height: h, background: 'linear-gradient(180deg,#21a19a,#107f8c)', borderRadius: '3px 3px 0 0', transformOrigin: 'bottom', transform: 'scaleY(0)', animation: `ob-bar-grow 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards ${0.7 + i * 0.12}s` }} />
          ))}
        </Box>
      </Box>
      {/* donut */}
      <Box sx={{ background: '#2d2d30', border: '1px solid #2a2a2e', borderRadius: '8px', px: '12px', py: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: 0, animation: 'ob-card-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards 0.65s' }}>
        <Typography sx={{ fontSize: '0.55rem', color: '#b2b8bf', alignSelf: 'flex-start' }}>Конверсия</Typography>
        <svg width="60" height="60" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a1a1e" strokeWidth="3.8" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#21a19a" strokeWidth="3.8" strokeLinecap="round"
            strokeDasharray="100 100" strokeDashoffset="100"
            style={{ animation: 'ob-donut-fill 1.2s ease forwards 1.0s', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
        </svg>
        <Typography sx={{ fontSize: '0.65rem', color: '#21a19a', fontWeight: 700 }}>25%</Typography>
      </Box>
    </Box>
  );
}

const STEPS = [
  {
    stage: Stage1,
    label: 'Шаг 1 из 4',
    title: 'Загрузите ваши данные',
    desc: 'Перетащите Excel или CSV-файл в зону загрузки — или нажмите, чтобы выбрать. Поддерживаются несколько листов и файлов одновременно.',
  },
  {
    stage: Stage2,
    label: 'Шаг 2 из 4',
    title: 'Проверьте качество данных',
    desc: 'Агент автоматически найдёт пустые значения, дубликаты и ошибки. Нажмите на проблему слева — таблица перелетит к нужным строкам.',
  },
  {
    stage: Stage3,
    label: 'Шаг 3 из 4',
    title: 'Задайте вопрос на русском',
    desc: 'Спросите что угодно — агент переведёт вопрос в SQL, выполнит запрос и вернёт ответ с данными. Без знания SQL.',
  },
  {
    stage: Stage4,
    label: 'Шаг 4 из 4',
    title: 'Получите дашборд',
    desc: 'На основе ваших данных агент автоматически построит графики и KPI-карточки. Экспортируйте в PDF одним кликом.',
  },
];

// ── Main component ────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  // key forces remount of stage (restarts animations)
  const [stageKey, setStageKey] = useState(0);

  const goTo = useCallback((n: number) => {
    setStep(n);
    setStageKey(k => k + 1);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) goTo(step + 1);
    else onClose();
  }, [step, goTo, onClose]);

  const prev = useCallback(() => {
    if (step > 0) goTo(step - 1);
  }, [step, goTo]);

  const current = STEPS[step];
  const StageComponent = current.stage;

  return (
    <>
      <style>{css}</style>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: 540,
            bgcolor: '#1f1f22',
            border: '1px solid #565b62',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            backgroundImage: 'none',
          },
        }}
      >
        {/* ── Stage (illustration) ── */}
        <Box sx={{ width: '100%', height: 260, background: '#141416', position: 'relative', overflow: 'hidden', borderBottom: '1px solid #2a2a2e' }}>
          <Box key={stageKey} sx={{ width: '100%', height: '100%', position: 'relative' }}>
            <StageComponent />
          </Box>
        </Box>

        {/* ── Body ── */}
        <Box sx={{ px: '32px', pt: '28px', pb: '24px' }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#21a19a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1 }}>
            {current.label}
          </Typography>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#f2f4f7', mb: 1 }}>
            {current.title}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: '#b2b8bf', lineHeight: 1.55, mb: 3 }}>
            {current.desc}
          </Typography>

          {/* ── Footer ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* dots */}
            <Box sx={{ display: 'flex', gap: '6px' }}>
              {STEPS.map((_, i) => (
                <Box
                  key={i}
                  component="button"
                  type="button"
                  aria-label={`Перейти к шагу ${i + 1}`}
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => goTo(i)}
                  sx={{
                  width: 10, height: 10, borderRadius: '50%', cursor: 'pointer',
                  border: 0, p: 0,
                  background: i === step ? '#21a19a' : '#3a3a3e',
                  transition: 'background 0.3s',
                  '&:focus-visible': { outline: '2px solid #21a19a', outlineOffset: 2 },
                }} />
              ))}
            </Box>
            {/* buttons */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box component="button" onClick={step === 0 ? onClose : prev} sx={{
                border: '1px solid #3a3a3e', background: 'transparent', color: '#b2b8bf',
                borderRadius: '8px', px: '20px', py: '8px', fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer', '&:hover': { opacity: 0.8 },
              }}>
                {step === 0 ? 'Пропустить' : '← Назад'}
              </Box>
              <Box component="button" onClick={next} sx={{
                border: 'none', background: '#21a19a', color: '#fff',
                borderRadius: '8px', px: step === STEPS.length - 1 ? '28px' : '20px', py: '8px',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', '&:hover': { opacity: 0.85 },
              }}>
                {step === STEPS.length - 1 ? 'Начать работу ✓' : 'Далее →'}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* close X */}
        <IconButton aria-label="Закрыть обучение" onClick={onClose} size="small" sx={{ position: 'absolute', top: 10, right: 10, color: '#565b62', '&:hover': { color: '#b2b8bf' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Dialog>
    </>
  );
}

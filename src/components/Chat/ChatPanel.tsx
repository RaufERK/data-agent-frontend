import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, TextField, IconButton, Button, Paper, Collapse } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useProject } from '../../store/ProjectContext';
import type { ChatMessage } from '../../types';

const SqlBlock: React.FC<{ sql: string; rowCount?: number }> = ({ sql, rowCount }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box sx={{ mt: 0.75 }}>
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.6,
          cursor: 'pointer', userSelect: 'none',
          color: 'rgba(255,255,255,0.45)',
          fontSize: '0.75rem',
          px: 0.8, py: 0.35,
          borderRadius: 1,
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          '&:hover': { color: 'rgba(255,255,255,0.7)', bgcolor: 'rgba(255,255,255,0.07)' },
          transition: 'all 0.15s',
        }}
      >
        <CodeIcon sx={{ fontSize: 13 }} />
        SQL
        {rowCount !== undefined && (
          <Box component="span" sx={{ ml: 0.3, color: 'rgba(255,255,255,0.3)' }}>
            · {rowCount} строк
          </Box>
        )}
        <Box component="span" sx={{ ml: 0.5, fontSize: '0.65rem', opacity: 0.6 }}>
          {open ? '▲' : '▼'}
        </Box>
      </Box>

      <Collapse in={open}>
        <Box sx={{
          mt: 0.6,
          position: 'relative',
          borderRadius: 1.5,
          bgcolor: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.25,
              pr: 5,
              fontSize: '0.76rem',
              fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
              color: '#b5d0ff',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.55,
            }}
          >
            {sql}
          </Box>
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label={copied ? 'SQL скопирован' : 'Скопировать SQL'}
            title={copied ? 'Скопировано' : 'Скопировать SQL'}
            sx={{
              position: 'absolute', top: 6, right: 6,
              color: copied ? '#4cc38a' : 'rgba(255,255,255,0.35)',
              bgcolor: 'rgba(255,255,255,0.05)',
              width: 26, height: 26,
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      </Collapse>
    </Box>
  );
};

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
    {msg.role === 'user' && (
      <Typography sx={{ mb: 0.45, px: 0.25, color: 'rgba(255,255,255,0.42)', fontSize: '0.7rem', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        Вы
      </Typography>
    )}
    <Box sx={{
      maxWidth: '92%',
      px: 1.6,
      py: 1.35,
      borderRadius: msg.role === 'user' ? '18px 18px 8px 18px' : '18px 18px 18px 8px',
      bgcolor: msg.role === 'user' ? 'rgba(var(--app-accent-rgb), 0.14)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${
        msg.messageType === 'anomaly' ? 'rgba(239,68,68,0.45)' :
        msg.messageType === 'insight' ? 'rgba(245,200,76,0.45)' :
        msg.messageType === 'action_result' ? 'rgba(76,195,138,0.45)' :
        msg.role === 'user' ? 'rgba(var(--app-accent-rgb), 0.24)' : 'rgba(255,255,255,0.08)'
      }`,
      borderLeft: msg.role === 'assistant' && msg.messageType ? `3px solid ${
        msg.messageType === 'anomaly' ? '#ef4444' :
        msg.messageType === 'insight' ? '#f5c84c' : '#4cc38a'
      }` : undefined,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
    }}>
      <Typography sx={{ color: '#e8ebef', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
        {msg.text}
      </Typography>
      {msg.role === 'assistant' && msg.sql && (
        <SqlBlock sql={msg.sql} rowCount={msg.rowCount} />
      )}
    </Box>
  </Box>
);

const ChatPanel: React.FC = () => {
  const {
    chatMessages, chatInput, setChatInput, sendChatMessage,
    chatSide, setChatSide, chatCollapsed, setChatCollapsed,
  } = useProject();

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  const latestOptionSource = [...chatMessages].reverse().find(msg => msg.role === 'assistant' && msg.options && msg.options.length > 0);
  const latestOptions = latestOptionSource?.options || [];

  if (chatCollapsed) {
    return (
      <Box
        role="button"
        tabIndex={0}
        aria-label="Развернуть ИИ-ассистента"
        onClick={() => setChatCollapsed(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setChatCollapsed(false);
          }
        }}
        sx={{
          position: 'fixed',
          [chatSide === 'right' ? 'right' : 'left']: 0,
          top: '50%', transform: 'translateY(-50%)',
          width: 40, height: 96, borderRadius: chatSide === 'right' ? '16px 0 0 16px' : '0 16px 16px 0',
          bgcolor: 'rgba(var(--app-accent-rgb), 0.12)', border: '1px solid rgba(var(--app-accent-rgb), 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 1200,
          '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb), 0.2)' },
          '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 },
        }}
      >
        <SmartToyIcon sx={{ fontSize: 20, color: 'var(--app-accent)' }} />
      </Box>
    );
  }

  return (
    <Paper sx={{
      width: '100%',
      height: '100%',
      position: 'relative',
      bgcolor: 'transparent',
      border: 'none',
      boxShadow: 'none',
      display: 'flex', flexDirection: 'column', zIndex: 1100,
      p: 1.5,
    }}>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(84,53,183,0.96) 0%, rgba(56,53,79,0.94) 15%, rgba(33,33,37,0.98) 34%, rgba(28,28,31,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 28px 56px rgba(0, 0, 0, 0.38)',
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2.25, pt: 1.75, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{
              width: 34, height: 34, borderRadius: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(var(--app-accent-rgb), 0.16)',
              border: '1px solid rgba(var(--app-accent-rgb), 0.24)',
            }}>
              <SmartToyIcon sx={{ color: 'var(--app-accent)', fontSize: 18 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: '#f7f8fa', fontSize: '1rem', lineHeight: 1.15 }}>
                ИИ-ассистент
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label={chatSide === 'right' ? 'Переместить ассистента влево' : 'Переместить ассистента вправо'}
              onClick={() => setChatSide(chatSide === 'right' ? 'left' : 'right')}
              sx={{
                color: 'rgba(255,255,255,0.72)',
                bgcolor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <SwapHorizIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Свернуть ассистента"
              onClick={() => setChatCollapsed(true)}
              sx={{
                color: 'rgba(255,255,255,0.72)',
                bgcolor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {chatSide === 'right' ? <ChevronRightIcon sx={{ fontSize: 18 }} /> : <ChevronLeftIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
        </Box>

        {/* Messages */}
        <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, py: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {chatMessages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </Box>

        {latestOptions.length > 0 && (
          <Box sx={{ px: 2, pb: 1.25, display: 'flex', flexWrap: 'wrap', gap: 0.9 }}>
            {latestOptions.map(opt => (
              <Button
                key={opt.num}
                onClick={opt.action}
                size="small"
                variant="text"
                sx={{
                  textTransform: 'none',
                  fontSize: '0.82rem',
                  color: '#eef1f4',
                  px: 1.3,
                  py: 0.7,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  '&:hover': { bgcolor: 'rgba(var(--app-accent-rgb), 0.12)', borderColor: 'rgba(var(--app-accent-rgb), 0.24)' },
                }}
              >
                {opt.label}
              </Button>
            ))}
          </Box>
        )}

        {/* Input */}
        <Box sx={{ p: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(33,33,37,0.62) 0%, rgba(24,24,25,0.98) 100%)' }}>
          <Box sx={{
            p: 1.1,
            borderRadius: 2.5,
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <TextField
              fullWidth
              multiline
              maxRows={5}
              variant="standard"
              placeholder="Спросите: покажи дубликаты, открой конфликты дат, где нет СЭБ, построй ERD"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              InputProps={{ disableUnderline: true }}
              sx={{
                '& textarea': {
                  color: '#f3f5f7',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  px: 0.6,
                  pb: 1,
                },
                '& textarea::placeholder': {
                  color: 'rgba(255,255,255,0.42)',
                  opacity: 1,
                },
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.4 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.74rem', px: 0.6 }}>
                Отвечу по текущему шагу и предложу следующий.
              </Typography>
              <IconButton
                aria-label="Отправить сообщение ассистенту"
                onClick={sendChatMessage}
                sx={{
                  width: 40,
                  height: 40,
                  color: '#f8fbfc',
                  bgcolor: 'rgba(var(--app-accent-rgb), 0.92)',
                  borderRadius: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(var(--app-accent-rgb), 1)',
                  },
                }}
              >
                <SendIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          <Typography sx={{ mt: 1.1, textAlign: 'center', color: 'rgba(255,255,255,0.34)', fontSize: '0.72rem' }}>
            Ассистент использует контекст проекта и текущего раздела.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default ChatPanel;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, Paper, Card, CardContent, Chip,
  LinearProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Collapse, Fade, Tabs, Tab, Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import TableChartIcon from '@mui/icons-material/TableChart';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import { useProject } from '../store/ProjectContext';
import { api } from '../api';
import { MOCK_DIFFS } from '../data/mockData';
import DataWorkspace from '../components/Data/DataWorkspace';
import { DataDiffPreview } from './data/DataDiffPreview';
import {
  CLEANUP_INSIGHT_IDS,
  PREVIEW_OVERSCAN,
  PREVIEW_ROW_HEIGHT,
  PREVIEW_VIEWPORT_HEIGHT,
  cellKey,
  collectIssueTargetCells,
  diffConfirmKey,
  downloadBlob,
  findDiffsForIssue,
  findIssueForDiff,
  getColumnIndex,
  isBlankPreviewValue,
  isIssueResolved,
  issueConfirmKey,
  matrixFromQueryResult,
} from './data/dataPageHelpers';
import { buildDataStory, DEFAULT_DATA_FILTERS } from '../utils/dataStory';
import type { CleaningDiff, DataFilterState, DataStoryInsight, DataStoryRequestRow, DataVersion, QualityIssue, UploadedFile } from '../types';

class DataPageErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('DataPage runtime error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error" sx={{ mb: 3 }}>
          Не удалось отрисовать workspace после загрузки датасета. Обновите страницу или попробуйте открыть шаг заново.
        </Alert>
      );
    }

    return this.props.children;
  }
}

const DataPage: React.FC = () => {
  const {
    project, updateFileSheet,
    cleaningProgress,
    fixIssue, confirmedDiffs, confirmDiff,
    goToPetalStep,
    setPetalStatus,
    runAssistantAction,
    dataActionRef,
    sessionId,
  } = useProject();

  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [previewSheet, setPreviewSheet] = useState(0);
  const [previewTab, setPreviewTab] = useState(0); // 0=данные, 1=изменения
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<string[][] | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<number, boolean>>({});
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [selectedDiffId, setSelectedDiffId] = useState<number | null>(null);
  const [previewScrollTop, setPreviewScrollTop] = useState(0);
  const [workspaceFilters, setWorkspaceFilters] = useState<DataFilterState>(DEFAULT_DATA_FILTERS);
  const [workspaceMode, setWorkspaceMode] = useState<'analysis' | 'cleanup'>('cleanup');
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'running' | 'ready'>('idle');
  const [selectedWorkspaceInsightId, setSelectedWorkspaceInsightId] = useState<string | null>(null);
  const [, setSelectedPresetId] = useState<string | null>(null);
  const [workspaceTableScrollTop, setWorkspaceTableScrollTop] = useState(0);
  const [selectedDealPreviewId, setSelectedDealPreviewId] = useState<string | null>(null);
  const previewTableRef = useRef<HTMLDivElement | null>(null);
  const analysisTimerRef = useRef<number | null>(null);

  const files = project?.files || [];
  const dataVersions = project?.dataVersions ?? [];
  const issues = project?.issues || [];
  const status = project?.status || 'empty';
  const analyzed = status !== 'empty' && status !== 'files_uploaded' && status !== 'analyzing';
  const isCleaning = status === 'cleaning';

  const fixedCount = issues.filter(issue => isIssueResolved(issue, confirmedDiffs)).length;
  const confirmedCount = MOCK_DIFFS.filter(diff => confirmedDiffs[diffConfirmKey(diff)]).length;
  const canProceed = files.length > 0 || !!project?.imageFile;
  const dataStory = useMemo(() => {
    if (files.length === 0) return null;
    try {
      return buildDataStory(files);
    } catch (error) {
      console.error('Failed to build data story from uploaded files', error);
      return null;
    }
  }, [files]);

  const clearPreviewSelection = () => {
    setSelectedIssueId(null);
    setSelectedDiffId(null);
    setSelectedDealPreviewId(null);
  };

  const resetPreviewScroll = () => {
    setPreviewScrollTop(0);
    if (previewTableRef.current) {
      previewTableRef.current.scrollTop = 0;
    }
  };

  const openFilePreview = (file: UploadedFile, sheetIndex = 0, startEdit = false) => {
    const idx = Math.max(0, Math.min(sheetIndex, file.sheets.length - 1));
    clearPreviewSelection();
    setPreviewFile(file);
    setPreviewSheet(idx);
    setPreviewTab(0);
    setEditMode(startEdit);
    setEditData(startEdit ? file.sheets[idx]?.preview.map(row => [...row]) ?? null : null);
    resetPreviewScroll();
  };

  const openFilePreviewForReview = (
    file: UploadedFile,
    sheetIndex: number,
    issueId: number | null,
    diffId: number | null,
  ) => {
    const idx = Math.max(0, Math.min(sheetIndex, file.sheets.length - 1));
    setPreviewFile(file);
    setPreviewSheet(idx);
    setPreviewTab(0);
    setEditMode(true);
    setEditData(file.sheets[idx]?.preview.map(row => [...row]) ?? null);
    setSelectedIssueId(issueId);
    setSelectedDiffId(diffId);
    resetPreviewScroll();
  };

  const handleClosePreview = () => {
    setPreviewFile(null);
    setEditMode(false);
    setEditData(null);
    clearPreviewSelection();
    resetPreviewScroll();
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditData(null);
  };

  const handleCellEdit = (rowIdx: number, colIdx: number, value: string) => {
    if (!editData) return;
    setEditData(editData.map((row, ri) => (
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : [...row]
    )));
  };

  const handleAutoConfirm = (issue: QualityIssue) => {
    const matchingDiff = findDiffsForIssue(issue)[0];
    fixIssue(issue.id);
    if (matchingDiff) {
      confirmDiff(diffConfirmKey(matchingDiff));
      return;
    }
    confirmDiff(issueConfirmKey(issue));
  };

  const handleConfirmDiff = (diff: CleaningDiff) => {
    const matchedIssue = findIssueForDiff(diff, issues);
    if (matchedIssue) {
      fixIssue(matchedIssue.id);
      confirmDiff(issueConfirmKey(matchedIssue));
    }
    confirmDiff(diffConfirmKey(diff));
  };

  const handleSaveEdit = () => {
    const selectedIssue = selectedIssueId !== null ? issues.find(issue => issue.id === selectedIssueId) ?? null : null;
    const selectedDiff = selectedDiffId !== null ? MOCK_DIFFS.find(diff => diff.id === selectedDiffId) ?? null : null;

    if (selectedIssue) {
      fixIssue(selectedIssue.id);
      confirmDiff(issueConfirmKey(selectedIssue));
    }
    if (selectedDiff) {
      confirmDiff(diffConfirmKey(selectedDiff));
    }

    // Persist edited data back to the project file
    if (editData && previewFile) {
      updateFileSheet(previewFile.name, previewSheet, editData);
    }

    setEditMode(false);
    setEditData(null);
    clearPreviewSelection();
    setPetalStatus('data', 'green');
  };

  const applyWorkspacePatch = (patch: Partial<DataFilterState>) => {
    setWorkspaceFilters(prev => ({ ...prev, ...patch }));
    setWorkspaceTableScrollTop(0);
  };

  const resetWorkspace = () => {
    if (analysisTimerRef.current !== null) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    setWorkspaceFilters(DEFAULT_DATA_FILTERS);
    setWorkspaceMode('cleanup');
    setAnalysisStatus('idle');
    setSelectedWorkspaceInsightId(null);
    setSelectedPresetId('all_requests');
    setWorkspaceTableScrollTop(0);
  };

  const handleSelectWorkspaceInsight = (insight: DataStoryInsight) => {
    setWorkspaceMode(CLEANUP_INSIGHT_IDS.has(insight.id) ? 'cleanup' : 'analysis');
    if (insight.id !== 'quality_cleanup') {
      setAnalysisStatus('ready');
    }
    setSelectedWorkspaceInsightId(insight.id);
    setSelectedPresetId(insight.id);
    applyWorkspacePatch({ ...DEFAULT_DATA_FILTERS, ...insight.filters });
  };

  const openDealRowPreview = (row: DataStoryRequestRow) => {
    const requestsFile = files.find(file => file.name === 'crm_requests_export.xlsx');
    if (!requestsFile) return;

    openFilePreview(requestsFile, 0);
    setSelectedDealPreviewId(row.requestId);

    const targetRowIndex = requestsFile.sheets[0]?.preview.findIndex(sheetRow => sheetRow[0] === row.requestId) ?? -1;
    if (targetRowIndex > 0) {
      const scrollTop = Math.max((targetRowIndex - 2) * PREVIEW_ROW_HEIGHT, 0);
      setTimeout(() => {
        setPreviewScrollTop(scrollTop);
        if (previewTableRef.current) {
          previewTableRef.current.scrollTop = scrollTop;
        }
      }, 80);
    }
  };

  const handleWorkspaceScenarioAction = (action: string) => {
    switch (action) {
      case 'duplicate_requests':
        if (dataStory) {
          const insight = dataStory.insights.find(item => item.id === 'duplicate_requests');
          if (insight) handleSelectWorkspaceInsight(insight);
        }
        break;
      case 'date_conflicts':
        if (dataStory) {
          const insight = dataStory.insights.find(item => item.id === 'date_conflicts');
          if (insight) handleSelectWorkspaceInsight(insight);
        }
        break;
      case 'approval_gaps':
        if (dataStory) {
          const insight = dataStory.insights.find(item => item.id === 'approval_gaps');
          if (insight) handleSelectWorkspaceInsight(insight);
        }
        break;
      case 'quality_cleanup':
        if (dataStory) {
          const insight = dataStory.insights.find(item => item.id === 'quality_cleanup');
          if (insight) handleSelectWorkspaceInsight(insight);
        }
        break;
      case 'clean':
        runAssistantAction('clean');
        break;
      default:
        break;
    }
  };

  const handleManualReviewForIssue = (issue: QualityIssue) => {
    const file = files.find(item => item.name === issue.file);
    if (!file) return;
    const sheetIdx = Math.max(0, file.sheets.findIndex(sheet => sheet.name === issue.sheet));
    const matchingDiff = findDiffsForIssue(issue)[0];
    openFilePreviewForReview(file, sheetIdx, issue.id, matchingDiff?.id ?? null);
  };

  const handleManualReviewForDiff = (diff: CleaningDiff) => {
    const file = files.find(item => item.name === diff.file);
    if (!file) return;
    const sheetIdx = Math.max(0, file.sheets.findIndex(sheet => sheet.name === diff.sheet));
    const issue = findIssueForDiff(diff, issues);
    openFilePreviewForReview(file, sheetIdx, issue?.id ?? null, diff.id);
  };

  const openDataVersionPreview = async (version: DataVersion) => {
    if (!sessionId) return;
    try {
      const preview = await api.getDataVersionPreview(sessionId, version.version_id, 1000);
      const matrix = matrixFromQueryResult(preview.columns, preview.data);
      setPreviewFile({
        name: `${version.name}.csv`,
        size: `${version.row_count.toLocaleString()} строк`,
        sheets: [{
          name: version.version_id,
          rows: version.row_count,
          cols: version.column_count,
          preview: matrix,
        }],
        status: 'done',
      });
      setPreviewSheet(0);
      setPreviewTab(0);
      setEditMode(false);
      setEditData(null);
      clearPreviewSelection();
      resetPreviewScroll();
    } catch (error) {
      console.warn('Failed to open data version preview', error);
    }
  };

  const downloadDataVersion = async (version: DataVersion) => {
    if (!sessionId) return;
    const { blob, filename } = await api.downloadDataVersionCsv(sessionId, version.version_id);
    downloadBlob(blob, filename ?? `data_agent_${version.version_id}.csv`);
  };

  const toggleDiffExpand = (diffId: number) => {
    setExpandedDiffs(prev => ({ ...prev, [diffId]: !prev[diffId] }));
  };

  useEffect(() => {
    if (!dataStory) {
      setWorkspaceFilters(DEFAULT_DATA_FILTERS);
      setWorkspaceMode('cleanup');
      setAnalysisStatus('idle');
      setSelectedWorkspaceInsightId(null);
      setSelectedPresetId(null);
      setWorkspaceTableScrollTop(0);
      return;
    }

    setWorkspaceFilters(DEFAULT_DATA_FILTERS);
    setWorkspaceMode('cleanup');
    setAnalysisStatus('idle');
    setSelectedWorkspaceInsightId(null);
    setSelectedPresetId('all_requests');
    setWorkspaceTableScrollTop(0);
  }, [project?.id, dataStory]);

  useEffect(() => () => {
    if (analysisTimerRef.current !== null) {
      window.clearTimeout(analysisTimerRef.current);
    }
  }, []);

  useEffect(() => {
    dataActionRef.current = (action: string) => {
      if (!dataStory) return;

      if (action === 'focus:preview:deals') {
        const requestsFile = files.find(file => file.name === 'crm_requests_export.xlsx');
        if (requestsFile) openFilePreview(requestsFile, 0);
        return;
      }

      if (action === 'filter:reset') {
        resetWorkspace();
        return;
      }

      if (action === 'view:analysis') {
        setWorkspaceMode('analysis');
        setAnalysisStatus('running');
        setSelectedWorkspaceInsightId(null);
        applyWorkspacePatch({ dirtyOnly: false });
        if (analysisTimerRef.current !== null) {
          window.clearTimeout(analysisTimerRef.current);
        }
        analysisTimerRef.current = window.setTimeout(() => {
          setAnalysisStatus('ready');
          analysisTimerRef.current = null;
        }, 5000);
        return;
      }

      if (action === 'view:cleanup') {
        if (analysisTimerRef.current !== null) {
          window.clearTimeout(analysisTimerRef.current);
          analysisTimerRef.current = null;
        }
        setWorkspaceMode('cleanup');
        setAnalysisStatus('idle');
        applyWorkspacePatch({ dirtyOnly: true });
        return;
      }

      if (action === 'filter:dirty-only') {
        setWorkspaceMode('cleanup');
        setSelectedPresetId('quality_cleanup');
        setSelectedWorkspaceInsightId('quality_cleanup');
        applyWorkspacePatch({ ...DEFAULT_DATA_FILTERS, dirtyOnly: true });
        return;
      }

      if (action.startsWith('focus:insight:')) {
        const insightId = action.replace('focus:insight:', '');
        const insight = dataStory.insights.find(item => item.id === insightId);
        if (insight) {
          handleSelectWorkspaceInsight(insight);
        }
        return;
      }

      const filterActions: Array<[string, keyof DataFilterState]> = [
        ['filter:period:', 'period'],
        ['filter:department:', 'department'],
        ['filter:organization:', 'organization'],
        ['filter:access-type:', 'accessType'],
        ['filter:stage:', 'stage'],
        ['filter:source:', 'source'],
        ['filter:search:', 'search'],
      ];

      filterActions.forEach(([prefix, key]) => {
        if (action.startsWith(prefix)) {
          const value = action.slice(prefix.length);
          setSelectedPresetId(null);
          applyWorkspacePatch({ [key]: value } as Partial<DataFilterState>);
        }
      });
    };

    return () => {
      dataActionRef.current = null;
    };
  }, [dataActionRef, dataStory, files]);

  const currentPreview = previewFile
    ? (files.find(f => f.name === previewFile.name) ?? previewFile).sheets[previewSheet]?.preview
    : undefined;
  const currentSheetMeta = previewFile
    ? (files.find(f => f.name === previewFile.name) ?? previewFile).sheets[previewSheet]
    : undefined;
  const displayData = editMode && editData ? editData : currentPreview;
  const currentSheetName = previewFile?.sheets[previewSheet]?.name;
  const previewHeaders = displayData?.[0] ?? [];
  const previewRows = displayData?.slice(1) ?? [];
  const visibleRowCapacity = Math.ceil(PREVIEW_VIEWPORT_HEIGHT / PREVIEW_ROW_HEIGHT) + PREVIEW_OVERSCAN * 2;
  const visibleStartIndex = Math.max(0, Math.floor(previewScrollTop / PREVIEW_ROW_HEIGHT) - PREVIEW_OVERSCAN);
  const visibleEndIndex = Math.min(previewRows.length, visibleStartIndex + visibleRowCapacity);
  const visibleRows = previewRows.slice(visibleStartIndex, visibleEndIndex);
  const topSpacerHeight = visibleStartIndex * PREVIEW_ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (previewRows.length - visibleEndIndex) * PREVIEW_ROW_HEIGHT);
  const selectedWorkspaceInsight = dataStory?.insights.find(insight => insight.id === selectedWorkspaceInsightId) ?? null;
  const highlightedWorkspaceDeals = useMemo(() => new Set(selectedWorkspaceInsight?.highlightedRowIds ?? []), [selectedWorkspaceInsight]);
  const filteredWorkspaceDeals = useMemo(() => {
    if (!dataStory) return [];

    const search = workspaceFilters.search.trim().toLowerCase();

    return dataStory.rows.filter(row => {
      if (workspaceFilters.period !== 'all' && row.periodKey !== workspaceFilters.period) return false;
      if (workspaceFilters.department !== 'all' && row.department !== workspaceFilters.department) return false;
      if (workspaceFilters.organization !== 'all' && row.organization !== workspaceFilters.organization) return false;
      if (workspaceFilters.accessType !== 'all' && row.accessType !== workspaceFilters.accessType) return false;
      if (workspaceFilters.stage !== 'all' && row.stage !== workspaceFilters.stage) return false;
      if (workspaceFilters.source !== 'all' && row.source !== workspaceFilters.source) return false;
      if (workspaceFilters.dirtyOnly && !(row.hasDirtyDepartment || row.hasMissingOrganization || row.hasDateConflict || row.hasDuplicate || row.hasApprovalMismatch)) return false;
      if (search) {
        const haystack = [
          row.requestId,
          row.title,
          row.createdAt,
          row.issuedAt,
          row.expiresAt,
          row.department,
          row.departmentRaw,
          row.owner,
          row.accessType,
          row.organization,
          row.stage,
          row.source,
          row.comment,
        ].join(' ').toLowerCase();

        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [dataStory, workspaceFilters]);
  const previewIssues = previewFile && currentSheetName
    ? issues.filter(issue => issue.file === previewFile.name && issue.sheet === currentSheetName)
    : [];
  const previewErrorCols = new Set(previewIssues.filter(issue => issue.severity === 'error' && !isIssueResolved(issue, confirmedDiffs)).map(issue => issue.column));
  const previewWarnCols = new Set(previewIssues.filter(issue => issue.severity === 'warning' && !isIssueResolved(issue, confirmedDiffs)).map(issue => issue.column));
  const previewInfoCols = new Set(previewIssues.filter(issue => issue.severity === 'info' && !isIssueResolved(issue, confirmedDiffs)).map(issue => issue.column));
  const fileDiffs = previewFile ? MOCK_DIFFS.filter(diff => diff.file === previewFile.name) : [];
  const currentSheetDiffs = currentSheetName
    ? fileDiffs.filter(diff => diff.sheet === currentSheetName)
    : [];

  const selectedIssue = selectedIssueId !== null ? issues.find(issue => issue.id === selectedIssueId) ?? null : null;
  const selectedDiff = selectedDiffId !== null ? MOCK_DIFFS.find(diff => diff.id === selectedDiffId) ?? null : null;
  const reviewIssue = selectedIssue ?? (selectedDiff ? findIssueForDiff(selectedDiff, issues) : null);

  const reviewTargetCells = (
    displayData &&
    previewFile &&
    currentSheetName &&
    ((reviewIssue && reviewIssue.file === previewFile.name && reviewIssue.sheet === currentSheetName) ||
      (selectedDiff && selectedDiff.file === previewFile.name && selectedDiff.sheet === currentSheetName))
  )
    ? (() => {
      const markers = new Map<string, { row: number; col: number }>();

      if (reviewIssue) {
        collectIssueTargetCells(reviewIssue, displayData).forEach(marker => {
          markers.set(cellKey(marker.row, marker.col), marker);
        });
      }

      if (selectedDiff) {
        const colIndex = getColumnIndex(displayData, selectedDiff.column);
        if (colIndex >= 0) {
          markers.set(cellKey(selectedDiff.row, colIndex), { row: selectedDiff.row, col: colIndex });
        }
      }

      return Array.from(markers.values());
    })()
    : [];

  const reviewTargetCellKeys = new Set(reviewTargetCells.map(marker => cellKey(marker.row, marker.col)));
  const reviewTargetRows = new Set(reviewTargetCells.map(marker => marker.row));
  const reviewTargetColumns = new Set<number>();
  if (displayData && reviewIssue && previewFile?.name === reviewIssue.file && currentSheetName === reviewIssue.sheet) {
    const issueColumnIndex = getColumnIndex(displayData, reviewIssue.column);
    if (issueColumnIndex >= 0) reviewTargetColumns.add(issueColumnIndex);
  }
  if (displayData && selectedDiff && previewFile?.name === selectedDiff.file && currentSheetName === selectedDiff.sheet) {
    const diffColumnIndex = getColumnIndex(displayData, selectedDiff.column);
    if (diffColumnIndex >= 0) reviewTargetColumns.add(diffColumnIndex);
  }

  const currentSheetConfirmedCount = currentSheetDiffs.filter(diff => confirmedDiffs[diffConfirmKey(diff)]).length;

  const renderPreviewDialog = () => (
    <Dialog open={!!previewFile} onClose={handleClosePreview} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InsertDriveFileIcon color="success" />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>{previewFile?.name}</Typography>
          {!editMode ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => {
                if (currentPreview) {
                  setEditData(currentPreview.map(row => [...row]));
                  setEditMode(true);
                  setPreviewTab(0);
                  resetPreviewScroll();
                }
              }}
            >
              Редактировать
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" onClick={handleCancelEdit}>Отмена</Button>
              <Button variant="contained" size="small" color="success" startIcon={<CheckCircleIcon />} onClick={handleSaveEdit}>Сохранить</Button>
            </Box>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {previewFile && previewFile.sheets.length > 1 && (
          <Box sx={{ px: 2, pt: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={previewSheet}
              onChange={(_, value) => {
                setPreviewSheet(value);
                setEditMode(false);
                setEditData(null);
                resetPreviewScroll();
              }}
            >
              {previewFile.sheets.map((sheet, index) => (
                <Tab key={index} label={sheet.name} icon={<TableChartIcon />} iconPosition="start" />
              ))}
            </Tabs>
          </Box>
        )}

        {analyzed && (
          <Box sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs value={previewTab} onChange={(_, value) => setPreviewTab(value)}>
              <Tab label="Данные" />
              <Tab label={(
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  Изменения
                  <Chip label={currentSheetDiffs.length} size="small" color="info" sx={{ height: 18, fontSize: '0.65rem' }} />
                </Box>
              )}
              />
            </Tabs>
          </Box>
        )}

        {reviewIssue && previewTab === 0 && (
          <Alert
            severity="info"
            sx={{
              mx: 2,
              mt: 2,
              border: '1px solid rgba(25,140,254,0.2)',
              bgcolor: 'rgba(25,140,254,0.08)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {selectedDiff?.title || 'Ручное исправление'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.4 }}>
              Открыт лист {reviewIssue.sheet}. Подсвечено {reviewTargetCells.length > 0 ? `${reviewTargetCells.length} ячеек` : 'нужное поле'} для правки в колонке {reviewIssue.column}.
            </Typography>
          </Alert>
        )}

        {(!analyzed || previewTab === 0) && displayData && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {currentSheetMeta
                  ? `${currentSheetMeta.rows.toLocaleString()} строк · ${currentSheetMeta.cols} колонок`
                  : `${previewRows.length.toLocaleString()} строк`}
              </Typography>
              <Chip
                size="small"
                color="info"
                variant="outlined"
                label={previewRows.length > visibleRows.length ? 'Виртуальный скролл' : 'Полный лист'}
              />
            </Box>
            <TableContainer
              ref={previewTableRef}
              component={Paper}
              variant="outlined"
              onScroll={event => setPreviewScrollTop(event.currentTarget.scrollTop)}
              sx={{ maxHeight: PREVIEW_VIEWPORT_HEIGHT, overflowY: 'auto' }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 40, textAlign: 'center' }}>#</TableCell>
                    {previewHeaders.map((col, index) => {
                      const isTargetColumn = reviewTargetColumns.has(index);
                      return (
                        <TableCell
                          key={index}
                          sx={{
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            bgcolor: isTargetColumn
                              ? 'rgba(25,140,254,0.18)'
                              : previewErrorCols.has(col)
                                ? 'rgba(248,81,73,0.12)'
                                : previewWarnCols.has(col)
                                  ? 'rgba(210,153,34,0.12)'
                                  : previewInfoCols.has(col)
                                    ? 'rgba(88,166,255,0.1)'
                                    : undefined,
                            color: isTargetColumn
                              ? 'info.main'
                              : previewErrorCols.has(col)
                                ? 'error.main'
                                : previewWarnCols.has(col)
                                  ? 'warning.main'
                                  : undefined,
                            boxShadow: isTargetColumn ? 'inset 0 -2px 0 rgba(25,140,254,0.9)' : undefined,
                          }}
                        >
                          {col}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topSpacerHeight > 0 && (
                    <TableRow>
                      <TableCell colSpan={previewHeaders.length + 1} sx={{ p: 0, border: 0, height: topSpacerHeight }} />
                    </TableRow>
                  )}

                  {visibleRows.map((row, rowIndex) => {
                    const displayRow = visibleStartIndex + rowIndex + 1;
                    const isTargetRow = reviewTargetRows.has(displayRow);
                    return (
                      <TableRow key={displayRow} hover>
                        <TableCell
                          sx={{
                            color: isTargetRow ? 'info.main' : 'text.disabled',
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: isTargetRow ? 700 : 400,
                          }}
                        >
                          {displayRow}
                        </TableCell>
                        {row.map((cell, colIndex) => {
                          const col = displayData[0]?.[colIndex];
                          const isEmpty = !editMode && isBlankPreviewValue(cell);
                          const isTargetCell = reviewTargetCellKeys.has(cellKey(displayRow, colIndex));
                          const isSelectedDealRow = !editMode && selectedDealPreviewId !== null && row[0] === selectedDealPreviewId;
                          const columnSeverity = previewErrorCols.has(col)
                            ? 'error'
                            : previewWarnCols.has(col)
                              ? 'warning'
                              : previewInfoCols.has(col)
                                ? 'info'
                                : null;
                          const inputBorder = isTargetCell
                            ? 'rgba(25,140,254,0.9)'
                            : columnSeverity === 'error'
                              ? 'rgba(248,81,73,0.45)'
                              : columnSeverity === 'warning'
                                ? 'rgba(210,153,34,0.45)'
                                : '#30363d';

                          return (
                            <TableCell
                              key={colIndex}
                              sx={{
                                whiteSpace: 'nowrap',
                                p: editMode ? 0 : undefined,
                                color: isTargetCell
                                  ? 'info.main'
                                  : isEmpty
                                    ? 'text.disabled'
                                    : columnSeverity === 'error'
                                      ? 'error.main'
                                      : columnSeverity === 'warning'
                                        ? 'warning.main'
                                        : undefined,
                                fontStyle: isEmpty ? 'italic' : undefined,
                                bgcolor: isTargetCell
                                  ? 'rgba(25,140,254,0.16)'
                                  : isSelectedDealRow
                                    ? 'rgba(245,200,76,0.14)'
                                    : isEmpty
                                      ? 'rgba(148,163,184,0.08)'
                                      : columnSeverity === 'error'
                                      ? 'rgba(248,81,73,0.05)'
                                      : columnSeverity === 'warning'
                                        ? 'rgba(210,153,34,0.05)'
                                        : columnSeverity === 'info'
                                          ? 'rgba(88,166,255,0.04)'
                                          : undefined,
                                boxShadow: isTargetCell ? 'inset 0 0 0 1px rgba(25,140,254,0.55)' : undefined,
                                fontWeight: isSelectedDealRow && colIndex === 0 ? 700 : undefined,
                              }}
                            >
                              {editMode ? (
                                <input
                                  value={cell}
                                  onChange={event => handleCellEdit(displayRow, colIndex, event.target.value)}
                                  style={{
                                    width: '100%',
                                    minWidth: 60,
                                    background: isTargetCell ? 'rgba(25,140,254,0.08)' : 'transparent',
                                    border: `1px solid ${inputBorder}`,
                                    borderRadius: 4,
                                    color: '#e6edf3',
                                    padding: '4px 8px',
                                    fontSize: '0.85rem',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                  }}
                                />
                              ) : isEmpty ? (
                                <Typography component="span" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                                  (пусто)
                                </Typography>
                              ) : cell}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}

                  {bottomSpacerHeight > 0 && (
                    <TableRow>
                      <TableCell colSpan={previewHeaders.length + 1} sx={{ p: 0, border: 0, height: bottomSpacerHeight }} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {analyzed && previewTab === 1 && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Изменения в листе {currentSheetName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Подтверждено {currentSheetConfirmedCount} из {currentSheetDiffs.length}. Открывайте diff и переходите к нужной ячейке.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={() => currentSheetDiffs.forEach(handleConfirmDiff)}
                disabled={currentSheetConfirmedCount >= currentSheetDiffs.length}
              >
                Подтвердить все на листе
              </Button>
            </Box>

            {currentSheetDiffs.length === 0 && (
              <Alert severity="success">Для этого листа нет предложенных изменений</Alert>
            )}

            {currentSheetDiffs.map((diff) => {
                    const matchedIssue = findIssueForDiff(diff, issues);
              const resolved = !!confirmedDiffs[diffConfirmKey(diff)] || !!matchedIssue && isIssueResolved(matchedIssue, confirmedDiffs);
              return (
                <Paper key={diff.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.15, cursor: 'pointer' }}
                    onClick={() => toggleDiffExpand(diff.id)}
                  >
                    {resolved ? <CheckCircleIcon color="success" sx={{ fontSize: 18 }} /> :
                      diff.severity === 'error' ? <ErrorIcon color="error" sx={{ fontSize: 18 }} /> :
                        diff.severity === 'warning' ? <WarningIcon color="warning" sx={{ fontSize: 18 }} /> :
                          <InfoOutlinedIcon color="info" sx={{ fontSize: 18 }} />}

                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{diff.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {diff.column} · строка {diff.row}
                      </Typography>
                    </Box>

                    <Button
                      size="small"
                      variant={resolved ? 'outlined' : 'contained'}
                      color={resolved ? 'success' : 'primary'}
                      disabled={resolved}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleConfirmDiff(diff);
                      }}
                      sx={{ textTransform: 'none', minWidth: 0 }}
                    >
                      {resolved ? 'Подтверждено' : 'Подтвердить'}
                    </Button>

                    {expandedDiffs[diff.id] ? <ExpandLessIcon sx={{ color: 'text.disabled' }} /> : <ExpandMoreIcon sx={{ color: 'text.disabled' }} />}
                  </Box>

                  <Collapse in={expandedDiffs[diff.id]}>
                    <Box sx={{ px: 1.5, pb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          Предложение ИИ: строка {diff.row}, {diff.column}
                        </Typography>
                        <Button size="small" variant="text" onClick={() => handleManualReviewForDiff(diff)} sx={{ textTransform: 'none' }}>
                          Показать в данных
                        </Button>
                      </Box>
                      <DataDiffPreview diff={diff} />

                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.1 }}>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleManualReviewForDiff(diff)} sx={{ textTransform: 'none' }}>
                          Ручное редактирование
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </Paper>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClosePreview}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Fade in><Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>Загрузка данных</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Демо-данные берутся из реальных `.xlsx` в `public/datasets`. По кнопке браузер скачивает Excel, парсит его через SheetJS и открывает настоящий превью-лист.
      </Typography>

      <Paper variant="outlined" sx={{
        p: 4, textAlign: 'center', borderStyle: 'dashed', borderWidth: 2, mb: 3,
        borderColor: canProceed ? 'success.main' : 'primary.main',
        bgcolor: canProceed ? 'rgba(63,185,80,0.04)' : 'rgba(77,208,225,0.03)',
        transition: 'all 0.2s',
      }}>
        {canProceed ? (
          <Box>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
            <Typography variant="h6" color="success.main">
              Загружено: {files.length > 0 ? `${files.length} файла` : ''}{files.length > 0 && project?.imageFile ? ' + ' : ''}{project?.imageFile ? 'изображение' : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Добавьте ещё файлы или переходите к анализу</Typography>
          </Box>
        ) : (
          <Box>
            <CloudUploadIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
            <Typography variant="h6">Загрузите демо-данные</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Реальные `.xlsx` из каталога `/datasets`: CRM-выгрузка и 3 Excel-справочника
            </Typography>
          </Box>
        )}
        <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'center', gap: 1.5 }}>
          <Button
            variant={canProceed ? 'outlined' : 'contained'}
            startIcon={<CloudUploadIcon />}
            onClick={() => runAssistantAction('upload')}
          >
            Загрузить демо-данные
          </Button>
        </Box>
      </Paper>

      {files.length > 0 && !dataStory && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Не удалось построить рабочий слой по загруженному датасету.
        </Alert>
      )}

      {dataStory && (
        <DataPageErrorBoundary>
          <DataWorkspace
            story={dataStory}
            files={files}
            mode={workspaceMode}
            analysisStatus={analysisStatus}
            filters={workspaceFilters}
            filteredRows={filteredWorkspaceDeals}
            highlightedRowIds={highlightedWorkspaceDeals}
            selectedInsight={selectedWorkspaceInsight}
            projectStatus={status}
            cleaningProgress={cleaningProgress}
            onModeChange={setWorkspaceMode}
            onFilterChange={applyWorkspacePatch}
            onResetFilters={resetWorkspace}
            onSelectInsight={handleSelectWorkspaceInsight}
            onClearInsight={() => setSelectedWorkspaceInsightId(null)}
            onScenarioAction={handleWorkspaceScenarioAction}
            onAssistantAction={runAssistantAction}
            onOpenRequestRow={openDealRowPreview}
            tableScrollTop={workspaceTableScrollTop}
            onTableScroll={setWorkspaceTableScrollTop}
          />
        </DataPageErrorBoundary>
      )}

      {dataVersions.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Версии и CSV-срезы
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Оригинальные источники ниже не меняются. Каждый срез хранится отдельной версией, которую можно открыть или скачать.
          </Typography>
          {dataVersions.map((version) => (
            <Card key={version.version_id} variant="outlined" sx={{ mb: 1.25 }}>
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <TableChartIcon color="info" sx={{ fontSize: 20 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 240 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{version.name}</Typography>
                      <Chip label={`v${version.version_number}`} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                      <Chip label="CSV" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {version.row_count.toLocaleString()} строк · {version.column_count} колонок · источник: {version.source_table}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {version.instruction}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={() => openDataVersionPreview(version)} sx={{ textTransform: 'none' }}>
                      Просмотр
                    </Button>
                    <Button size="small" variant="contained" startIcon={<DownloadIcon />} onClick={() => downloadDataVersion(version)} sx={{ textTransform: 'none' }}>
                      Скачать CSV
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {files.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Загруженные источники
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Это исходные файлы сценария. Рабочий слой выше строится на лету из них, а не хранится отдельным объединённым `.xlsx`.
          </Typography>
          {files.map((file) => {
            const fileIssues = issues.filter(issue => issue.file === file.name);
            const errorCount = fileIssues.filter(issue => issue.severity === 'error' && !isIssueResolved(issue, confirmedDiffs)).length;
            const allFixed = errorCount === 0;
            const severity = errorCount > 0 ? 'error' : 'default';
            const isExpanded = expandedFile === file.name;

            return (
              <Card key={file.name} variant="outlined" sx={{
                mb: 1.5,
                borderColor: severity === 'error' ? 'rgba(248,81,73,0.3)' : undefined,
                bgcolor: severity === 'error' ? 'rgba(248,81,73,0.03)' : undefined,
              }}>
                <CardContent sx={{ py: 1.25, '&:last-child': { pb: isExpanded ? 0 : 1.25 } }}>
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label={`Открыть предпросмотр файла ${file.name}`}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 } }}
                    onClick={() => openFilePreview(file, 0)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openFilePreview(file, 0);
                      }
                    }}
                  >
                    <InsertDriveFileIcon color="success" sx={{ fontSize: 20 }} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{file.name}</Typography>
                        {analyzed && (allFixed || fileIssues.length === 0) && (
                          <Chip icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />} label="Исправлено" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                        {analyzed && errorCount > 0 && (
                          <Chip icon={<ErrorIcon sx={{ fontSize: '14px !important' }} />} label={`${errorCount} ошибок`} size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {file.size} · {file.sheets.length} {file.sheets.length === 1 ? 'лист' : 'листа'} · {file.sheets.reduce((sum, sheet) => sum + sheet.rows, 0).toLocaleString()} строк
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      {file.sheets.map((sheet, sheetIndex) => (
                        <Chip
                          key={sheetIndex}
                          icon={<TableChartIcon />}
                          label={sheet.name}
                          size="small"
                          variant="outlined"
                          onClick={event => {
                            event.stopPropagation();
                            openFilePreview(file, sheetIndex);
                          }}
                          sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
                        />
                      ))}
                      {analyzed && fileIssues.length > 0 && (
                        <Tooltip title={isExpanded ? 'Скрыть ошибки' : 'Показать ошибки'}>
                          <IconButton
                            size="small"
                            aria-label={`${isExpanded ? 'Скрыть' : 'Показать'} ошибки файла ${file.name}`}
                            onClick={event => { event.stopPropagation(); setExpandedFile(isExpanded ? null : file.name); }}
                          >
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                </CardContent>

                <Collapse in={isExpanded && analyzed && fileIssues.length > 0}>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, pt: 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {fileIssues.filter(issue => issue.severity === 'error').length > 0 && (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                          <ErrorIcon color="error" sx={{ fontSize: 15 }} />
                          <Typography variant="caption" color="error" sx={{ fontWeight: 700 }}>
                            Ошибки
                          </Typography>
                        </Box>
                        {fileIssues.filter(issue => issue.severity === 'error').map(issue => {
                          const resolved = isIssueResolved(issue, confirmedDiffs);
                          return (
                            <Box key={issue.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 }, opacity: resolved ? 0.55 : 1 }}>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ textDecoration: resolved ? 'line-through' : undefined }}>{issue.description}</Typography>
                                <Typography variant="caption" color="text.secondary">{issue.column} · {issue.affected} строк</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, alignItems: 'center' }}>
                                {resolved ? (
                                  <Chip icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />} label="Исправлено" size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                                ) : (
                                  <>
                                    {issue.autofix && (
                                      <Button size="small" variant="outlined" color="error" onClick={() => handleAutoConfirm(issue)} disabled={resolved} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
                                        {resolved ? 'Подтверждено' : 'Подтвердить'}
                                      </Button>
                                    )}
                                    <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: '14px !important' }} />} onClick={() => handleManualReviewForIssue(issue)} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
                                      Вручную
                                    </Button>
                                  </>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    {fileIssues.filter(issue => issue.severity === 'warning').length > 0 && (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                          <WarningIcon color="warning" sx={{ fontSize: 15 }} />
                          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>
                            Предупреждения
                          </Typography>
                        </Box>
                        {fileIssues.filter(issue => issue.severity === 'warning').map(issue => {
                          const resolved = isIssueResolved(issue, confirmedDiffs);
                          return (
                            <Box key={issue.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 }, opacity: resolved ? 0.55 : 1 }}>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ textDecoration: resolved ? 'line-through' : undefined }}>{issue.description}</Typography>
                                <Typography variant="caption" color="text.secondary">{issue.column} · {issue.affected} строк</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, alignItems: 'center' }}>
                                {resolved ? (
                                  <Chip icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />} label="Исправлено" size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                                ) : (
                                  <>
                                    {issue.autofix && (
                                      <Button size="small" variant="outlined" color="warning" onClick={() => handleAutoConfirm(issue)} disabled={resolved} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
                                        {resolved ? 'Подтверждено' : 'Подтвердить'}
                                      </Button>
                                    )}
                                    <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: '14px !important' }} />} onClick={() => handleManualReviewForIssue(issue)} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
                                      Вручную
                                    </Button>
                                  </>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    {fileIssues.filter(issue => issue.severity === 'info').length > 0 && (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                          <InfoOutlinedIcon color="info" sx={{ fontSize: 15 }} />
                          <Typography variant="caption" color="info.main" sx={{ fontWeight: 700 }}>
                            К сведению
                          </Typography>
                        </Box>
                        {fileIssues.filter(issue => issue.severity === 'info').map(issue => {
                          const diff = findDiffsForIssue(issue)[0];
                          return (
                            <Box key={issue.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2">{issue.description}</Typography>
                                <Typography variant="caption" color="text.secondary">{issue.column} · {issue.affected} строк</Typography>
                              </Box>
                              {diff && (
                                <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: '14px !important' }} />} onClick={() => handleManualReviewForDiff(diff)} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
                                  Показать
                                </Button>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Card>
            );
          })}
        </Box>
      )}

      {isCleaning && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Применяем исправления...</Typography>
          <LinearProgress variant="determinate" value={cleaningProgress} sx={{ height: 6, borderRadius: 99 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{Math.min(cleaningProgress, 100)}%</Typography>
        </Paper>
      )}

      {analyzed && !isCleaning && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {fixedCount > 0 ? `Исправлено ${fixedCount}` : ''}{confirmedCount > 0 ? ` · Подтверждено ${confirmedCount} из ${MOCK_DIFFS.length}` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => { setPetalStatus('data', 'green'); goToPetalStep('model', 0); }}>
              Проектирование данных
            </Button>
          </Box>
        </Box>
      )}

      {!analyzed && canProceed && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => { setPetalStatus('data', 'green'); goToPetalStep('model', 0); }}>
            Проектирование данных
          </Button>
        </Box>
      )}

      {renderPreviewDialog()}
    </Box></Fade>
  );
};

export default DataPage;

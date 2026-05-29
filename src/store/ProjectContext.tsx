import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type {
  Project, ProjectStatus, ChatMessage, ChatOption, PetalKey, NavigationMode,
} from '../types';
import {
  MOCK_DIFFS,
} from '../data/mockData';
import {
  getPetalFromRoute,
  getRouteForPetalStep,
  DEFAULT_PETAL_ENABLED,
} from '../components/Layout/petalFlow';
import { loadDemoFiles } from '../utils/demoDatasets';
import { generateDetailTables } from '../utils/semanticAssets';
import { api } from '../api';
import type { QualityResult } from '../api';
import {
  SESSION_STORAGE_KEY,
  buildImageDashboardCharts,
  buildIssuesFromQualityResults,
  fileFromPreviewMatrix,
  loadFromStorage,
  makeNewProject,
  matrixFromQueryResult,
  saveToStorage,
  tableNameFromFileName,
  uploadedFileFromBackendPreview,
  withPetalStatus,
  type ImageFactDashboardRow,
  type ImageKpiPayload,
  type ImageWidgetMeta,
} from './projectContextHelpers';
import type { ProjectContextType } from './projectContextTypes';

const ProjectContext = createContext<ProjectContextType | null>(null);

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const stored = loadFromStorage();
  const [projects, setProjects] = useState<Project[]>(stored.projects);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(stored.activeProjectId);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('flower');
  const [activePetal, setActivePetal] = useState<PetalKey | null>(null);
  const [selectedPetal, setSelectedPetal] = useState<PetalKey | null>(null);
  const [activeSection, setActiveSectionState] = useState<'overview' | 'data' | 'model' | 'mart' | 'mockup' | 'dashboard'>('overview');
  const [activeSubStep, setActiveSubStepState] = useState(0);
  const [cleaningProgress, setCleaningProgress] = useState(0);
  const [confirmedDiffs, setConfirmedDiffs] = useState<Record<string, boolean>>({});
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState('');
  const projectsRef = useRef<Project[]>(stored.projects);
  const activeProjectIdRef = useRef<string | null>(stored.activeProjectId);
  const sessionIdRef = useRef<string | null>(stored.sessionId);
  const loadedProjectIdRef = useRef<string | null>(null);

  const clearSessionState = useCallback(() => {
    sessionIdRef.current = null;
    loadedProjectIdRef.current = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const createBackendSession = useCallback(async () => {
    const { session_id } = await api.createSession();
    sessionIdRef.current = session_id;
    loadedProjectIdRef.current = null;
    localStorage.setItem(SESSION_STORAGE_KEY, session_id);
    return session_id;
  }, []);

  // Persist projects to localStorage on every change
  React.useEffect(() => {
    projectsRef.current = projects;
    activeProjectIdRef.current = activeProjectId;
    saveToStorage(projects, activeProjectId);
  }, [projects, activeProjectId]);

  // ---- Chat state ----
  const msgIdRef = useRef(1);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSide, setChatSide] = useState<'left' | 'right'>('right');
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const dashboardActionRef = useRef<((action: string) => void) | null>(null);
  const dataActionRef = useRef<((action: string) => void) | null>(null);

  const addMsg = useCallback((role: 'user' | 'assistant', text: string, options?: ChatOption[], messageType?: import('../types').ChatMessage['messageType']) => {
    const id = msgIdRef.current++;
    setChatMessages(prev => [...prev, { id, role, text, options, messageType }]);
    return id;
  }, []);


  const project = projects.find(p => p.id === activeProjectId) || null;

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const updateActive = useCallback((updates: Partial<Project>) => {
    if (!activeProjectId) return;
    updateProject(activeProjectId, updates);
  }, [activeProjectId, updateProject]);

  const ensureProjectId = useCallback((name: string) => {
    if (activeProjectId) return activeProjectId;
    const np = makeNewProject(name);
    setProjects(prev => {
      const next = [...prev, np];
      projectsRef.current = next;
      return next;
    });
    activeProjectIdRef.current = np.id;
    setActiveProjectId(np.id);
    return np.id;
  }, [activeProjectId]);

  const syncRouteState = useCallback((
    section: 'overview' | 'data' | 'model' | 'mart' | 'mockup' | 'dashboard',
    subStep: number,
  ) => {
    setActiveSectionState(section);
    setActiveSubStepState(subStep);
    if (section === 'overview') {
      setNavigationMode('flower');
      setActivePetal(null);
      return;
    }
    setNavigationMode('petal');
    setActivePetal(getPetalFromRoute(section, subStep));
  }, []);

  const openPetal = useCallback((key: PetalKey) => {
    const route = getRouteForPetalStep(key, 0);
    setNavigationMode('petal');
    setActivePetal(key);
    setSelectedPetal(key);
    setActiveSectionState(route.section);
    setActiveSubStepState(route.subStep);
  }, []);

  const goToPetalStep = useCallback((key: PetalKey, stepIndex: number) => {
    const route = getRouteForPetalStep(key, stepIndex);
    setNavigationMode('petal');
    setActivePetal(key);
    setSelectedPetal(key);
    setActiveSectionState(route.section);
    setActiveSubStepState(route.subStep);
  }, []);

  const openDataWorkspace = useCallback((action?: string) => {
    goToPetalStep('data', 0);
    if (action) {
      setTimeout(() => dataActionRef.current?.(action), 120);
    }
  }, [goToPetalStep]);

  const returnToFlower = useCallback(() => {
    syncRouteState('overview', 0);
    setSelectedPetal(null);
  }, [syncRouteState]);

  const setActiveSection = useCallback((section: 'overview' | 'data' | 'model' | 'mart' | 'mockup' | 'dashboard') => {
    if (section === 'overview') { returnToFlower(); return; }
    setActiveSectionState(section);
    setNavigationMode('petal');
    setActivePetal(getPetalFromRoute(section, activeSubStep));
  }, [activeSubStep, returnToFlower]);

  const setActiveSubStep = useCallback((subStep: number) => {
    setActiveSubStepState(subStep);
    if (activeSection !== 'overview') {
      setNavigationMode('petal');
      setActivePetal(getPetalFromRoute(activeSection, subStep));
    }
  }, [activeSection]);

  // ---- Petal status (no cascade reset!) ----
  const setPetalStatus = useCallback((key: PetalKey, status: import('../types').PetalStatus) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, petalStatuses: { ...p.petalStatuses, [key]: status } };
    }));
  }, [activeProjectId]);

  // Toggle petal on/off (grey ↔ yellow)
  const togglePetal = useCallback((key: PetalKey) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const cfg = p.petalEnabled || { ...DEFAULT_PETAL_ENABLED };
      // Dashboard всегда включён
      if (key === 'dashboard') return p;
      const newEnabled = { ...cfg, [key]: !cfg[key] };
      const newStatuses = { ...p.petalStatuses };
      if (!newEnabled[key]) {
        newStatuses[key] = 'grey';
      } else if (newStatuses[key] === 'grey') {
        newStatuses[key] = 'yellow';
      }
      return { ...p, petalEnabled: newEnabled, petalStatuses: newStatuses };
    }));
  }, [activeProjectId]);

  // ---- Multi-project ----
  const createProject = useCallback((name: string) => {
    const np = makeNewProject(name);
    setProjects(prev => [...prev, np]);
    setActiveProjectId(np.id);
    syncRouteState('overview', 0);
    setCleaningProgress(0);
    setConfirmedDiffs({});
  }, [syncRouteState]);

  const switchProject = useCallback((id: string) => {
    setActiveProjectId(id);
    syncRouteState('overview', 0);
    setCleaningProgress(0);
    setConfirmedDiffs({});
  }, [syncRouteState]);

  const renameProject = useCallback((id: string, name: string) => {
    updateProject(id, { name });
  }, [updateProject]);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (activeProjectId === id) {
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  }, [activeProjectId]);

  // ---- Session management ----
  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) {
      try {
        await api.listTables(sessionIdRef.current);
        return true;
      } catch {
        clearSessionState();
      }
    }
    try {
      await createBackendSession();
      return true;
    } catch (error) {
      addMsg('assistant', `Ошибка создания сессии: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [addMsg, clearSessionState, createBackendSession]);

  const ensureBackendSession = useCallback(async () => {
    const ok = await ensureSession();
    return ok ? sessionIdRef.current : null;
  }, [ensureSession]);

  const adoptBackendSession = useCallback((sessionId: string) => {
    sessionIdRef.current = sessionId;
    loadedProjectIdRef.current = activeProjectIdRef.current;
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }, []);

  const clearData = useCallback(async () => {
    const previousSessionId = sessionIdRef.current;
    clearSessionState();
    if (previousSessionId) {
      try {
        await api.deleteSession(previousSessionId);
      } catch (error) {
        console.warn('clearData: failed to delete session', error);
      }
    }
    // Clear project files too
    setProjects(prev => prev.map(p =>
      p.id === activeProjectId ? { ...p, files: [], dataVersions: [], imageFile: null, dashboardBuilt: false } : p
    ));
    try {
      await createBackendSession();
    } catch (error) {
      console.warn('clearData: failed to create new session', error);
    }
  }, [activeProjectId, clearSessionState, createBackendSession]);

  const rotateSession = useCallback(async () => {
    const previousSessionId = sessionIdRef.current;
    clearSessionState();
    if (previousSessionId) {
      try {
        await api.deleteSession(previousSessionId);
      } catch (error) {
        console.warn('Failed to delete previous backend session', error);
      }
    }
    try {
      await createBackendSession();
      return true;
    } catch (error) {
      addMsg('assistant', `Ошибка создания сессии: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [addMsg, clearSessionState, createBackendSession]);

  // Re-upload all project files to a fresh session
  const reuploadFiles = useCallback(async (pid: string) => {
    const proj = projectsRef.current.find(p => p.id === pid);
    if (!proj || proj.files.length === 0) {
      loadedProjectIdRef.current = pid;
      return;
    }
    let uploadedAny = false;
    for (const file of proj.files) {
      const firstSheet = file.sheets[0];
      const uploadFile = file._rawFile ?? (
        firstSheet?.preview && firstSheet.preview.length > 1
          ? fileFromPreviewMatrix(file.name, firstSheet.preview)
          : null
      );
      if (!uploadFile) continue;
      try {
        await api.uploadFile(sessionIdRef.current!, uploadFile, tableNameFromFileName(file.name));
        uploadedAny = true;
      } catch (e) {
        console.warn('Re-upload failed for', file.name, e);
      }
    }
    if (uploadedAny) {
      loadedProjectIdRef.current = pid;
    }
  }, [projects]);

  const ensureProjectSessionLoaded = useCallback(async (pid: string | null) => {
    const sessionOk = await ensureSession();
    if (!sessionOk) return false;
    if (!pid) return true;

    // Check if session has tables — if not, reset loaded flag so we re-upload
    if (loadedProjectIdRef.current === pid && sessionIdRef.current) {
      try {
        const tablesResp = await api.listTables(sessionIdRef.current);
        if (tablesResp && tablesResp.tables && tablesResp.tables.length > 0) return true; // session is fine
      } catch { /* fall through to re-upload */ }
      loadedProjectIdRef.current = null; // session lost data, force re-upload
    }

    if (loadedProjectIdRef.current === pid) return true;

    const proj = projectsRef.current.find(p => p.id === pid);
    if (!proj) return true;

    const hasRecoverableFiles = proj.files.some(file =>
      !!file._rawFile || file.sheets.some(sheet => sheet.preview.length > 1)
    );
    if (!hasRecoverableFiles) {
      loadedProjectIdRef.current = pid;
      return true;
    }

    const rotated = await rotateSession();
    if (!rotated) return false;
    await reuploadFiles(pid);
    return true;
  }, [ensureSession, projects, reuploadFiles, rotateSession]);

  // ---- Data step ----
  const uploadFiles = useCallback(async (realFiles?: File[]) => {
    const pid = ensureProjectId('genbi_access_requests');
    setChatCollapsed(false);
    addMsg('assistant', 'Загружаю источники данных…');
    console.info('[ProjectContext] uploadFiles start', {
      realFilesCount: realFiles?.length ?? 0,
      realFileNames: realFiles?.map(file => file.name) ?? [],
    });

    if (!await ensureSession()) return false;

    // ── Real files selected by user ───────────────────────────────────────────
    if (realFiles && realFiles.length > 0) {
      try {
        // Rotate session so stale tables from previous uploads don't pollute the schema
        const rotated = await rotateSession();
        if (!rotated) return false;

        const uploadedFiles: import('../types').UploadedFile[] = [];
        for (const file of realFiles) {
          console.info('[ProjectContext] uploading real file', { name: file.name, size: file.size });
          const result = await api.uploadFile(sessionIdRef.current!, file);
          console.info('[ProjectContext] backend upload completed', {
            name: file.name,
            tableName: result.table_name,
            rowCount: result.row_count,
          });
          uploadedFiles.push(await uploadedFileFromBackendPreview(
            sessionIdRef.current!,
            file,
            result.table_name,
            result.row_count,
            result.columns.map(c => c.name),
          ));
          console.info('[ProjectContext] backend preview loaded', {
            name: file.name,
            tableName: result.table_name,
          });
        }
        setProjects(prev => {
          const next = prev.map(p => p.id !== pid ? p : {
            ...p, files: uploadedFiles, dataVersions: [], status: 'files_uploaded' as ProjectStatus,
            petalStatuses: withPetalStatus(p.petalStatuses, 'data', 'green'),
            petalEnabled: { ...p.petalEnabled, data: true },
          });
          projectsRef.current = next;
          return next;
        });
        loadedProjectIdRef.current = pid;
        const names = uploadedFiles.map(f => f.name).join(', ');
        addMsg('assistant',
          `Загружено ${uploadedFiles.length} файл(а): ${names}. Нажмите «Анализировать данные», чтобы найти проблемы качества.`,
          [{ num: 1, label: 'Анализировать данные', action: () => handleChatAction('analyze') }],
          'insight',
        );
        return true;
      } catch (error) {
        addMsg('assistant', `Ошибка загрузки: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
      return false;
    }

    // ── Demo files ────────────────────────────────────────────────────────────
    try {
      console.info('[ProjectContext] loading demo files');
      const files = await loadDemoFiles();
      console.info('[ProjectContext] demo files loaded', { files: files.map(file => file.name) });
      let uploadedAny = false;

      for (const file of files) {
        try {
          console.info('[ProjectContext] uploading demo file', { name: file.name });
          const resp = await fetch(`/datasets/${encodeURIComponent(file.name)}?v=3`);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            const rawFile = new File([buf], file.name);
            await api.uploadFile(sessionIdRef.current!, rawFile, file.name.replace(/\.[^.]+$/, ''));
            uploadedAny = true;
            console.info('[ProjectContext] demo file uploaded to backend', { name: file.name });
          }
        } catch (e) {
          console.warn('Backend upload failed for', file.name, e);
        }
      }

      setProjects(prev => {
        const next = prev.map(p => p.id !== pid ? p : {
          ...p, files, dataVersions: [], status: 'files_uploaded' as ProjectStatus,
          petalStatuses: withPetalStatus(p.petalStatuses, 'data', 'green'),
          petalEnabled: { ...p.petalEnabled, data: true },
        });
        projectsRef.current = next;
        return next;
      });
      if (uploadedAny) {
        loadedProjectIdRef.current = pid;
      }
      const names = files.map((f: { name: string }) => f.name.replace(/\.[^.]+$/, '')).join(', ');
      addMsg('assistant',
        `Загружено ${files.length} источника: ${names}. Нажмите «Анализировать данные», чтобы найти проблемы качества.`,
        [{ num: 1, label: 'Анализировать данные', action: () => handleChatAction('analyze') }],
        'insight',
      );
      return true;
    } catch (error) {
      console.error('Failed to load demo datasets.', error);
      addMsg('assistant', `Не удалось загрузить demo-набор: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, [ensureProjectId, addMsg, ensureSession, rotateSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadImage = useCallback((mockup?: { name?: string; previewUrl?: string; size?: string; width?: number; height?: number }) => {
    setChatCollapsed(false);
    addMsg('assistant', `Картинка загружена${mockup?.name ? ': ' + mockup.name : ''}. Нажмите «Анализировать», чтобы распознать элементы дашборда.`);
    const doUpload = (pid: string) => {
      // Step 1: image loaded, analysis pending
      setTimeout(() => {
        setProjects(prev => prev.map(p => {
          if (p.id !== pid) return p;
          return {
            ...p,
            imageFile: {
              name: mockup?.name ?? 'dashboard_mockup.png',
              width: mockup?.width ?? 1920,
              height: mockup?.height ?? 1080,
              size: mockup?.size ?? '2.1 MB',
              previewUrl: mockup?.previewUrl,
              analysis: null,
            },
            petalStatuses: { ...p.petalStatuses, mockup: 'yellow' },
            petalEnabled: { ...p.petalEnabled, mockup: true },
          };
        }));
      }, 800);
    };

    if (!activeProjectId) {
      const np = makeNewProject('dashboard_mockup');
      setProjects(prev => [...prev, np]);
      setActiveProjectId(np.id);
      doUpload(np.id);
    } else {
      doUpload(activeProjectId);
    }
  }, [activeProjectId, addMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeFile = useCallback((index: number) => {
    if (loadedProjectIdRef.current === activeProjectId) {
      loadedProjectIdRef.current = null;
    }
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newFiles = p.files.filter((_: unknown, i: number) => i !== index);
      const hasFiles = newFiles.length > 0;
      return {
        ...p,
        files: newFiles,
        status: hasFiles ? 'files_uploaded' as ProjectStatus : 'empty' as ProjectStatus,
        petalStatuses: {
          ...p.petalStatuses,
          data: hasFiles ? 'green' : 'grey',
        },
      };
    }));
  }, [activeProjectId]);

  const removeFileByName = useCallback((fileName: string) => {
    if (loadedProjectIdRef.current === activeProjectId) {
      loadedProjectIdRef.current = null;
    }
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const newFiles = p.files.filter((f: import('../types').UploadedFile) => f.name !== fileName);
      const hasFiles = newFiles.length > 0;
      return {
        ...p,
        files: newFiles,
        status: hasFiles ? 'files_uploaded' as ProjectStatus : 'empty' as ProjectStatus,
        petalStatuses: { ...p.petalStatuses, data: hasFiles ? 'green' : 'grey' },
      };
    }));
  }, [activeProjectId]);

  const removeDataVersion = useCallback((versionId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, dataVersions: (p.dataVersions ?? []).filter(v => v.version_id !== versionId) };
    }));
  }, [activeProjectId]);

  const removeDashboardSnapshot = useCallback((snapId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const history = (p.dashboardHistory ?? []).filter(s => s.id !== snapId);
      return { ...p, dashboardHistory: history, dashboardBuilt: history.length > 0 || (p.dashboardCharts ?? []).length > 0 };
    }));
  }, [activeProjectId]);

  const removeImageFile = useCallback(() => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, imageFile: null };
    }));
  }, [activeProjectId]);

  const updateFileSheet = useCallback((fileName: string, sheetIndex: number, newPreview: string[][]) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return {
        ...p,
        files: p.files.map(f => {
          if (f.name !== fileName) return f;
          return {
            ...f,
            sheets: f.sheets.map((s, i) => i === sheetIndex ? { ...s, preview: newPreview } : s),
          };
        }),
      };
    }));
  }, [activeProjectId]);

  const refreshFilesFromBackend = useCallback(async (
    sid: string,
    currentFiles: import('../types').UploadedFile[],
  ) => {
    const { tables } = await api.listTables(sid);
    const previewResults = await Promise.all(tables.map(table => api.getTablePreview(sid, table)));
    const fileFromPreview = (preview: typeof previewResults[number]): import('../types').UploadedFile => {
      const matrix = matrixFromQueryResult(preview.columns, preview.data);
      return {
        name: preview.table_name,
        size: '',
        sheets: [{
          name: preview.table_name,
          rows: preview.row_count,
          cols: preview.columns.length,
          preview: matrix,
        }],
        status: 'done',
      };
    };

    if (currentFiles.length === 0) {
      return previewResults.map(fileFromPreview);
    }

    return currentFiles.map(file => {
      const tableName = tableNameFromFileName(file.name);
      const sheetNames = new Set(file.sheets.map(sheet => sheet.name));
      const preview = previewResults.find(item =>
        item.table_name === tableName ||
        tableNameFromFileName(item.table_name) === tableName ||
        sheetNames.has(item.table_name)
      );
      if (!preview) return file;
      const matrix = matrixFromQueryResult(preview.columns, preview.data);
      return {
        ...file,
        sheets: file.sheets.length > 0
          ? file.sheets.map((sheet, index) => index === 0 ? {
            ...sheet,
            rows: preview.row_count,
            cols: matrix[0]?.length ?? 0,
            preview: matrix,
          } : sheet)
          : [{
            name: 'Sheet1',
            rows: preview.row_count,
            cols: matrix[0]?.length ?? 0,
            preview: matrix,
          }],
      };
    });
  }, []);

  const reloadPreviews = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const pid = activeProjectIdRef.current;
    const currentFiles = projectsRef.current.find(p => p.id === pid)?.files ?? [];
    try {
      const refreshed = await refreshFilesFromBackend(sid, currentFiles);
      setProjects(prev => {
        const next = prev.map(p => p.id !== pid ? p : { ...p, files: refreshed });
        projectsRef.current = next;
        return next;
      });
    } catch {
      // silently ignore — preview will stay empty
    }
  }, [refreshFilesFromBackend]);

  const fetchIssuesFromBackend = useCallback(async (
    sid: string,
    currentFiles: import('../types').UploadedFile[],
  ) => {
    const { tables } = await api.listTables(sid);
    const settled = await Promise.allSettled(tables.map(table => api.getQuality(sid, table)));

    const qualityResults: QualityResult[] = [];
    const hardErrors: string[] = [];

    settled.forEach((item, index) => {
      if (item.status === 'fulfilled') {
        qualityResults.push(item.value);
        return;
      }
      const table = tables[index];
      const message = item.reason instanceof Error ? item.reason.message : String(item.reason);
      if (/Table '.*' not found in session/i.test(message)) {
        console.warn('[ProjectContext] Skipping missing table during quality check', { sid, table, message });
        return;
      }
      hardErrors.push(`${table}: ${message}`);
    });

    if (hardErrors.length > 0) {
      throw new Error(hardErrors[0]);
    }

    return buildIssuesFromQualityResults(currentFiles, qualityResults);
  }, []);

  // ---- Quality step ----
  const startAnalysis = useCallback(() => {
    const pid = activeProjectIdRef.current;
    if (pid) {
      setProjects(prev => {
        const next = prev.map(p => p.id === pid ? { ...p, status: 'analyzing' as ProjectStatus } : p);
        projectsRef.current = next;
        return next;
      });
    } else {
      updateActive({ status: 'analyzing' });
    }
    setChatCollapsed(false);
    addMsg('assistant', 'Анализирую данные — ищу дубликаты, пустые поля и противоречия между источниками…');

    (async () => {
      try {
        const currentProjectId = activeProjectIdRef.current;
        const sessionOk = await ensureProjectSessionLoaded(currentProjectId);
        if (!sessionOk) { updateActive({ status: 'files_uploaded' }); return; }

        const sid = sessionIdRef.current!;
        const { tables } = await api.listTables(sid);
        if (tables.length === 0) {
          addMsg('assistant', 'В сессии нет таблиц. Загрузите файл и попробуйте снова.');
          updateActive({ status: 'files_uploaded' });
          return;
        }

        const currentFiles = projectsRef.current.find(p => p.id === currentProjectId)?.files ?? [];
        const refreshedFiles = await refreshFilesFromBackend(sid, currentFiles);
        const issues = await fetchIssuesFromBackend(sid, refreshedFiles);

        setProjects(prev => {
          const next = prev.map(p => {
            if (p.id !== currentProjectId) return p;
            return {
              ...p,
              files: refreshedFiles,
              issues,
              status: 'analyzed' as ProjectStatus,
              petalStatuses: withPetalStatus(p.petalStatuses, 'data', issues.length > 0 ? 'yellow' : 'green'),
            };
          });
          projectsRef.current = next;
          return next;
        });

        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;

        addMsg('assistant',
          issues.length === 0
            ? 'Анализ завершён. Проблем не найдено — данные в отличном состоянии!'
            : `Анализ завершён. Найдено ${issues.length} проблем:\n\n` +
              `• ${errors} ошибок\n` +
              `• ${warnings} предупреждений\n\n` +
              'Нажмите на проблему слева — подсветятся нужные ячейки. Можно исправить автоматически или вручную.',
          issues.length > 0
            ? [{ num: 1, label: 'Исправить всё автоматически', action: () => handleChatAction('clean') }]
            : [],
          'insight',
        );
      } catch (e) {
        addMsg('assistant', `Ошибка анализа: ${e instanceof Error ? e.message : String(e)}`);
        updateActive({ status: 'files_uploaded' });
      }
    })();
  }, [activeProjectId, project?.files, updateActive, addMsg, refreshFilesFromBackend, fetchIssuesFromBackend, ensureProjectSessionLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const fixIssueCounter = useRef(0);
  const fixIssueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fixIssue = useCallback((id: number) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, issues: p.issues.map(i => i.id === id ? { ...i, fixed: true } : i) };
    }));
    fixIssueCounter.current += 1;
    if (fixIssueTimerRef.current) clearTimeout(fixIssueTimerRef.current);
    fixIssueTimerRef.current = setTimeout(() => {
      const count = fixIssueCounter.current;
      fixIssueCounter.current = 0;
      if (count > 1) {
        addMsg('assistant', `Исправлено ${count} проблем. Данные готовы к следующему шагу.`, [
          { num: 1, label: 'К модели данных', action: () => handleChatAction('erd') },
        ], 'action_result');
      } else {
        addMsg('assistant', 'Проблема исправлена. Продолжайте или переходите к следующему шагу.', [
          { num: 1, label: 'К модели данных', action: () => handleChatAction('erd') },
        ], 'action_result');
      }
    }, 600);
  }, [activeProjectId, addMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Cleaning step ----
  const startCleaning = useCallback(() => {
    if (!sessionIdRef.current) {
      addMsg('assistant', 'Сначала загрузите данные.');
      return;
    }
    updateActive({ status: 'cleaning' });
    setCleaningProgress(5);
    void (async () => {
      try {
        const sid = sessionIdRef.current!;
        await api.cleanSession(sid);
        setCleaningProgress(45);

        const refreshedFiles = await refreshFilesFromBackend(sid, project?.files ?? []);
        setCleaningProgress(75);

        const issues = await fetchIssuesFromBackend(sid, refreshedFiles);
        setCleaningProgress(100);

        setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            files: refreshedFiles,
            issues,
            status: 'cleaned',
            petalStatuses: withPetalStatus(p.petalStatuses, 'data', issues.length > 0 ? 'yellow' : 'green'),
          };
        }));
        addMsg(
          'assistant',
          issues.length === 0
            ? 'Очистка завершена. Данные исправлены и готовы к следующему шагу.'
            : `Очистка завершена. Осталось ${issues.length} проблем — их можно разобрать вручную в таблице.`,
          [
            { num: 1, label: 'Выбрать модель данных', action: () => handleChatAction('erd') },
            { num: 2, label: 'Открыть workspace', action: () => openDataWorkspace('filter:reset') },
          ],
          'action_result',
        );
      } catch (e) {
        addMsg('assistant', `Ошибка очистки: ${e instanceof Error ? e.message : String(e)}`);
        updateActive({ status: 'analyzed' });
      }
    })();
  }, [activeProjectId, project?.files, updateActive, addMsg, refreshFilesFromBackend, fetchIssuesFromBackend]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDiff = useCallback((key: string) => {
    setConfirmedDiffs(prev => ({ ...prev, [key]: true }));
  }, []);

  const confirmAllDiffs = useCallback(() => {
    const all: Record<string, boolean> = {};
    MOCK_DIFFS.forEach(diff => { all[`diff:${diff.id}`] = true; });
    setConfirmedDiffs(all);
  }, []);

  // ---- Model step ----
  const buildDetailLayer = useCallback(() => {
    if (project?.selectedERDModel === 'no_model') {
      addMsg('assistant', 'По текущему выбору детальный слой не нужен — можно идти сразу в дашборд по исходным таблицам.');
      setPetalStatus('model', 'green');
      goToPetalStep('dashboard', 0);
      return;
    }
    updateActive({ status: 'building_detail' });
    addMsg('assistant', 'Анализирую структуру таблиц — определяю ключи, типы колонок и связи между таблицами…');

    void (async () => {
      try {
        const sessionOk = await ensureProjectSessionLoaded(activeProjectId);
        if (!sessionOk) { updateActive({ status: 'files_uploaded' }); return; }

        const schema = await api.getSchema(sessionIdRef.current!);
        const detailTables: import('../types').DetailTable[] = schema.tables.map(t => ({
          name: t.name,
          type: t.type,
          rowCount: t.row_count,
          source: `${t.source} → ${t.type === 'transaction' ? 'Факт' : 'Справочник'}`,
          columns: t.columns.map(c => ({
            name: c.name,
            dataType: c.data_type,
            isPK: c.is_pk,
            isFK: c.is_fk,
            nullable: c.nullable,
          })),
        }));

        const suggestedModel = schema.suggested_model ?? 'star';

        setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            detailTables,
            selectedERDModel: suggestedModel,
            status: 'detail_built' as ProjectStatus,
            petalStatuses: { ...p.petalStatuses, detail: 'green' },
            petalEnabled: { ...p.petalEnabled, detail: true },
          };
        }));

        const factCount = schema.tables.filter(t => t.type === 'transaction').length;
        const dimCount = schema.tables.filter(t => t.type === 'reference').length;
        const relCount = schema.relationships.length;

        addMsg('assistant',
          `Детальный слой готов на основе реальных данных:\n\n` +
          `• ${schema.tables.length} таблиц (${factCount} фактов, ${dimCount} справочников)\n` +
          `• ${relCount} связей между таблицами\n` +
          `• Рекомендуемая модель: ${suggestedModel === 'star' ? 'Звезда ⭐' : suggestedModel === 'snowflake' ? 'Снежинка' : 'Плоская'}\n\n` +
          'Теперь можно сгенерировать ERD-схему.',
          [{ num: 1, label: 'Сгенерировать ERD', action: () => handleChatAction('erd') }],
          'action_result',
        );
      } catch (e) {
        addMsg('assistant', `Ошибка анализа схемы: ${e instanceof Error ? e.message : String(e)}`);
        updateActive({ status: 'files_uploaded' });
      }
    })();
  }, [project?.selectedERDModel, updateActive, addMsg, setPetalStatus, goToPetalStep, activeProjectId, ensureProjectSessionLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Mart (витрины) step ----
  const analyzeModelOptions = useCallback(async () => {
    const sessionOk = await ensureProjectSessionLoaded(activeProjectId);
    if (!sessionOk) return null;
    return api.getModelAdvice(sessionIdRef.current!);
  }, [activeProjectId, ensureProjectSessionLoaded]);

  const buildMart = useCallback(() => {
    updateActive({ status: 'building_mart' as ProjectStatus });
    setTimeout(() => {
      setProjects(prev => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        return {
          ...p,
          status: 'mart_built' as ProjectStatus,
          petalStatuses: { ...p.petalStatuses, mart: 'green' },
          petalEnabled: { ...p.petalEnabled, mart: true },
        };
      }));
    }, 2500);
  }, [activeProjectId, updateActive]);

  const setSelectedERDModel = useCallback((id: string) => {
    updateActive({ selectedERDModel: id, erdGenerated: false });
    const labels: Record<string, string> = {
      no_model: 'Без модели данных',
      star: 'Звезда',
      snowflake: 'Снежинка',
      datavault: 'Data Vault',
      flat: 'Плоская таблица',
    };
    addMsg(
      'assistant',
      id === 'no_model'
        ? `Выбран режим «${labels[id] ?? id}». Для этого сценария можно пропустить detail layer и перейти прямо к дашборду по исходным таблицам.`
        : `Выбрана модель «${labels[id] ?? id}». Теперь постройте детальный слой — система сформирует таблицы на основе ваших данных.`,
    );
  }, [updateActive, addMsg]);

  const generateERD = useCallback(() => {
    if (project?.selectedERDModel === 'no_model') {
      addMsg('assistant', 'Для этого сценария ERD не требуется — данных достаточно, чтобы перейти к дашборду напрямую.');
      setPetalStatus('model', 'green');
      goToPetalStep('dashboard', 0);
      return;
    }
    updateActive({ status: 'generating_erd' });
    addMsg('assistant', 'Генерирую ERD-схему на основе реальных данных…');

    void (async () => {
      try {
        const sessionOk = await ensureProjectSessionLoaded(activeProjectId);
        if (!sessionOk) { updateActive({ status: 'detail_built' }); return; }

        const schema = await api.getSchema(sessionIdRef.current!);

        // Build detailTables if not yet done
        const detailTables: import('../types').DetailTable[] = schema.tables.map(t => ({
          name: t.name,
          type: t.type,
          rowCount: t.row_count,
          source: t.source,
          columns: t.columns.map(c => ({
            name: c.name,
            dataType: c.data_type,
            isPK: c.is_pk,
            isFK: c.is_fk,
            nullable: c.nullable,
          })),
        }));

        setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            detailTables,
            erdGenerated: true,
            erdRelationships: schema.relationships,
            status: 'erd_generated' as ProjectStatus,
            petalStatuses: { ...p.petalStatuses, model: 'green' },
            petalEnabled: { ...p.petalEnabled, model: true },
          };
        }));

        const factCount = schema.tables.filter(t => t.type === 'transaction').length;
        const dimCount = schema.tables.filter(t => t.type === 'reference').length;
        // Navigate after React re-renders with new detailTables
        setTimeout(() => goToPetalStep('model', 1), 50);

        addMsg('assistant',
          `Модель данных готова:\n\n` +
          `• ${schema.tables.length} таблиц (${factCount} фактов, ${dimCount} справочников)\n` +
          `• ${schema.relationships.length} связей\n\n` +
          'Детальный слой открыт — список таблиц и колонок слева.',
          [
            { num: 1, label: 'Посмотреть ERD', action: () => goToPetalStep('model', 2) },
            { num: 2, label: 'Построить дашборд', action: () => handleChatAction('dashboard') },
          ],
          'action_result',
        );
      } catch (e) {
        addMsg('assistant', `Ошибка генерации ERD: ${e instanceof Error ? e.message : String(e)}`);
        updateActive({ status: 'detail_built' });
      }
    })();
  }, [project?.selectedERDModel, activeProjectId, updateActive, addMsg, goToPetalStep, ensureProjectSessionLoaded, setPetalStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Dashboard step ----
  const buildDashboard = useCallback((explicitTopic?: string) => {
    const resetDashboard = (message: string) => {
      if (activeProjectId) {
        setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            dashboardBuilt: false,
            dashboardCharts: [],
            petalStatuses: { ...p.petalStatuses, dashboard: 'yellow' },
          };
        }));
      }
      addMsg('assistant', message, [], 'insight');
    };

    const buildFromBackend = async () => {
      if (!activeProjectId) {
        resetDashboard('Нет активного проекта для генерации дашборда. Мок-виджеты отключены.');
        return;
      }

      const topic = explicitTopic?.trim() || 'общий обзор данных';

      try {
        const sessionOk = await ensureProjectSessionLoaded(activeProjectId);
        if (!sessionOk || !sessionIdRef.current) {
          resetDashboard('Сессия с backend не готова. Реальный дашборд пока не собран, мок-виджеты отключены.');
          return;
        }

        const result = await api.generateDashboard(sessionIdRef.current, topic);
        const charts = result.charts as unknown as import('../types').MockChart[];
        if (charts.length === 0) {
          resetDashboard(`Backend не вернул виджеты по теме «${topic}». Мок-виджеты отключены.`);
          return;
        }
        const versionResp = await api.createDataVersion(
          sessionIdRef.current,
          `Срез для дашборда: ${topic}`,
          `Версия данных для дашборда: ${topic}`,
        ).catch(error => {
          console.warn('Failed to create dashboard data version', error);
          return null;
        });

        setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const history = p.dashboardHistory ?? [];
          const snapshot: import('../types').DashboardSnapshot = {
            id: `snap_${Date.now()}`,
            label: `Дашборд ${history.length + 1}`,
            createdAt: new Date().toISOString(),
            charts,
          };
          return {
            ...p,
            dashboardBuilt: true,
            dashboardCharts: charts,
            dashboardHistory: [...history, snapshot],
            dataVersions: versionResp ? [...(p.dataVersions ?? []), versionResp.version] : (p.dataVersions ?? []),
            status: 'dashboard_built' as ProjectStatus,
            petalStatuses: { ...p.petalStatuses, dashboard: 'green' },
          };
        }));
        addMsg(
          'assistant',
          versionResp
            ? `Дашборд обновлён по теме «${topic}». Также создан CSV-срез: ${versionResp.version.name}.`
            : `Дашборд обновлён по теме «${topic}». CSV-срез создать не удалось, виджеты готовы.`,
          [],
          'action_result',
        );
      } catch (e) {
        resetDashboard(`Не удалось обновить дашборд по live-данным: ${e instanceof Error ? e.message : String(e)}.`);
      }
    };

    void buildFromBackend();
  }, [activeProjectId, addMsg, chatMessages, ensureProjectSessionLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildDashboardFromImage = useCallback((
    widgetMeta: ImageWidgetMeta,
    kpis: ImageKpiPayload,
    factDashboard?: ImageFactDashboardRow[],
    backgroundTheme?: 'dark' | 'light',
  ) => {
    const charts = buildImageDashboardCharts(widgetMeta, kpis, factDashboard);
    if (charts.length === 0) {
      addMsg('assistant', 'Анализ изображения не вернул ни одного виджета. Дашборд не построен.', [], 'action_result');
      return;
    }

    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      const history = p.dashboardHistory ?? [];
      const snapshot: import('../types').DashboardSnapshot = {
        id: `snap_${Date.now()}`,
        label: `Дашборд ${history.length + 1}`,
        createdAt: new Date().toISOString(),
        charts,
      };
      return {
        ...p,
        dashboardBuilt: true,
        dashboardBgTheme: backgroundTheme ?? 'dark',
        dashboardCharts: charts,
        dashboardHistory: [...history, snapshot],
        status: 'dashboard_built' as ProjectStatus,
        petalStatuses: { ...p.petalStatuses, dashboard: 'green' },
      };
    }));
    const kpiNames = kpis.map(k => k.metric_name).filter(Boolean);
    const chartTitles = Object.values(widgetMeta).map(w => w.title).filter(Boolean);
    const parts: string[] = [];
    if (kpiNames.length > 0) parts.push(`KPI: ${kpiNames.join(', ')}`);
    if (chartTitles.length > 0) parts.push(`Графики: ${chartTitles.join(', ')}`);
    const detail = parts.length > 0 ? `\n${parts.join('\n')}` : '';
    addMsg('assistant', `Дашборд построен: ${charts.length} виджетов.${detail}`, [], 'action_result');
  }, [activeProjectId, addMsg]);

  // ---- Full pipeline ----
  const runFullPipeline = useCallback(async () => {
    setPipelineRunning(true);
    const pid = ensureProjectId('genbi_access_requests');
    let pipelineFiles = [] as Project['files'];

    const up = (updates: Partial<Project>) => {
      setProjects(prev => prev.map(p => p.id === pid ? { ...p, ...updates } : p));
    };

    // Включаем все кубики
    up({
      petalEnabled: { data: true, detail: true, mart: false, model: true, mockup: false, dashboard: true },
      petalStatuses: {
        data: 'yellow', detail: 'yellow', mart: 'grey', model: 'yellow', mockup: 'grey', dashboard: 'yellow',
      },
    });

    setPipelineStep('Загрузка данных...');
    goToPetalStep('data', 0);

    try {
      const files = await loadDemoFiles();
      pipelineFiles = files;
      up({
        files,
        status: 'files_uploaded',
        petalStatuses: { data: 'yellow', detail: 'yellow', mart: 'grey', model: 'yellow', mockup: 'grey', dashboard: 'yellow' },
      });
    } catch (error) {
      console.error('Failed to load demo datasets for full pipeline.', error);
      up({
        files: [],
        status: 'empty',
        petalStatuses: { data: 'grey', detail: 'grey', mart: 'grey', model: 'grey', mockup: 'grey', dashboard: 'grey' },
      });
      addMsg('assistant', `Не удалось запустить demo pipeline: ${error instanceof Error ? error.message : String(error)}.`);
      setPipelineStep('');
      setPipelineRunning(false);
      return;
    }

    setPipelineStep('Анализ качества...');
    setTimeout(() => {
      up({ issues: [], status: 'analyzed' });
      setPipelineStep('Очистка данных...');
      setTimeout(() => {
        up({ status: 'cleaned', petalStatuses: { data: 'green', detail: 'yellow', mart: 'grey', model: 'yellow', mockup: 'grey', dashboard: 'yellow' } });
        setPipelineStep('Выбор модели данных...');
        goToPetalStep('model', 0);
        setTimeout(() => {
          const detailTables = generateDetailTables(pipelineFiles, 'star');
          up({ detailTables, status: 'detail_built', petalStatuses: { data: 'green', detail: 'green', mart: 'grey', model: 'yellow', mockup: 'grey', dashboard: 'yellow' } });
          setPipelineStep('Построение детального слоя...');
          goToPetalStep('detail', 0);
          setTimeout(() => {
            up({ erdGenerated: true, status: 'erd_generated', petalStatuses: { data: 'green', detail: 'green', mart: 'grey', model: 'green', mockup: 'grey', dashboard: 'yellow' } });
            setPipelineStep('Генерация модели данных...');
            goToPetalStep('model', 1);
            setTimeout(() => {
              up({
                dashboardBuilt: false,
                dashboardCharts: [],
                status: 'erd_generated',
                petalStatuses: { data: 'green', detail: 'green', mart: 'grey', model: 'green', mockup: 'grey', dashboard: 'yellow' },
              });
              addMsg('assistant', 'Пайплайн дошёл до шага дашборда, но синтетическая автогенерация отключена. Дальше нужен реальный backend-ответ для виджетов.');
              setPipelineStep('Ожидание реального дашборда...');
              goToPetalStep('dashboard', 0);
              setTimeout(() => {
                setPipelineStep('');
                setPipelineRunning(false);
              }, 1500);
            }, 1500);
          }, 1500);
        }, 1500);
      }, 1500);
    }, 1500);
  }, [ensureProjectId, goToPetalStep]);

  // ---- Chat actions ----
  const handleChatAction = useCallback((action: string) => {
    setChatCollapsed(false);
    switch (action) {
      case 'upload':
        addMsg('assistant', 'Загружаю CRM-выгрузку и Excel-справочники. После загрузки открою workspace для сверки источников.');
        void (async () => {
          await uploadFiles();
          openDataWorkspace();
          addMsg('assistant',
            'Загружено 4 источника.\n\n' +
            '• CRM-выгрузка заявок\n' +
            '• матрица типов доступа\n' +
            '• оргструктура подразделений\n' +
            '• справочник организаций\n\n' +
            'Теперь можно показать, как GenBI находит дубликаты, противоречия и проблемы качества между источниками.',
            [
              { num: 1, label: 'Показать проблемы качества', action: () => handleChatAction('analyze') },
              { num: 2, label: 'Запустить сверку', action: () => handleChatAction('analyze') },
              { num: 3, label: 'Открыть workspace', action: () => openDataWorkspace('filter:reset') },
            ],
            'insight',
          );
        })();
        break;
      case 'analyze':
        openDataWorkspace('view:analysis');
        startAnalysis();
        break;
      case 'clean':
        openDataWorkspace('focus:insight:quality_cleanup');
        addMsg('assistant', 'Запускаю исправление и нормализацию данных по CRM и Excel-справочникам.');
        startCleaning();
        break;
      case 'detail':
        addMsg('assistant', 'Строю детальный слой на основе очищенных заявок, справочника организаций и матрицы доступа.');
        goToPetalStep('model', 0);
        buildDetailLayer();
        setTimeout(() => {
          addMsg('assistant', 'Детальный слой готов. Теперь можно посмотреть рекомендуемую модель данных и итоговую ERD-схему.', [
            { num: 1, label: 'Показать модель данных', action: () => handleChatAction('erd') },
            { num: 2, label: 'Построить дашборд', action: () => handleChatAction('dashboard') },
          ]);
        }, 2800);
        break;
      case 'erd':
        addMsg('assistant', 'Генерирую модель данных и ERD на основе реальных данных…');
        goToPetalStep('model', 1);
        generateERD();
        break;
      case 'dashboard':
        goToPetalStep('dashboard', 0);
        buildDashboard();
        break;
      case 'pipeline':
        addMsg('assistant', 'Запускаю полный пайплайн: загрузка источников, сверка, очистка, модель и дашборд.');
        runFullPipeline();
        setTimeout(() => {
          addMsg('assistant', 'Полный пайплайн завершён. Дашборд уже собран.', [
            { num: 1, label: 'Начать заново', action: () => handleChatAction('reset') },
          ]);
        }, 10000);
        break;
      case 'mockup':
        addMsg('assistant', 'В этом сценарии макет не используется. Двигаемся через данные: CRM, Excel, очистка, модель и ERD.');
        break;
      case 'reset':
        addMsg('assistant', 'Создаю новую предметную область.');
        createProject('Новая область');
        setTimeout(() => {
          addMsg('assistant', 'Новая область создана. Можно выбрать следующий сценарий.', [
            { num: 1, label: 'Загрузить датасет', action: () => handleChatAction('upload') },
            { num: 2, label: 'Полный пайплайн', action: () => handleChatAction('pipeline') },
          ]);
        }, 500);
        break;
      case 'about':
        addMsg('assistant',
          'ИИ-ассистент умеет:\n\n' +
          '• Загружать CRM-выгрузку и Excel-справочники в единый workspace\n' +
          '• Искать дубликаты, конфликты дат и несоответствия матрице доступа\n' +
          '• Исправлять данные вручную или запускать автоочистку\n' +
          '• Предлагать модель данных и строить ERD по очищенному слою\n' +
          '• Собирать дашборд по итоговому массиву',
          [
            { num: 1, label: 'Загрузить датасет', action: () => handleChatAction('upload') },
            { num: 2, label: 'Запустить сверку', action: () => handleChatAction('analyze') },
            { num: 3, label: 'Демо-скрипт', action: () => handleChatAction('demo_script') },
          ],
        );
        break;
      case 'demo_script':
        addMsg('assistant',
          'Последовательность действий:\n\n' +
          '1. Загрузить CRM-выгрузку и Excel-справочники.\n' +
          '2. Показать, что GenBI сам находит дубликаты и противоречия между источниками.\n' +
          '3. Запустить исправление данных и затем открыть рекомендованную модель.\n' +
          '4. Перейти в детальный слой, ERD и итоговый дашборд.',
          [
            { num: 1, label: 'Шаг 1: загрузить источники', action: () => handleChatAction('upload') },
            { num: 2, label: 'Шаг 2: показать проблемы', action: () => handleChatAction('analyze') },
            { num: 3, label: 'Шаг 3: очистить', action: () => handleChatAction('clean') },
          ],
          'insight',
        );
        break;
      case 'show_duplicates':
        addMsg('assistant',
          'В таблице выделены строки с дублирующимися request_id.\n\nCRQ-00052 пришёл из CRM и из Excel одновременно — скорее всего, заявка была создана в системе, а потом продублирована вручную через Excel.\n\nGenBI оставит запись из CRM как «золотой» источник и удалит Excel-дубль.',
          [{ num: 1, label: 'Исправить автоматически', action: () => handleChatAction('clean') }],
          'anomaly',
        );
        break;
      case 'explain_org_match':
        addMsg('assistant',
          'Сопоставление работает так:\n\n1. Берём пустые строки «Организация» в CRM-выгрузке\n2. Ищем подразделение в org_structure.xlsx\n3. По подразделению находим связанную организацию в organizations_registry.xlsx\n4. Подставляем каноническое название\n\nЕсли сопоставление неоднозначно — помечаем строку на ручную проверку.',
          [],
          'insight',
        );
        break;
      case 'explain_access_matrix':
        addMsg('assistant',
          'Матрица доступа (access_matrix.xlsx) — это справочник правил:\nкакой тип доступа требует согласования СЭБ, на какой срок выдаётся и какой уровень критичности.\n\nGenBI сверяет каждую заявку из CRM с матрицей: если тип доступа помечен «Требует СЭБ: Да» — в заявке обязан быть номер SEB-APR-XXXX.\n\nБез этой сверки невозможно автоматически закрыть аудит.',
          [],
          'insight',
        );
        break;
      case 'show_org_structure':
        addMsg('assistant',
          'Справочник подразделений содержит 5 630 записей с уровнями L1–L4.\n\nДля нормализации используется поле «Каноническое название»:\n• «Цифровые каналы» → «Департамент цифровых каналов» (DP-06)\n• «Деп-т цифровых каналов» → «Департамент цифровых каналов» (DP-06)\n• «Сопровождение клиентов» → «Департамент сопровождения клиентов» (DP-02)\n\nПосле нормализации отчёты по подразделениям схлопнутся корректно.',
          [{ num: 1, label: 'Нормализовать названия', action: () => handleChatAction('clean') }],
          'insight',
        );
        break;
      default:
        addMsg('assistant', 'Пока не распознал этот сценарий. Могу предложить типовые действия ниже.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMsg, uploadFiles, uploadImage, startAnalysis, startCleaning, buildDetailLayer, generateERD, buildDashboard, createProject, goToPetalStep, runFullPipeline]);

  const sendChatMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    addMsg('user', text);
    setChatInput('');

    const num = parseInt(text, 10);
    if (!isNaN(num) && chatMessages.length > 0) {
      const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant' && m.options && m.options.length > 0);
      if (lastAssistant?.options) {
        const opt = lastAssistant.options.find(o => o.num === num);
        if (opt?.action) { setTimeout(() => opt.action(), 100); return; }
      }
    }

    if (/исправ|почист|очист|нормализ/i.test(text)) {
      setTimeout(() => handleChatAction('clean'), 100);
      return;
    }

    if (/^(?:анализ(?:ируй|ировать|ируем)?|провер(?:ь|ить|яй) (?:данные|качество|дубликаты|ошибки)|найди.*проблем|запусти.*анализ)/i.test(text)) {
      setTimeout(() => handleChatAction('analyze'), 100);
      return;
    }

    // ── Prompt-to-edit dashboard commands ─────────────────────────────────────
    const lowerText = text.toLowerCase();
    const dashboardEditActions: Array<{ pattern: RegExp; action: string; reply: string }> = [
      { pattern: /(линейн|line|line chart)/i, action: 'chart:set-type:line', reply: 'Готово: выбранный график переключён в линейный.' },
      { pattern: /(столб|bar|колонч|гистограмм)/i, action: 'chart:set-type:bar', reply: 'Готово: выбранный график переключён в столбцы.' },
      { pattern: /(горизонт|hbar)/i, action: 'chart:set-type:hbar', reply: 'Готово: выбранный график переключён в горизонтальные столбцы.' },
      { pattern: /(круг|pie|donut|кольц)/i, action: 'chart:set-type:pie', reply: 'Готово: выбранный график переключён в круговой.' },
      { pattern: /(покрась|цвет).*(красн|просроч)/i, action: 'chart:color:#ef4444', reply: 'Готово: акцент выбранного виджета стал красным.' },
      { pattern: /(sum|сумм|сумма|замени\s+count\s+на\s+sum)/i, action: 'chart:aggregation:sum', reply: 'Готово: агрегация виджета помечена как sum.' },
      { pattern: /(executive dark)/i, action: 'theme:executive-dark', reply: 'Готово: применена тема Executive Dark.' },
      { pattern: /(finance light)/i, action: 'theme:finance-light', reply: 'Готово: применена тема Finance Light.' },
      { pattern: /(consulting blue)/i, action: 'theme:consulting-blue', reply: 'Готово: применена тема Consulting Blue.' },
      { pattern: /(operations high contrast)/i, action: 'theme:operations-high-contrast', reply: 'Готово: применена тема Operations High Contrast.' },
      { pattern: /(pastel report)/i, action: 'theme:pastel-report', reply: 'Готово: применена тема Pastel Report.' },
    ];
    const topMatch = lowerText.match(/(?:оставь|покажи|топ|top)\D*(\d{1,2})/i);
    if (topMatch && /(топ|top|оставь|покажи)/i.test(text)) {
      const limit = Math.max(1, Math.min(20, Number(topMatch[1])));
      dashboardActionRef.current?.(`chart:top:${limit}`);
      addMsg('assistant', `Готово: оставил топ-${limit} в выбранном виджете.`, [], 'action_result');
      return;
    }
    const dashboardEditAction = dashboardEditActions.find(item => item.pattern.test(text));
    const looksLikeDashboardEdit = /(график|виджет|дашборд|chart|widget|покрась|цвет|тема|theme|count|sum|агрегац)/i.test(text);
    if (dashboardEditAction && looksLikeDashboardEdit) {
      dashboardActionRef.current?.(dashboardEditAction.action);
      addMsg('assistant', dashboardEditAction.reply, [], 'action_result');
      return;
    }

    // ── Dashboard generation ──────────────────────────────────────────────────
    // Match dashboard commands that carry a topic/filter qualifier.
    // Capture everything after the trigger word(s) as the topic.
    const dashboardMatch = /дашборд|dashboard/i.test(text) && (
      text.match(/дашборд\s+по\s+(?:теме\s+)?(.+)/i)
      ?? text.match(/(?:построй|сделай|покажи|собери|сгенерируй)\s+(?:только\s+)?дашборд\s+(.+)/i)
      ?? text.match(/(?:построй|сделай)\s+дашборд\s+(.+)/i)
      ?? text.match(/визуализ[а-я]+\s+(.+)/i)
    );

    // Bare dashboard command (no qualifier) — general overview
    const bareDashboardIntent = !dashboardMatch && (
      /(?:^|\s)dashboard(?:\s|$)/i.test(text)
      || (/дашборд/i.test(text) && /(?:давай|постро|сдела|откро|покаж|собер|сгенер)/i.test(text))
    );

    if (bareDashboardIntent) {
      setTimeout(() => handleChatAction('dashboard'), 100);
      return;
    }

    if (dashboardMatch) {
      const topic = dashboardMatch[1].trim();
      (async () => {
        addMsg('assistant', `Генерирую дашборд по теме «${topic}»…`);
        try {
          const sessionOk = await ensureProjectSessionLoaded(activeProjectId);
          if (!sessionOk) return;
          const result = await api.generateDashboard(sessionIdRef.current!, topic);
          const charts = result.charts as unknown as import('../types').MockChart[];
          if (charts.length === 0) {
            addMsg('assistant', 'Не удалось построить дашборд — данных по этой теме не нашлось.');
            return;
          }
          const versionResp = await api.createDataVersion(
            sessionIdRef.current!,
            `Срез для дашборда: ${topic}`,
            `Версия данных для дашборда: ${topic}`,
          ).catch(error => {
            console.warn('Failed to create dashboard data version', error);
            return null;
          });
          setProjects(prev => prev.map(p => {
            if (p.id !== activeProjectId) return p;
            const history = p.dashboardHistory ?? [];
            const snapshot: import('../types').DashboardSnapshot = {
              id: `snap_${Date.now()}`,
              label: topic,
              createdAt: new Date().toISOString(),
              charts,
            };
            return {
              ...p,
              dashboardCharts: charts,
              dashboardBuilt: true,
              dashboardHistory: [...history, snapshot],
              dataVersions: versionResp ? [...(p.dataVersions ?? []), versionResp.version] : (p.dataVersions ?? []),
              status: 'dashboard_built' as ProjectStatus,
              petalStatuses: { ...p.petalStatuses, dashboard: 'green' },
            };
          }));
          setTimeout(() => goToPetalStep('dashboard', 0), 50);
          addMsg(
            'assistant',
            versionResp
              ? `Дашборд по теме «${topic}» готов — ${charts.length} виджетов. CSV-срез сохранён как «${versionResp.version.name}».`
              : `Дашборд по теме «${topic}» готов — ${charts.length} виджетов. CSV-срез создать не удалось.`,
            [],
            'insight',
          );
        } catch (e: unknown) {
          addMsg('assistant', `Ошибка генерации дашборда: ${e instanceof Error ? e.message : String(e)}`);
        }
      })();
      return;
    }

    const transformIntent = /(?:убери|удали|исключи|оставь|срез|выгруз|csv|преобраз|сделай таблицу|таблицу (?:только )?по|только по|отфильтруй|фильтр по)/i.test(text);
    if (transformIntent && !dashboardMatch) {
      (async () => {
        addMsg('assistant', 'Создаю новую версию данных, оригинал не меняю…');
        try {
          const sessionOk = await ensureProjectSessionLoaded(activeProjectId);
          if (!sessionOk) return;
          const versionResp = await api.createDataVersion(sessionIdRef.current!, text);
          setProjects(prev => prev.map(p => p.id !== activeProjectId ? p : {
            ...p,
            dataVersions: [...(p.dataVersions ?? []), versionResp.version],
            petalStatuses: { ...p.petalStatuses, data: 'green' },
          }));
          addMsg(
            'assistant',
            `Готово: создана ${versionResp.version.name}. В ней ${versionResp.version.row_count} строк и ${versionResp.version.column_count} колонок. CSV доступен в разделе данных.`,
            [{ num: 1, label: 'Открыть данные', action: () => goToPetalStep('data', 0) }],
            'action_result',
          );
        } catch (e: unknown) {
          addMsg('assistant', `Не смог создать версию данных: ${e instanceof Error ? e.message : String(e)}`);
        }
      })();
      return;
    }

    // ── Real LLM via backend ──────────────────────────────────────────────────
    {
      (async () => {
        addMsg('assistant', '…');
        try {
          const sessionOk = await ensureProjectSessionLoaded(activeProjectId);
          if (!sessionOk) return;
          const result = await api.chat(sessionIdRef.current!, text);
          const answer = result.answer ?? `Найдено ${result.row_count} строк.`;
          setChatMessages(prev => {
            const msgs = [...prev];
            const lastIdx = msgs.map(m => m.role === 'assistant' && m.text === '…').lastIndexOf(true);
            if (lastIdx !== -1) {
              msgs[lastIdx] = { ...msgs[lastIdx], text: answer, sql: result.sql, rowCount: result.row_count };
            }
            return msgs;
          });
        } catch (e: unknown) {
          const detail = e instanceof Error ? e.message : String(e);
          const message = `Не смог обработать запрос: ${detail}`;
          setChatMessages(prev => {
            const msgs = [...prev];
            const lastIdx = msgs.map(m => m.role === 'assistant' && m.text === '…').lastIndexOf(true);
            if (lastIdx !== -1) {
              msgs[lastIdx] = { ...msgs[lastIdx], text: message };
            }
            return msgs;
          });
        }
      })();
    }
  }, [chatInput, chatMessages, addMsg, handleChatAction, activeProjectId, goToPetalStep, ensureProjectSessionLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendIssueMessage = useCallback((issueId: number) => {
    setChatCollapsed(false);
    const issue = projects.find(p => p.id === activeProjectId)?.issues.find(i => i.id === issueId);
    if (!issue) return;

    const icon = issue.severity === 'error' ? '❌' : '⚠️';
    const text = `${icon} ${issue.description}\n\nТаблица: ${issue.file}, колонка: ${issue.column}\nЗатронуто строк: ${issue.affected}`;
    setTimeout(() => {
      addMsg('assistant', text,
        [{ num: 1, label: 'Исправить автоматически', action: () => handleChatAction('clean') }],
        issue.severity === 'error' ? 'anomaly' : 'insight',
      );
    }, 150);
  }, [projects, activeProjectId, addMsg, handleChatAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerStepMessage = useCallback((step: 'upload' | 'data' | 'model' | 'dashboard') => {
    setChatCollapsed(false);
    setTimeout(() => {
      switch (step) {
        case 'upload':
          addMsg('assistant',
            'Загрузите файлы с данными или картинку с макетом дашборда.\n\nДля демо — нажмите в зоне загрузки, и данные подтянутся автоматически.',
            [{ num: 1, label: 'Загрузить демо-данные', action: () => handleChatAction('upload') }],
          );
          break;
        case 'data':
          addMsg('assistant',
            'Данные загружены. Слева — список проблем: дубликаты, пустые поля, нечисловые значения.\n\nНажмите на проблему — ячейки подсветятся в таблице.',
            [
              { num: 1, label: 'Исправить всё автоматически', action: () => handleChatAction('clean') },
              { num: 2, label: 'Показать дубликаты', action: () => openDataWorkspace('focus:insight:duplicate_requests') },
            ],
            'insight',
          );
          break;
        case 'model':
          addMsg('assistant',
            'Выберите модель данных — теперь можно сравнить варианты по реальному датасету, включая режим без модели. GenBI покажет, нужен ли detail layer вообще.\n\nПосле выбора можно либо построить detail/ERD, либо сразу перейти к дашборду.',
            [{ num: 1, label: 'Построить модель', action: () => handleChatAction('erd') }],
            'insight',
          );
          break;
        case 'dashboard':
          // buildDashboard() already emits its own messages — no duplicate needed
          break;
      }
    }, 400);
  }, [addMsg, handleChatAction]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ProjectContext.Provider value={{
      projects, project, activeProjectId,
      switchProject, createProject, renameProject, deleteProject,
      sessionId: sessionIdRef.current,
      ensureBackendSession,
      adoptBackendSession,
      uploadFiles, uploadImage, removeFile, removeFileByName, removeDataVersion, removeDashboardSnapshot, removeImageFile, updateFileSheet, reloadPreviews, clearData,
      startAnalysis, fixIssue,
      startCleaning, cleaningProgress, confirmedDiffs, confirmDiff, confirmAllDiffs,
      buildDetailLayer, buildMart, analyzeModelOptions, setSelectedERDModel, generateERD,
      buildDashboard, buildDashboardFromImage,
      runFullPipeline, pipelineRunning, pipelineStep,
      setPetalStatus, togglePetal,
      navigationMode, activePetal, selectedPetal, setSelectedPetal,
      openPetal, goToPetalStep, returnToFlower,
      activeSection, setActiveSection, activeSubStep, setActiveSubStep,
      chatMessages, chatInput, setChatInput, sendChatMessage,
      chatSide, setChatSide, chatCollapsed, setChatCollapsed,
      runAssistantAction: handleChatAction,
      triggerStepMessage,
      sendIssueMessage,
      dashboardActionRef, dataActionRef,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

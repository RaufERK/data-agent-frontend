import type { MutableRefObject } from 'react';
import type { ModelAdviceResult } from '../api';
import type { ChatMessage, NavigationMode, PetalKey, Project } from '../types';
import type { ImageFactDashboardRow, ImageKpiPayload, ImageWidgetMeta } from './projectContextHelpers';

export interface ProjectContextType {
  projects: Project[];
  project: Project | null;
  activeProjectId: string | null;
  switchProject: (id: string) => void;
  createProject: (name: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  sessionId: string | null;
  ensureBackendSession: () => Promise<string | null>;
  adoptBackendSession: (sessionId: string) => void;
  uploadFiles: (realFiles?: File[]) => Promise<boolean>;
  uploadImage: (mockup?: { name?: string; previewUrl?: string; size?: string; width?: number; height?: number }) => void;
  removeFile: (index: number) => void;
  removeFileByName: (fileName: string) => void;
  removeDataVersion: (versionId: string) => void;
  removeDashboardSnapshot: (snapId: string) => void;
  removeImageFile: () => void;
  updateFileSheet: (fileName: string, sheetIndex: number, newPreview: string[][]) => void;
  reloadPreviews: () => Promise<void>;
  clearData: () => Promise<void>;
  startAnalysis: () => void;
  fixIssue: (id: number) => void;
  startCleaning: () => void;
  cleaningProgress: number;
  confirmedDiffs: Record<string, boolean>;
  confirmDiff: (key: string) => void;
  confirmAllDiffs: () => void;
  buildDetailLayer: () => void;
  buildMart: () => void;
  analyzeModelOptions: () => Promise<ModelAdviceResult | null>;
  setSelectedERDModel: (id: string) => void;
  generateERD: () => void;
  buildDashboard: (explicitTopic?: string) => void;
  buildDashboardFromImage: (
    widgetMeta: ImageWidgetMeta,
    kpis: ImageKpiPayload,
    factDashboard?: ImageFactDashboardRow[],
    backgroundTheme?: 'dark' | 'light',
  ) => void;
  runFullPipeline: () => Promise<void>;
  pipelineRunning: boolean;
  pipelineStep: string;
  setPetalStatus: (key: PetalKey, status: import('../types').PetalStatus) => void;
  togglePetal: (key: PetalKey) => void;
  navigationMode: NavigationMode;
  activePetal: PetalKey | null;
  selectedPetal: PetalKey | null;
  setSelectedPetal: (key: PetalKey | null) => void;
  openPetal: (key: PetalKey) => void;
  goToPetalStep: (key: PetalKey, stepIndex: number) => void;
  returnToFlower: () => void;
  activeSection: 'overview' | 'data' | 'model' | 'mart' | 'mockup' | 'dashboard';
  setActiveSection: (s: 'overview' | 'data' | 'model' | 'mart' | 'mockup' | 'dashboard') => void;
  activeSubStep: number;
  setActiveSubStep: (n: number) => void;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  sendChatMessage: () => void;
  chatSide: 'left' | 'right';
  setChatSide: (s: 'left' | 'right') => void;
  chatCollapsed: boolean;
  setChatCollapsed: (v: boolean) => void;
  runAssistantAction: (action: string) => void;
  triggerStepMessage: (step: 'upload' | 'data' | 'model' | 'dashboard') => void;
  sendIssueMessage: (issueId: number) => void;
  dashboardActionRef: MutableRefObject<((action: string) => void) | null>;
  dataActionRef: MutableRefObject<((action: string) => void) | null>;
}

import * as XLSX from '@e965/xlsx';
import type { UploadedFile } from '../types';

const DEMO_DATASET_FILES = [
  'crm_requests_export.xlsx',
  'access_matrix.xlsx',
  'org_structure.xlsx',
  'organizations_registry.xlsx',
] as const;

// Bump this version when dataset files change to bust the in-memory cache
const DATASET_VERSION = 3;
let cachedDemoFilesVersion = 0;
let cachedDemoFilesPromise: Promise<UploadedFile[]> | null = null;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
};

const cloneUploadedFiles = (files: UploadedFile[]): UploadedFile[] => (
  files.map(file => ({
    ...file,
    sheets: file.sheets.map(sheet => ({
      ...sheet,
      preview: sheet.preview.map(row => [...row]),
    })),
  }))
);

const normalizeCellValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const sheetToMatrix = (sheet: XLSX.WorkSheet): string[][] => {
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);

  return rows.map(row => {
    const normalizedRow = row.map(normalizeCellValue);
    if (normalizedRow.length < maxCols) {
      normalizedRow.push(...Array(maxCols - normalizedRow.length).fill(''));
    }
    return normalizedRow;
  });
};

const buildDatasetUrls = (fileName: string) => {
  const encodedFileName = encodeURIComponent(fileName);
  const candidates = new Set<string>();
  const baseUrl = import.meta.env.BASE_URL || '/';
  const v = `?v=3`;

  candidates.add(`${baseUrl}datasets/${encodedFileName}${v}`);
  candidates.add(`/datasets/${encodedFileName}${v}`);

  if (typeof window !== 'undefined') {
    const { origin, pathname } = window.location;
    candidates.add(new URL(`datasets/${encodedFileName}`, window.location.href).toString());

    const legacyPrefix = '/sw17095/ai202509101603/';
    if (pathname.startsWith(legacyPrefix)) {
      candidates.add(`${origin}${legacyPrefix}datasets/${encodedFileName}`);
    }
  }

  return Array.from(candidates);
};

const loadSingleWorkbook = async (fileName: string): Promise<UploadedFile> => {
  const errors: string[] = [];

  for (const url of buildDatasetUrls(fileName)) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        errors.push(`${url} -> HTTP ${response.status}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: false });

      return {
        name: fileName,
        size: formatFileSize(arrayBuffer.byteLength),
        sheets: workbook.SheetNames.map(sheetName => {
          const preview = sheetToMatrix(workbook.Sheets[sheetName]);
          const cols = preview.reduce((max, row) => Math.max(max, row.length), 0);

          return {
            name: sheetName,
            rows: Math.max(preview.length - 1, 0),
            cols,
            preview,
          };
        }),
        status: 'done',
      };
    } catch (error) {
      errors.push(`${url} -> ${error instanceof Error ? error.message : 'network error'}`);
    }
  }

  throw new Error(`Failed to load demo dataset: ${fileName}. Tried: ${errors.join('; ')}`);
};

export const loadDemoFiles = async (): Promise<UploadedFile[]> => {
  if (!cachedDemoFilesPromise || cachedDemoFilesVersion !== DATASET_VERSION) {
    cachedDemoFilesVersion = DATASET_VERSION;
    cachedDemoFilesPromise = Promise.all(DEMO_DATASET_FILES.map(loadSingleWorkbook))
      .catch((error) => {
        cachedDemoFilesPromise = null;
        throw error;
      });
  }

  return cloneUploadedFiles(await cachedDemoFilesPromise);
};

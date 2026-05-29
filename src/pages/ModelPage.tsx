import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Card, CardContent, Chip,
  LinearProgress, CircularProgress, Alert, AlertTitle, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, TextField, Select, MenuItem, Checkbox,
  Collapse, Switch, FormControlLabel,
  Fade,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import CodeIcon from '@mui/icons-material/Code';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useProject } from '../store/ProjectContext';
import { MOCK_ERD_MODELS } from '../data/mockData';
import { generateDetailTables } from '../utils/semanticAssets';
import InteractiveERD from '../components/shared/InteractiveERD';
import type { ERDNode, ERDEdge } from '../components/shared/InteractiveERD';
import type { ModelAdviceOption, ModelAdviceResult } from '../api';
import type { DetailColumn, DetailTable, Project } from '../types';

const MODEL_OPTIONS: Array<{ id: 'no_model' | 'star' | 'snowflake' | 'datavault'; name: string; description: string }> = [
  {
    id: 'no_model',
    name: 'Без модели данных',
    description: 'Прямой путь: работать по исходным таблицам без detail layer и ERD, если датасет это позволяет.',
  },
  {
    id: 'star',
    name: 'Звезда (Star Schema)',
    description: MOCK_ERD_MODELS.find(model => model.id === 'star')?.description ?? '',
  },
  {
    id: 'snowflake',
    name: 'Снежинка (Snowflake Schema)',
    description: MOCK_ERD_MODELS.find(model => model.id === 'snowflake')?.description ?? '',
  },
  {
    id: 'datavault',
    name: 'Data Vault 2.0',
    description: MOCK_ERD_MODELS.find(model => model.id === 'datavault')?.description ?? '',
  },
];

const ModelPage: React.FC = () => {
  const {
    project, setSelectedERDModel, buildDetailLayer, analyzeModelOptions,
    activeSubStep, goToPetalStep,
    setPetalStatus,
  } = useProject();

  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [editColumns, setEditColumns] = useState<DetailColumn[]>([]);
  const [compareWithData, setCompareWithData] = useState(true);
  const [previewTables, setPreviewTables] = useState<DetailTable[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modelAdvice, setModelAdvice] = useState<ModelAdviceResult | null>(null);
  const [modelAdviceLoading, setModelAdviceLoading] = useState(false);
  const [modelAdviceError, setModelAdviceError] = useState<string | null>(null);

  const status = project?.status || 'empty';
  const selectedModelId = project?.selectedERDModel || 'star';
  const detailTables = project?.detailTables || [];
  const detailBuilt = detailTables.length > 0;
  const buildingDetail = status === 'building_detail';

  const startAnalysis = useCallback(async () => {
    if (!project || project.files.length === 0) return;
    setModelAdviceLoading(true);
    setModelAdviceError(null);
    try {
      const result = await analyzeModelOptions();
      setModelAdvice(result);
    } catch (error) {
      setModelAdvice(null);
      setModelAdviceError(error instanceof Error ? error.message : String(error));
    } finally {
      setModelAdviceLoading(false);
    }
  }, [project, analyzeModelOptions]);

  useEffect(() => {
    setPreviewTables([]);
    setExpandedTable(null);
    setEditingTable(null);
    setEditColumns([]);
  }, [project?.id, selectedModelId]);

  useEffect(() => {
    // Keep detail layer inline under "Выбор модели данных" once it is built.
    if (activeSubStep !== 0) return;
    if (previewTables.length > 0) return;
    if (detailTables.length === 0) return;
    setPreviewTables(detailTables);
  }, [activeSubStep, previewTables.length, detailTables]);

  useEffect(() => {
    // Auto-build detail layer only when explicitly navigating to step 1
    // without ERD already being generated (generateERD handles its own build)
    if (activeSubStep === 1 && !detailBuilt && !buildingDetail && project
        && project.status !== 'generating_erd' && project.status !== 'erd_generated') {
      buildDetailLayer();
    }
  }, [activeSubStep, detailBuilt, buildingDetail, project, buildDetailLayer]);

  const tableTypeColor = (type: string) => {
    if (type === 'fact' || type === 'transaction') return 'error';
    if (type === 'hub') return 'secondary';
    if (type === 'link') return 'warning';
    if (type === 'satellite') return 'info';
    return 'success';
  };

  const tableTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fact: 'Факт', dimension: 'Измерение', hub: 'Хаб', link: 'Линк',
      satellite: 'Сателлит', bridge: 'Мост', transaction: 'Транзакция',
      reference: 'Справочник', aggregate: 'Агрегат',
    };
    return labels[type] || type;
  };

  const DATA_TYPES = ['BIGINT', 'INT', 'VARCHAR(20)', 'VARCHAR(50)', 'VARCHAR(100)', 'VARCHAR(255)', 'TEXT', 'DATE', 'DATETIME', 'DECIMAL(12,2)', 'DECIMAL(5,2)', 'BOOLEAN', 'FLOAT'];

  const buildActualERD = (tables: DetailTable[], relationships?: Project['erdRelationships']): { nodes: ERDNode[]; edges: ERDEdge[] } => {
    const positions = [
      [40, 30], [340, 30], [640, 30],
      [40, 310], [340, 310], [640, 310],
      [40, 590], [340, 590], [640, 590],
    ];

    const nodes: ERDNode[] = tables.map((table, index) => ({
      id: table.name,
      name: table.name,
      color: table.type === 'transaction' ? '#e53935' : table.type === 'aggregate' ? '#0288D1' : '#43A047',
      x: positions[index]?.[0] ?? 40 + ((index % 3) * 300),
      y: positions[index]?.[1] ?? 30 + (Math.floor(index / 3) * 280),
      w: 220,
      columns: table.columns.slice(0, 8).map(column => ({
        name: column.name,
        type: column.dataType,
        pk: column.isPK,
        fk: column.isFK,
      })),
    }));

    const pkMap = new Map<string, string>();
    tables.forEach(table => {
      table.columns.filter(column => column.isPK).forEach(column => pkMap.set(column.name, table.name));
    });

    const edges: ERDEdge[] = [];

    if (relationships && relationships.length > 0) {
      // Use backend-detected relationships
      relationships.forEach(rel => {
        edges.push({ from: rel.to_table, to: rel.from_table, label: rel.from_col });
      });
    } else {
      // Fallback: infer from PK/FK names
      tables.forEach(table => {
        table.columns.filter(column => column.isFK).forEach(column => {
          const target = pkMap.get(column.name)
            ?? tables.find(candidate => candidate !== table && candidate.name.includes(column.name.replace(/_id$|_hk$/, '')))?.name;
          if (target) {
            edges.push({ from: target, to: table.name, label: column.name });
          }
        });
      });
    }

    return { nodes, edges };
  };

  /* ---- ERD diagram data ---- */
  const STAR_NODES: ERDNode[] = [
    { id: 'fact_sales', name: 'fact_sales', color: '#e53935', x: 340, y: 160, w: 220, columns: [
      { name: 'sale_id', type: 'SERIAL', pk: true }, { name: 'date_id', type: 'INT', fk: true }, { name: 'client_id', type: 'INT', fk: true },
      { name: 'product_id', type: 'INT', fk: true }, { name: 'manager_id', type: 'INT', fk: true }, { name: 'region_id', type: 'INT', fk: true },
      { name: 'quantity', type: 'INT' }, { name: 'amount', type: 'DECIMAL' }, { name: 'discount', type: 'DECIMAL' },
    ]},
    { id: 'dim_date', name: 'dim_date', color: '#43A047', x: 60, y: 10, w: 180, columns: [
      { name: 'date_id', type: 'SERIAL', pk: true }, { name: 'full_date', type: 'DATE' }, { name: 'year', type: 'INT' }, { name: 'quarter', type: 'INT' }, { name: 'month', type: 'INT' },
    ]},
    { id: 'dim_client', name: 'dim_client', color: '#43A047', x: 680, y: 10, w: 200, columns: [
      { name: 'client_id', type: 'SERIAL', pk: true }, { name: 'client_name', type: 'VARCHAR' }, { name: 'segment', type: 'VARCHAR' }, { name: 'city', type: 'VARCHAR' }, { name: 'region', type: 'VARCHAR' },
    ]},
    { id: 'dim_product', name: 'dim_product', color: '#43A047', x: 30, y: 360, w: 200, columns: [
      { name: 'product_id', type: 'SERIAL', pk: true }, { name: 'product_name', type: 'VARCHAR' }, { name: 'category', type: 'VARCHAR' }, { name: 'subcategory', type: 'VARCHAR' }, { name: 'brand', type: 'VARCHAR' },
    ]},
    { id: 'dim_manager', name: 'dim_manager', color: '#43A047', x: 360, y: 430, w: 180, columns: [
      { name: 'manager_id', type: 'SERIAL', pk: true }, { name: 'manager_name', type: 'VARCHAR' }, { name: 'department', type: 'VARCHAR' },
    ]},
    { id: 'dim_region', name: 'dim_region', color: '#43A047', x: 680, y: 340, w: 200, columns: [
      { name: 'region_id', type: 'SERIAL', pk: true }, { name: 'region_name', type: 'VARCHAR' }, { name: 'federal_district', type: 'VARCHAR' }, { name: 'country', type: 'VARCHAR' },
    ]},
  ];
  const STAR_EDGES: ERDEdge[] = [
    { from: 'dim_date', to: 'fact_sales', label: 'date_id' },
    { from: 'dim_client', to: 'fact_sales', label: 'client_id' },
    { from: 'dim_product', to: 'fact_sales', label: 'product_id' },
    { from: 'dim_manager', to: 'fact_sales', label: 'manager_id' },
    { from: 'dim_region', to: 'fact_sales', label: 'region_id' },
  ];

  const SNOWFLAKE_NODES: ERDNode[] = [
    { id: 'fact_sales', name: 'fact_sales', color: '#e53935', x: 360, y: 170, w: 200, columns: [
      { name: 'sale_id', type: 'SERIAL', pk: true }, { name: 'date_id', type: 'INT', fk: true }, { name: 'client_id', type: 'INT', fk: true },
      { name: 'product_id', type: 'INT', fk: true }, { name: 'manager_id', type: 'INT', fk: true }, { name: 'quantity', type: 'INT' }, { name: 'amount', type: 'DECIMAL' },
    ]},
    { id: 'dim_date', name: 'dim_date', color: '#43A047', x: 40, y: 10, w: 160, columns: [
      { name: 'date_id', type: 'SERIAL', pk: true }, { name: 'full_date', type: 'DATE' }, { name: 'month_id', type: 'INT', fk: true },
    ]},
    { id: 'dim_month', name: 'dim_month', color: '#66BB6A', x: 40, y: 110, w: 140, columns: [
      { name: 'month_id', type: 'SERIAL', pk: true }, { name: 'quarter_id', type: 'INT', fk: true }, { name: 'month_name', type: 'VARCHAR' },
    ]},
    { id: 'dim_quarter', name: 'dim_quarter', color: '#81C784', x: 40, y: 210, w: 140, columns: [
      { name: 'quarter_id', type: 'SERIAL', pk: true }, { name: 'year', type: 'INT' }, { name: 'quarter_num', type: 'INT' },
    ]},
    { id: 'dim_client', name: 'dim_client', color: '#43A047', x: 650, y: 10, w: 170, columns: [
      { name: 'client_id', type: 'SERIAL', pk: true }, { name: 'client_name', type: 'VARCHAR' }, { name: 'segment', type: 'VARCHAR' }, { name: 'city_id', type: 'INT', fk: true },
    ]},
    { id: 'dim_city', name: 'dim_city', color: '#66BB6A', x: 680, y: 130, w: 160, columns: [
      { name: 'city_id', type: 'SERIAL', pk: true }, { name: 'city_name', type: 'VARCHAR' }, { name: 'region_id', type: 'INT', fk: true },
    ]},
    { id: 'dim_region', name: 'dim_region', color: '#81C784', x: 680, y: 240, w: 160, columns: [
      { name: 'region_id', type: 'SERIAL', pk: true }, { name: 'region_name', type: 'VARCHAR' }, { name: 'district', type: 'VARCHAR' },
    ]},
    { id: 'dim_product', name: 'dim_product', color: '#43A047', x: 100, y: 360, w: 180, columns: [
      { name: 'product_id', type: 'SERIAL', pk: true }, { name: 'product_name', type: 'VARCHAR' }, { name: 'category_id', type: 'INT', fk: true },
    ]},
    { id: 'dim_category', name: 'dim_category', color: '#66BB6A', x: 30, y: 460, w: 160, columns: [
      { name: 'category_id', type: 'SERIAL', pk: true }, { name: 'category_name', type: 'VARCHAR' }, { name: 'department', type: 'VARCHAR' },
    ]},
    { id: 'dim_manager', name: 'dim_manager', color: '#43A047', x: 600, y: 380, w: 180, columns: [
      { name: 'manager_id', type: 'SERIAL', pk: true }, { name: 'manager_name', type: 'VARCHAR' }, { name: 'dept_id', type: 'INT', fk: true },
    ]},
    { id: 'dim_department', name: 'dim_department', color: '#66BB6A', x: 630, y: 470, w: 160, columns: [
      { name: 'dept_id', type: 'SERIAL', pk: true }, { name: 'dept_name', type: 'VARCHAR' },
    ]},
  ];
  const SNOWFLAKE_EDGES: ERDEdge[] = [
    { from: 'dim_date', to: 'fact_sales', label: 'date_id' },
    { from: 'dim_month', to: 'dim_date' },
    { from: 'dim_quarter', to: 'dim_month' },
    { from: 'dim_client', to: 'fact_sales', label: 'client_id' },
    { from: 'dim_city', to: 'dim_client' },
    { from: 'dim_region', to: 'dim_city' },
    { from: 'dim_product', to: 'fact_sales', label: 'product_id' },
    { from: 'dim_category', to: 'dim_product' },
    { from: 'dim_manager', to: 'fact_sales', label: 'manager_id' },
    { from: 'dim_department', to: 'dim_manager' },
  ];

  const DV_NODES: ERDNode[] = [
    { id: 'hub_client', name: 'hub_client', color: '#7B1FA2', x: 30, y: 20, w: 160, columns: [
      { name: 'hub_client_hk', type: 'HASH', pk: true }, { name: 'client_bk', type: 'VARCHAR' }, { name: 'load_dts', type: 'TIMESTAMP' }, { name: 'rec_src', type: 'VARCHAR' },
    ]},
    { id: 'hub_product', name: 'hub_product', color: '#7B1FA2', x: 230, y: 20, w: 160, columns: [
      { name: 'hub_product_hk', type: 'HASH', pk: true }, { name: 'product_bk', type: 'VARCHAR' }, { name: 'load_dts', type: 'TIMESTAMP' }, { name: 'rec_src', type: 'VARCHAR' },
    ]},
    { id: 'hub_manager', name: 'hub_manager', color: '#7B1FA2', x: 530, y: 20, w: 170, columns: [
      { name: 'hub_manager_hk', type: 'HASH', pk: true }, { name: 'manager_bk', type: 'VARCHAR' }, { name: 'load_dts', type: 'TIMESTAMP' }, { name: 'rec_src', type: 'VARCHAR' },
    ]},
    { id: 'hub_region', name: 'hub_region', color: '#7B1FA2', x: 740, y: 20, w: 160, columns: [
      { name: 'hub_region_hk', type: 'HASH', pk: true }, { name: 'region_bk', type: 'VARCHAR' }, { name: 'load_dts', type: 'TIMESTAMP' }, { name: 'rec_src', type: 'VARCHAR' },
    ]},
    { id: 'link_sale', name: 'link_sale', color: '#F57C00', x: 310, y: 210, w: 200, columns: [
      { name: 'link_sale_hk', type: 'HASH', pk: true }, { name: 'hub_client_hk', type: 'HASH', fk: true }, { name: 'hub_product_hk', type: 'HASH', fk: true },
      { name: 'hub_manager_hk', type: 'HASH', fk: true }, { name: 'hub_region_hk', type: 'HASH', fk: true }, { name: 'load_dts', type: 'TIMESTAMP' }, { name: 'rec_src', type: 'VARCHAR' },
    ]},
    { id: 'sat_client', name: 'sat_client', color: '#0288D1', x: 20, y: 390, w: 180, columns: [
      { name: 'hub_client_hk', type: 'HASH', fk: true }, { name: 'load_dts', type: 'TIMESTAMP', pk: true }, { name: 'client_name', type: 'VARCHAR' }, { name: 'segment', type: 'VARCHAR' }, { name: 'hashdiff', type: 'HASH' },
    ]},
    { id: 'sat_sale', name: 'sat_sale', color: '#0288D1', x: 230, y: 420, w: 180, columns: [
      { name: 'link_sale_hk', type: 'HASH', fk: true }, { name: 'load_dts', type: 'TIMESTAMP', pk: true }, { name: 'quantity', type: 'INT' }, { name: 'amount', type: 'DECIMAL' }, { name: 'hashdiff', type: 'HASH' },
    ]},
    { id: 'sat_product', name: 'sat_product', color: '#0288D1', x: 510, y: 420, w: 180, columns: [
      { name: 'hub_product_hk', type: 'HASH', fk: true }, { name: 'load_dts', type: 'TIMESTAMP', pk: true }, { name: 'product_name', type: 'VARCHAR' }, { name: 'category', type: 'VARCHAR' }, { name: 'hashdiff', type: 'HASH' },
    ]},
    { id: 'sat_manager', name: 'sat_manager', color: '#0288D1', x: 730, y: 370, w: 170, columns: [
      { name: 'hub_manager_hk', type: 'HASH', fk: true }, { name: 'load_dts', type: 'TIMESTAMP', pk: true }, { name: 'manager_name', type: 'VARCHAR' }, { name: 'department', type: 'VARCHAR' }, { name: 'hashdiff', type: 'HASH' },
    ]},
  ];
  const DV_EDGES: ERDEdge[] = [
    { from: 'hub_client', to: 'link_sale', label: 'client' },
    { from: 'hub_product', to: 'link_sale', label: 'product' },
    { from: 'hub_manager', to: 'link_sale', label: 'manager' },
    { from: 'hub_region', to: 'link_sale', label: 'region' },
    { from: 'link_sale', to: 'sat_sale' },
    { from: 'link_sale', to: 'sat_product' },
    { from: 'hub_client', to: 'sat_client' },
    { from: 'hub_manager', to: 'sat_manager' },
  ];

  const transactionTables = detailTables.filter(t => t.type === 'transaction');
  const referenceTables = detailTables.filter(t => t.type === 'reference');
  const distinctSources = Array.from(new Set(detailTables.map(t => t.source.split(' → ')[0])));
  const hasRegionHierarchy = detailTables.some(t => t.columns.some(c => c.name === 'federal_district'));
  const hasProductHierarchy = detailTables.some(t => t.columns.some(c => c.name === 'product_category'));
  const hasClientSegmentation = detailTables.some(t => t.columns.some(c => c.name === 'segment' || c.name === 'client_type'));

  const getFallbackComparison = (modelId: 'no_model' | 'star' | 'snowflake' | 'datavault'): ModelAdviceOption => {
    const hierarchyNotes = [
      hasRegionHierarchy ? 'регионов и федеральных округов' : '',
      hasProductHierarchy ? 'товаров и категорий' : '',
      hasClientSegmentation ? 'клиентов по типам и сегментам' : '',
    ].filter(Boolean);

    if (modelId === 'no_model') {
      return {
        id: 'no_model',
        label: 'Без модели данных',
        description: 'Работа напрямую по исходным таблицам без detail layer и ERD.',
        fit_score: detailTables.length > 0 ? 48 : 70,
        fit_label: detailTables.length > 0 ? 'medium' : 'high',
        summary: detailTables.length > 0
          ? 'Можно идти без модели только если нужен быстрый разовый дашборд без повторного использования семантики.'
          : 'Для компактного датасета можно остаться на исходных таблицах и не строить detail layer.',
        rationale: [
          'Минимальный time-to-dashboard: без дополнительного слоя и ручного проектирования.',
          'Подходит для пилота, короткого анализа и узкого набора визуализаций.',
        ],
        tradeoffs: ['С ростом числа источников и KPI появится дрейф семантики и сложнее сопровождение.'],
        needs_detail_layer: false,
        recommended: false,
        sql_evidence_ids: [],
      };
    }

    if (modelId === 'star') {
      return {
        id: 'star',
        label: 'Звезда',
        description: 'Одна факт-таблица и денормализованные измерения для BI и дашбордов.',
        fit_score: 78,
        fit_label: 'high',
        summary: `${transactionTables.length === 1 ? 'Один поток заявок' : `${transactionTables.length} потока данных`} и ${referenceTables.length} справочника — звезда даёт прямой путь к витрине доступа без лишних JOIN.`,
        rationale: [
          'Факт заявок связывается с подразделениями, организациями, типами доступа и стадиями.',
          hierarchyNotes.length > 0
            ? `Иерархии ${hierarchyNotes.join(', ')} можно оставить прямо в измерениях.`
            : 'Для текущего демо отдельная нормализация не обязательна.',
        ],
        tradeoffs: ['Часть атрибутов будет храниться шире, чем в полностью нормализованной схеме.'],
        needs_detail_layer: true,
        recommended: false,
        sql_evidence_ids: [],
      };
    }

    if (modelId === 'snowflake') {
      return {
        id: 'snowflake',
        label: 'Снежинка',
        description: 'Нормализованные измерения и отдельные иерархические справочники.',
        fit_score: 56,
        fit_label: 'medium',
        summary: 'Полезна, если нужно отдельно управлять оргструктурой, категориями организаций и правилами доступа.',
        rationale: [
          hierarchyNotes.length > 0
            ? `Иерархии ${hierarchyNotes.join(', ')} выносятся в отдельные таблицы.`
            : 'Выгода ограничена, если справочники не будут активно развиваться.',
          'Цена — более тяжёлые JOIN и менее прозрачная модель для демо-показа.',
        ],
        tradeoffs: ['Усложняет запросы и удлиняет путь до дашборда.'],
        needs_detail_layer: true,
        recommended: false,
        sql_evidence_ids: [],
      };
    }

    return {
      id: 'datavault',
      label: 'Data Vault',
      description: 'Хабы, линки и сателлиты для lineage, историзации и сложной интеграции.',
      fit_score: 24,
      fit_label: 'low',
      summary: `${distinctSources.length} источника и единый поток заявок — Data Vault пригодится скорее для enterprise-истории и строгой трассировки.`,
      rationale: [
        'Хорошо переживает рост числа источников и изменения структуры правил доступа.',
        'Сначала хабы, линки и сателлиты, а уже затем витрина и пользовательская аналитика.',
      ],
      tradeoffs: ['Для текущего сценария слишком тяжёлый слой и дополнительные витрины сверху обязательны.'],
      needs_detail_layer: true,
      recommended: false,
      sql_evidence_ids: [],
    };
  };

  const adviceById = new Map((modelAdvice?.options ?? []).map(option => [option.id, option]));
  const comparisons = MODEL_OPTIONS.map(model => ({
    model,
    advice: adviceById.get(model.id) ?? getFallbackComparison(model.id),
  }));

  const handleStartEditTable = (tableName: string, source: 'detail' | 'preview' = 'detail') => {
    const tables = source === 'preview' ? previewTables : detailTables;
    const table = tables.find(t => t.name === tableName);
    if (table) {
      setEditingTable(tableName);
      setEditColumns(table.columns.map((c: DetailColumn) => ({ ...c })));
      setExpandedTable(tableName);
      if (source === 'detail') setPetalStatus('detail', 'green');
    }
  };

  const handleSaveEditTable = (source: 'detail' | 'preview' = 'detail') => {
    if (source === 'preview' && editingTable) {
      setPreviewTables(prev => prev.map(t =>
        t.name === editingTable ? { ...t, columns: editColumns } : t
      ));
    }
    setEditingTable(null);
    setEditColumns([]);
  };

  const handleColumnChange = (idx: number, field: keyof DetailColumn, value: unknown) => {
    setEditColumns(prev => prev.map((col, i) => i === idx ? { ...col, [field]: value } : col));
  };

  const handleAddColumn = () => {
    setEditColumns(prev => [...prev, { name: 'new_column', dataType: 'VARCHAR(50)', isPK: false, isFK: false, nullable: true }]);
  };

  const handleDeleteColumn = (idx: number) => {
    setEditColumns(prev => prev.filter((_, i) => i !== idx));
  };

  // ============= SUB-STEP 1: Detail Layer =============
  const renderDetailStep = () => (
    <Fade in><Box>
      {selectedModelId === 'no_model' ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Detail layer не требуется</AlertTitle>
            Для выбранного сценария можно работать напрямую по исходным таблицам. Отдельный detail layer имеет смысл только если вы хотите стандартизировать повторное использование метрик и витрин.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {modelAdvice?.executive_summary ?? 'Детальный слой пропускается, потому что текущий датасет можно использовать напрямую для построения дашборда.'}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => goToPetalStep('model', 0)}>Назад к сравнению</Button>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => { setPetalStatus('model', 'green'); goToPetalStep('dashboard', 0); }}>
              Сразу к дашборду
            </Button>
          </Box>
        </Paper>
      ) : (
        <>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>Детальный слой</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Транзакционные таблицы и справочники, адаптированные под выбранную модель <strong>{MOCK_ERD_MODELS.find(m => m.id === selectedModelId)?.name}</strong>. Можно редактировать столбцы, типы, ключи и связи.
      </Typography>

      {buildingDetail && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <LinearProgress sx={{ mb: 2, mx: 'auto', maxWidth: 500 }} />
          <Typography variant="body1" color="text.secondary">Анализируем данные, выделяем сущности...</Typography>
        </Paper>
      )}

      {detailBuilt && (
        <>
          <Alert severity="success" sx={{ mb: 3 }}>
            <AlertTitle>Детальный слой спроектирован</AlertTitle>
            Выделены факт заявок и справочники по подразделениям, организациям, типам доступа и стадиям. Можно проверить состав полей и при необходимости отредактировать структуру.
          </Alert>

          {detailTables.map((table) => {
            const isEditing = editingTable === table.name;
            const displayColumns = isEditing ? editColumns : table.columns;

            return (
              <Card key={table.name} variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ pb: expandedTable === table.name ? 0 : undefined, '&:last-child': { pb: expandedTable === table.name ? 0 : 2 } }}>
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label={`${expandedTable === table.name ? 'Свернуть' : 'Развернуть'} таблицу ${table.name}`}
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 } }}
                    onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setExpandedTable(expandedTable === table.name ? null : table.name);
                      }
                    }}
                  >
                    <StorageIcon sx={{ mr: 2, color: table.type === 'transaction' ? 'error.main' : 'success.main' }} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{table.name}</Typography>
                        <Chip label={tableTypeLabel(table.type)} size="small" color={tableTypeColor(table.type) as any} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {displayColumns.length} столбцов &bull; {table.rowCount.toLocaleString()} строк &bull; Источник: {table.source}
                      </Typography>
                    </Box>
                    {!isEditing && (
                      <Tooltip title="Редактировать таблицу">
                        <IconButton size="small" aria-label={`Редактировать таблицу ${table.name}`} onClick={(e) => { e.stopPropagation(); handleStartEditTable(table.name); }} sx={{ mr: 1 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isEditing && (
                      <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }} onClick={(e) => e.stopPropagation()}>
                        <Button size="small" variant="outlined" onClick={() => { setEditingTable(null); setEditColumns([]); }} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                          Отмена
                        </Button>
                        <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />} onClick={() => handleSaveEditTable('detail')} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                          Сохранить
                        </Button>
                      </Box>
                    )}
                    {expandedTable === table.name ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Box>
                </CardContent>
                <Collapse in={expandedTable === table.name}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Столбец</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Тип</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>PK</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>FK</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>NULL</TableCell>
                          {isEditing && <TableCell sx={{ fontWeight: 700, textAlign: 'center', width: 48 }}></TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {displayColumns.map((col, colIdx) => (
                          <TableRow key={isEditing ? colIdx : col.name} hover>
                            <TableCell sx={{ p: isEditing ? 0.5 : undefined }}>
                              {isEditing ? (
                                <TextField
                                  size="small" variant="standard" value={col.name}
                                  onChange={(e) => handleColumnChange(colIdx, 'name', e.target.value)}
                                  sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.85rem', py: 0.25 } }}
                                />
                              ) : (
                                <Typography sx={{ fontFamily: 'monospace', fontWeight: col.isPK ? 700 : 400 }}>{col.name}</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ p: isEditing ? 0.5 : undefined }}>
                              {isEditing ? (
                                <Select
                                  size="small" variant="standard" value={col.dataType}
                                  onChange={(e) => handleColumnChange(colIdx, 'dataType', e.target.value)}
                                  sx={{ fontFamily: 'monospace', fontSize: '0.8rem', minWidth: 100 }}
                                >
                                  {DATA_TYPES.map(dt => <MenuItem key={dt} value={dt} sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{dt}</MenuItem>)}
                                </Select>
                              ) : (
                                <Typography sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.8rem' }}>{col.dataType}</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              {isEditing ? (
                                <Checkbox size="small" checked={col.isPK} onChange={(e) => handleColumnChange(colIdx, 'isPK', e.target.checked)} sx={{ p: 0 }} />
                              ) : (
                                col.isPK ? <Chip label="PK" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} /> : ''
                              )}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              {isEditing ? (
                                <Checkbox size="small" checked={col.isFK} onChange={(e) => handleColumnChange(colIdx, 'isFK', e.target.checked)} sx={{ p: 0 }} />
                              ) : (
                                col.isFK ? <Chip label="FK" size="small" color="warning" sx={{ fontSize: '0.65rem', height: 20 }} /> : ''
                              )}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              {isEditing ? (
                                <Checkbox size="small" checked={col.nullable} onChange={(e) => handleColumnChange(colIdx, 'nullable', e.target.checked)} sx={{ p: 0 }} />
                              ) : (
                                col.nullable ? <Typography variant="caption" color="text.disabled">NULL</Typography> : <Typography variant="caption" color="success.main">NOT NULL</Typography>
                              )}
                            </TableCell>
                            {isEditing && (
                              <TableCell sx={{ textAlign: 'center', p: 0.5 }}>
                                <IconButton size="small" aria-label={`Удалить колонку ${col.name}`} onClick={() => handleDeleteColumn(colIdx)} sx={{ color: 'error.main' }}>
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {isEditing && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Button size="small" startIcon={<AddIcon />} onClick={handleAddColumn} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>
                                Добавить столбец
                              </Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Card>
            );
          })}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => goToPetalStep('model', 0)}>Назад к модели</Button>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => { setPetalStatus('detail', 'green'); goToPetalStep('model', 1); }}>
              Посмотреть ERD
            </Button>
          </Box>
        </>
      )}
        </>
      )}
    </Box></Fade>
  );

  // ============= SUB-STEP 0: Model Selection =============
  const renderERDStep = () => {
    return (
      <Fade in><Box>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>Выбор модели данных</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Выберите подходящую схему для вашего датасета. Чтобы получить LLM-рекомендацию на основе SQL-профиля — запустите анализ.
        </Typography>

        {!modelAdvice && !modelAdviceLoading && (
          <Box sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              onClick={startAnalysis}
              disabled={!project || project.files.length === 0}
              startIcon={<StorageIcon />}
            >
              Проанализировать датасет
            </Button>
          </Box>
        )}

        {modelAdviceLoading && (
          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <LinearProgress sx={{ mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              Считаю SQL-профиль датасета и готовлю объяснение по вариантам модели...
            </Typography>
          </Paper>
        )}

        {modelAdvice && (
          <Alert severity={modelAdvice.recommended_option === 'no_model' ? 'info' : 'success'} sx={{ mb: 3 }}>
            <AlertTitle>
              Рекомендация: {comparisons.find(item => item.model.id === modelAdvice.recommended_option)?.model.name}
            </AlertTitle>
            <Typography variant="body2" sx={{ mb: 1.25 }}>{modelAdvice.executive_summary}</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`Таблиц: ${modelAdvice.dataset_profile.table_count}`} />
              <Chip size="small" label={`Строк: ${modelAdvice.dataset_profile.total_rows.toLocaleString('ru-RU')}`} />
              <Chip size="small" label={`Связей: ${modelAdvice.dataset_profile.relationship_count}`} />
              <Chip size="small" color={modelAdvice.need_data_model ? 'warning' : 'success'} label={modelAdvice.need_data_model ? 'Модель нужна' : 'Модель не обязательна'} />
              <Chip size="small" color={modelAdvice.need_detail_layer ? 'warning' : 'success'} label={modelAdvice.need_detail_layer ? 'Детальный слой нужен' : 'Детальный слой можно пропустить'} />
            </Box>
          </Alert>
        )}

        {modelAdviceError && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>Не удалось получить LLM-обоснование</AlertTitle>
            {modelAdviceError}
          </Alert>
        )}

        {/* Карточки выбора модели */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {comparisons.map(({ model, advice }) => (
            <Card key={model.id} variant="outlined" sx={{
              flex: 1,
              cursor: 'pointer',
              transition: 'all 0.2s',
              borderWidth: selectedModelId === model.id ? 2 : 1,
              borderColor: selectedModelId === model.id ? 'primary.main' : '#30363d',
              bgcolor: selectedModelId === model.id ? 'rgba(77,208,225,0.08)' : 'rgba(255,255,255,0.02)',
              '&:hover': { borderColor: 'primary.main', boxShadow: '0 0 0 1px rgba(77,208,225,0.2)' },
            }} onClick={() => { setSelectedERDModel(model.id); setPreviewTables([]); setExpandedTable(null); setEditingTable(null); setDetailLoading(false); }}>
              <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.9, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: selectedModelId === model.id ? '#4dd0e1' : '#e6edf3' }}>{model.name}</Typography>
                  {modelAdvice && advice.recommended && (
                    <Chip label="Рекомендуется" size="small" sx={{ bgcolor: 'rgba(63,185,80,0.15)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)', height: 20, fontSize: '0.68rem', fontWeight: 600 }} />
                  )}
                  {modelAdvice && (
                    <Chip
                      label={`${advice.fit_score}/100`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        bgcolor: advice.fit_label === 'high' ? 'rgba(63,185,80,0.15)' : advice.fit_label === 'medium' ? 'rgba(245,200,76,0.15)' : 'rgba(248,81,73,0.12)',
                        color: advice.fit_label === 'high' ? '#3fb950' : advice.fit_label === 'medium' ? '#f5c84c' : '#f85149',
                      }}
                    />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {modelAdvice ? (advice.summary || model.description) : model.description}
                </Typography>
                {selectedModelId === model.id && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }}>
                    <Chip label="Выбрано" size="small" sx={{ bgcolor: 'rgba(77,208,225,0.15)', color: '#4dd0e1', border: '1px solid rgba(77,208,225,0.3)', height: 20, fontSize: '0.7rem' }} />
                    {!detailLoading && model.id !== 'no_model' && previewTables.length === 0 && (
                      <Button
                        size="small"
                        variant="contained"
                        sx={{ height: 22, fontSize: '0.7rem', py: 0, textTransform: 'none' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailLoading(true);
                          setTimeout(() => {
                            const generatedTables = generateDetailTables(project?.files ?? [], model.id);
                            if (generatedTables.length > 0) {
                              setPreviewTables(generatedTables);
                              setDetailLoading(false);
                              return;
                            }

                            // For real uploaded datasets, the demo-only generator can return
                            // an empty preview. Build detail layer from backend but stay on
                            // the current "Выбор модели данных" screen.
                            setDetailLoading(false);
                            buildDetailLayer();
                          }, 700);
                        }}
                      >
                        Посмотреть слой
                      </Button>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Таблица сравнения — только после анализа */}
        {modelAdvice && <Paper variant="outlined" sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2, pb: 1.5 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.8 }}>Сравнение по данным</Typography>
            <FormControlLabel
              sx={{ mr: 0 }}
              control={<Switch size="small" checked={compareWithData} onChange={(e) => setCompareWithData(e.target.checked)} />}
              label={<Typography variant="caption" color="text.secondary">Показать</Typography>}
            />
          </Box>

          <Collapse in={compareWithData}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 100, fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem' }} />
                    {comparisons.map(({ model }) => (
                      <TableCell key={model.id} sx={{
                        borderLeft: selectedModelId === model.id ? '2px solid' : undefined,
                        borderLeftColor: 'primary.main',
                      }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: selectedModelId === model.id ? 'primary.main' : 'text.primary' }}>
                          {model.name}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600, verticalAlign: 'top' }}>Fit</TableCell>
                    {comparisons.map(({ model, advice }) => (
                      <TableCell key={model.id} sx={{ verticalAlign: 'top', borderLeft: selectedModelId === model.id ? '2px solid' : undefined, borderLeftColor: 'primary.main' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: selectedModelId === model.id ? 'primary.main' : 'text.primary', mb: 0.5 }}>
                          {advice.fit_score}/100 · {advice.fit_label === 'high' ? 'сильное совпадение' : advice.fit_label === 'medium' ? 'условно подходит' : 'скорее избыточно'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                          {advice.summary}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600, verticalAlign: 'top' }}>Detail layer</TableCell>
                    {comparisons.map(({ model, advice }) => (
                      <TableCell key={model.id} sx={{ verticalAlign: 'top', borderLeft: selectedModelId === model.id ? '2px solid' : undefined, borderLeftColor: 'primary.main' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                          {advice.needs_detail_layer ? 'Да, нужен отдельный detail layer.' : 'Нет, можно работать по исходным таблицам.'}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600, verticalAlign: 'top' }}>Обоснование</TableCell>
                    {comparisons.map(({ model, advice }) => (
                      <TableCell key={model.id} sx={{ verticalAlign: 'top', borderLeft: selectedModelId === model.id ? '2px solid' : undefined, borderLeftColor: 'primary.main' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {advice.rationale.map((point) => (
                            <Typography key={point} variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                              • {point}
                            </Typography>
                          ))}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600, verticalAlign: 'top' }}>Компромиссы</TableCell>
                    {comparisons.map(({ model, advice }) => (
                      <TableCell key={model.id} sx={{ verticalAlign: 'top', borderLeft: selectedModelId === model.id ? '2px solid' : undefined, borderLeftColor: 'primary.main' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {advice.tradeoffs.map((point) => (
                            <Typography key={point} variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                              • {point}
                            </Typography>
                          ))}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                  {/* Удалена строка SQL evidence по дизайн-ревью */}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>
        </Paper>}


        {/* Детальный слой под выбранную модель */}
        {(selectedModelId !== 'no_model' && (detailLoading || previewTables.length > 0)) && (
        <Paper variant="outlined" sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ px: 3, pt: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 0.8 }}>Детальный слой</Typography>
            {!detailLoading && <Chip label={`${previewTables.length} таблиц`} size="small" sx={{ height: 18, fontSize: '0.68rem' }} />}
          </Box>
          {detailLoading && (
            <Box sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={40} thickness={3} />
              <Typography variant="body2" color="text.secondary">Формируем детальный слой...</Typography>
            </Box>
          )}
          {!detailLoading && previewTables.map((table) => {
            const isEditing = editingTable === table.name;
            const displayColumns = isEditing ? editColumns : table.columns;
            return (
              <Card key={table.name} variant="outlined" sx={{ mb: 0, borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ pb: expandedTable === table.name ? 0 : undefined, '&:last-child': { pb: expandedTable === table.name ? 0 : 2 } }}>
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label={`${expandedTable === table.name ? 'Свернуть' : 'Развернуть'} таблицу ${table.name}`}
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', '&:focus-visible': { outline: '2px solid var(--app-accent)', outlineOffset: 2 } }}
                    onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setExpandedTable(expandedTable === table.name ? null : table.name);
                      }
                    }}
                  >
                    <StorageIcon sx={{ mr: 2, color: table.type === 'transaction' ? 'error.main' : 'success.main' }} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{table.name}</Typography>
                        <Chip label={tableTypeLabel(table.type)} size="small" color={tableTypeColor(table.type) as any} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {displayColumns.length} столбцов &bull; {table.rowCount.toLocaleString()} строк &bull; {table.source}
                      </Typography>
                    </Box>
                    {!isEditing && (
                      <Tooltip title="Редактировать таблицу">
                        <IconButton size="small" aria-label={`Редактировать таблицу ${table.name}`} onClick={(e) => { e.stopPropagation(); handleStartEditTable(table.name, 'preview'); }} sx={{ mr: 1 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isEditing && (
                      <Box sx={{ display: 'flex', gap: 0.5, mr: 1 }} onClick={(e) => e.stopPropagation()}>
                        <Button size="small" variant="outlined" onClick={() => { setEditingTable(null); setEditColumns([]); }} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>Отмена</Button>
                        <Button size="small" variant="contained" color="success" startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />} onClick={() => handleSaveEditTable('preview')} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>Сохранить</Button>
                      </Box>
                    )}
                    {expandedTable === table.name ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </Box>
                </CardContent>
                <Collapse in={expandedTable === table.name}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Столбец</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Тип</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>PK</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>FK</TableCell>
                          <TableCell sx={{ fontWeight: 700, textAlign: 'center' }}>NULL</TableCell>
                          {isEditing && <TableCell sx={{ fontWeight: 700, textAlign: 'center', width: 48 }} />}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {displayColumns.map((col, colIdx) => (
                          <TableRow key={isEditing ? colIdx : col.name} hover>
                            <TableCell sx={{ p: isEditing ? 0.5 : undefined }}>
                              {isEditing ? (
                                <TextField size="small" variant="standard" value={col.name} onChange={(e) => handleColumnChange(colIdx, 'name', e.target.value)} sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.85rem', py: 0.25 } }} />
                              ) : (
                                <Typography sx={{ fontFamily: 'monospace', fontWeight: col.isPK ? 700 : 400 }}>{col.name}</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ p: isEditing ? 0.5 : undefined }}>
                              {isEditing ? (
                                <Select size="small" variant="standard" value={col.dataType} onChange={(e) => handleColumnChange(colIdx, 'dataType', e.target.value)} sx={{ fontFamily: 'monospace', fontSize: '0.8rem', minWidth: 100 }}>
                                  {DATA_TYPES.map(dt => <MenuItem key={dt} value={dt} sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{dt}</MenuItem>)}
                                </Select>
                              ) : (
                                <Typography sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.8rem' }}>{col.dataType}</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              {isEditing ? <Checkbox size="small" checked={col.isPK} onChange={(e) => handleColumnChange(colIdx, 'isPK', e.target.checked)} sx={{ p: 0 }} /> : col.isPK ? <Chip label="PK" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 20 }} /> : ''}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              {isEditing ? <Checkbox size="small" checked={col.isFK} onChange={(e) => handleColumnChange(colIdx, 'isFK', e.target.checked)} sx={{ p: 0 }} /> : col.isFK ? <Chip label="FK" size="small" color="warning" sx={{ fontSize: '0.65rem', height: 20 }} /> : ''}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              {isEditing ? <Checkbox size="small" checked={col.nullable} onChange={(e) => handleColumnChange(colIdx, 'nullable', e.target.checked)} sx={{ p: 0 }} /> : col.nullable ? <Typography variant="caption" color="text.disabled">NULL</Typography> : <Typography variant="caption" color="success.main">NOT NULL</Typography>}
                            </TableCell>
                            {isEditing && (
                              <TableCell sx={{ textAlign: 'center', p: 0.5 }}>
                                <IconButton size="small" aria-label={`Удалить колонку ${col.name}`} onClick={() => handleDeleteColumn(colIdx)} sx={{ color: 'error.main' }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {isEditing && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Button size="small" startIcon={<AddIcon />} onClick={handleAddColumn} sx={{ textTransform: 'none', fontSize: '0.8rem' }}>Добавить столбец</Button>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Card>
            );
          })}
        </Paper>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => goToPetalStep('data', 0)}>Назад к данным</Button>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              setPetalStatus('model', 'green');
              if (selectedModelId === 'no_model') {
                goToPetalStep('dashboard', 0);
                return;
              }
              setPetalStatus('detail', 'green');
              goToPetalStep('model', 1);
            }}
          >
            {selectedModelId === 'no_model' ? 'Продолжить без модели' : 'К детальному слою'}
          </Button>
        </Box>
      </Box></Fade>
    );
  };

  const renderERDResultStep = () => {
    if (selectedModelId === 'no_model') {
      return (
        <Fade in><Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>ERD пропущена</AlertTitle>
            Для выбранного варианта отдельная ERD-схема не требуется: дашборд строится напрямую по исходным таблицам.
          </Alert>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => goToPetalStep('model', 0)}>Назад к сравнению</Button>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => goToPetalStep('dashboard', 0)}>
              Дашборд
            </Button>
          </Box>
        </Box></Fade>
      );
    }

    const selected = MOCK_ERD_MODELS.find(m => m.id === selectedModelId)!;
    const actualERD = buildActualERD(detailTables, project?.erdRelationships);
    return (
      <Fade in><Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>Модель данных (ERD)</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`${detailTables.length} таблиц`} size="small" />
              <Chip label="Схема готова" size="small" color="success" variant="outlined" />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<DownloadIcon />}>Скачать DDL</Button>
            <Button variant="outlined" startIcon={<CodeIcon />}>Показать DDL</Button>
            <Button variant="outlined" startIcon={<DownloadIcon />}>Экспорт ERD</Button>
          </Box>
        </Box>

        <Box
          sx={{
            mb: 3,
            minHeight: { xs: 420, md: 520 },
            borderRadius: 2,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 0, md: 1 },
            py: { xs: 0.5, md: 1 },
          }}
        >
          <InteractiveERD
            initialNodes={actualERD.nodes.length > 0 ? actualERD.nodes : selected.id === 'star' ? STAR_NODES : selected.id === 'snowflake' ? SNOWFLAKE_NODES : DV_NODES}
            edges={actualERD.edges.length > 0 ? actualERD.edges : selected.id === 'star' ? STAR_EDGES : selected.id === 'snowflake' ? SNOWFLAKE_EDGES : DV_EDGES}
            title={`${selected.name} · по актуальному датасету`}
            viewBoxHeight={selected.id === 'snowflake' ? 560 : 520}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => goToPetalStep('detail', 0)}>Детальный слой</Button>
          <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => { setPetalStatus('model', 'green'); goToPetalStep('dashboard', 0); }}>
            Дашборд
          </Button>
        </Box>
      </Box></Fade>
    );
  };

  return (
    <Box sx={{ pl: 4 }}>
      {activeSubStep === 0 && renderERDStep()}
      {activeSubStep === 1 && renderDetailStep()}
      {activeSubStep === 2 && renderERDResultStep()}
    </Box>
  );
};

export default ModelPage;

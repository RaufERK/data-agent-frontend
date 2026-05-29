import React from 'react';
import { Box } from '@mui/material';

const svgWrap = (children: React.ReactNode, width = 920, height = 520) => (
  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'auto', py: 2, px: 2 }}>
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', maxWidth: 1180, minWidth: 860, display: 'block', margin: '0 auto' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto" fill="#7d8590">
          <polygon points="0 0, 8 3, 0 6" />
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.28" />
        </filter>
      </defs>
      {children}
    </svg>
  </Box>
);

/* ===================== table helper ===================== */
const ERDTable: React.FC<{
  x: number; y: number; w: number; name: string; color: string;
  columns: { name: string; type: string; pk?: boolean; fk?: boolean }[];
}> = ({ x, y, w, name, color, columns }) => {
  const rowH = 22;
  const headerH = 30;
  const h = headerH + columns.length * rowH + 4;
  return (
    <g filter="url(#shadow)">
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#0f1722" stroke={color} strokeWidth={2} />
      <rect x={x} y={y} width={w} height={headerH} rx={10} fill={color} />
      <rect x={x} y={y + headerH - 6} width={w} height={6} fill={color} />
      <text x={x + w / 2} y={y + 20} textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="12" fontFamily="monospace">{name}</text>
      {columns.map((col, i) => (
        <g key={col.name}>
          <text x={x + 8} y={y + headerH + 16 + i * rowH} fontSize="11" fontFamily="monospace" fill="#e6edf3">
            {col.pk ? 'PK ' : col.fk ? 'FK ' : ''}{col.name}
          </text>
          <text x={x + w - 8} y={y + headerH + 16 + i * rowH} textAnchor="end" fontSize="10" fontFamily="monospace" fill="#8b949e">
            {col.type}
          </text>
        </g>
      ))}
    </g>
  );
};

const Relation: React.FC<{ x1: number; y1: number; x2: number; y2: number; label?: string }> = ({ x1, y1, x2, y2, label }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7d8590" strokeWidth={1.5} markerEnd="url(#arrow)" />
    {label && (
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="9" fill="#9da7b3" fontFamily="sans-serif">{label}</text>
    )}
  </g>
);

/* ===================== STAR SCHEMA ===================== */
export const ERDStarDiagram: React.FC = () => svgWrap(
  <>
    {/* fact_sales — center */}
    <ERDTable x={340} y={160} w={220} name="fact_sales" color="#e53935"
      columns={[
        { name: 'sale_id', type: 'SERIAL', pk: true },
        { name: 'date_id', type: 'INT', fk: true },
        { name: 'client_id', type: 'INT', fk: true },
        { name: 'product_id', type: 'INT', fk: true },
        { name: 'manager_id', type: 'INT', fk: true },
        { name: 'region_id', type: 'INT', fk: true },
        { name: 'quantity', type: 'INT' },
        { name: 'amount', type: 'DECIMAL' },
        { name: 'discount', type: 'DECIMAL' },
      ]}
    />
    {/* dim_date — top */}
    <ERDTable x={60} y={10} w={180} name="dim_date" color="#43A047"
      columns={[
        { name: 'date_id', type: 'SERIAL', pk: true },
        { name: 'full_date', type: 'DATE' },
        { name: 'year', type: 'INT' },
        { name: 'quarter', type: 'INT' },
        { name: 'month', type: 'INT' },
      ]}
    />
    {/* dim_client — top right */}
    <ERDTable x={680} y={10} w={200} name="dim_client" color="#43A047"
      columns={[
        { name: 'client_id', type: 'SERIAL', pk: true },
        { name: 'client_name', type: 'VARCHAR' },
        { name: 'segment', type: 'VARCHAR' },
        { name: 'city', type: 'VARCHAR' },
        { name: 'region', type: 'VARCHAR' },
      ]}
    />
    {/* dim_product — bottom left */}
    <ERDTable x={30} y={360} w={200} name="dim_product" color="#43A047"
      columns={[
        { name: 'product_id', type: 'SERIAL', pk: true },
        { name: 'product_name', type: 'VARCHAR' },
        { name: 'category', type: 'VARCHAR' },
        { name: 'subcategory', type: 'VARCHAR' },
        { name: 'brand', type: 'VARCHAR' },
      ]}
    />
    {/* dim_manager — bottom center */}
    <ERDTable x={360} y={430} w={180} name="dim_manager" color="#43A047"
      columns={[
        { name: 'manager_id', type: 'SERIAL', pk: true },
        { name: 'manager_name', type: 'VARCHAR' },
        { name: 'department', type: 'VARCHAR' },
      ]}
    />
    {/* dim_region — bottom right */}
    <ERDTable x={680} y={340} w={200} name="dim_region" color="#43A047"
      columns={[
        { name: 'region_id', type: 'SERIAL', pk: true },
        { name: 'region_name', type: 'VARCHAR' },
        { name: 'federal_district', type: 'VARCHAR' },
        { name: 'country', type: 'VARCHAR' },
      ]}
    />
    {/* relations */}
    <Relation x1={240} y1={120} x2={340} y2={200} label="date_id" />
    <Relation x1={680} y1={120} x2={560} y2={200} label="client_id" />
    <Relation x1={230} y1={380} x2={340} y2={340} label="product_id" />
    <Relation x1={450} y1={430} x2={450} y2={380} label="manager_id" />
    <Relation x1={680} y1={380} x2={560} y2={320} label="region_id" />
    {/* label */}
    <text x={460} y={510} textAnchor="middle" fontSize="14" fill="#9da7b3" fontWeight="bold">Звезда (Star Schema)</text>
  </>
);

/* ===================== SNOWFLAKE SCHEMA ===================== */
export const ERDSnowflakeDiagram: React.FC = () => svgWrap(
  <>
    {/* fact_sales — center */}
    <ERDTable x={360} y={170} w={200} name="fact_sales" color="#e53935"
      columns={[
        { name: 'sale_id', type: 'SERIAL', pk: true },
        { name: 'date_id', type: 'INT', fk: true },
        { name: 'client_id', type: 'INT', fk: true },
        { name: 'product_id', type: 'INT', fk: true },
        { name: 'manager_id', type: 'INT', fk: true },
        { name: 'quantity', type: 'INT' },
        { name: 'amount', type: 'DECIMAL' },
      ]}
    />
    {/* dim_date normalized */}
    <ERDTable x={40} y={10} w={160} name="dim_date" color="#43A047"
      columns={[
        { name: 'date_id', type: 'SERIAL', pk: true },
        { name: 'full_date', type: 'DATE' },
        { name: 'month_id', type: 'INT', fk: true },
      ]}
    />
    <ERDTable x={40} y={110} w={140} name="dim_month" color="#66BB6A"
      columns={[
        { name: 'month_id', type: 'SERIAL', pk: true },
        { name: 'quarter_id', type: 'INT', fk: true },
        { name: 'month_name', type: 'VARCHAR' },
      ]}
    />
    <ERDTable x={40} y={210} w={140} name="dim_quarter" color="#81C784"
      columns={[
        { name: 'quarter_id', type: 'SERIAL', pk: true },
        { name: 'year', type: 'INT' },
        { name: 'quarter_num', type: 'INT' },
      ]}
    />
    {/* dim_client → dim_city → dim_region */}
    <ERDTable x={650} y={10} w={170} name="dim_client" color="#43A047"
      columns={[
        { name: 'client_id', type: 'SERIAL', pk: true },
        { name: 'client_name', type: 'VARCHAR' },
        { name: 'segment', type: 'VARCHAR' },
        { name: 'city_id', type: 'INT', fk: true },
      ]}
    />
    <ERDTable x={680} y={130} w={160} name="dim_city" color="#66BB6A"
      columns={[
        { name: 'city_id', type: 'SERIAL', pk: true },
        { name: 'city_name', type: 'VARCHAR' },
        { name: 'region_id', type: 'INT', fk: true },
      ]}
    />
    <ERDTable x={680} y={240} w={160} name="dim_region" color="#81C784"
      columns={[
        { name: 'region_id', type: 'SERIAL', pk: true },
        { name: 'region_name', type: 'VARCHAR' },
        { name: 'district', type: 'VARCHAR' },
      ]}
    />
    {/* dim_product → dim_category */}
    <ERDTable x={100} y={360} w={180} name="dim_product" color="#43A047"
      columns={[
        { name: 'product_id', type: 'SERIAL', pk: true },
        { name: 'product_name', type: 'VARCHAR' },
        { name: 'category_id', type: 'INT', fk: true },
      ]}
    />
    <ERDTable x={30} y={460} w={160} name="dim_category" color="#66BB6A"
      columns={[
        { name: 'category_id', type: 'SERIAL', pk: true },
        { name: 'category_name', type: 'VARCHAR' },
        { name: 'department', type: 'VARCHAR' },
      ]}
    />
    {/* dim_manager */}
    <ERDTable x={600} y={380} w={180} name="dim_manager" color="#43A047"
      columns={[
        { name: 'manager_id', type: 'SERIAL', pk: true },
        { name: 'manager_name', type: 'VARCHAR' },
        { name: 'dept_id', type: 'INT', fk: true },
      ]}
    />
    <ERDTable x={630} y={470} w={160} name="dim_department" color="#66BB6A"
      columns={[
        { name: 'dept_id', type: 'SERIAL', pk: true },
        { name: 'dept_name', type: 'VARCHAR' },
      ]}
    />
    {/* relations */}
    <Relation x1={200} y1={60} x2={360} y2={210} label="date_id" />
    <Relation x1={120} y1={108} x2={120} y2={110} />
    <Relation x1={110} y1={192} x2={110} y2={210} />
    <Relation x1={650} y1={60} x2={560} y2={210} label="client_id" />
    <Relation x1={730} y1={108} x2={730} y2={130} />
    <Relation x1={740} y1={218} x2={740} y2={240} />
    <Relation x1={280} y1={380} x2={360} y2={310} label="product_id" />
    <Relation x1={140} y1={448} x2={140} y2={460} />
    <Relation x1={600} y1={400} x2={560} y2={320} label="manager_id" />
    <Relation x1={690} y1={456} x2={690} y2={470} />
    {/* label */}
    <text x={460} y={510} textAnchor="middle" fontSize="14" fill="#9da7b3" fontWeight="bold">Снежинка (Snowflake Schema)</text>
  </>,
  920, 530
);

/* ===================== DATA VAULT SCHEMA ===================== */
export const ERDDataVaultDiagram: React.FC = () => svgWrap(
  <>
    {/* HUBS — top row */}
    <ERDTable x={30} y={20} w={160} name="hub_client" color="#7B1FA2"
      columns={[
        { name: 'hub_client_hk', type: 'HASH', pk: true },
        { name: 'client_bk', type: 'VARCHAR' },
        { name: 'load_dts', type: 'TIMESTAMP' },
        { name: 'rec_src', type: 'VARCHAR' },
      ]}
    />
    <ERDTable x={230} y={20} w={160} name="hub_product" color="#7B1FA2"
      columns={[
        { name: 'hub_product_hk', type: 'HASH', pk: true },
        { name: 'product_bk', type: 'VARCHAR' },
        { name: 'load_dts', type: 'TIMESTAMP' },
        { name: 'rec_src', type: 'VARCHAR' },
      ]}
    />
    <ERDTable x={530} y={20} w={170} name="hub_manager" color="#7B1FA2"
      columns={[
        { name: 'hub_manager_hk', type: 'HASH', pk: true },
        { name: 'manager_bk', type: 'VARCHAR' },
        { name: 'load_dts', type: 'TIMESTAMP' },
        { name: 'rec_src', type: 'VARCHAR' },
      ]}
    />
    <ERDTable x={740} y={20} w={160} name="hub_region" color="#7B1FA2"
      columns={[
        { name: 'hub_region_hk', type: 'HASH', pk: true },
        { name: 'region_bk', type: 'VARCHAR' },
        { name: 'load_dts', type: 'TIMESTAMP' },
        { name: 'rec_src', type: 'VARCHAR' },
      ]}
    />
    {/* LINK — center */}
    <ERDTable x={310} y={210} w={200} name="link_sale" color="#F57C00"
      columns={[
        { name: 'link_sale_hk', type: 'HASH', pk: true },
        { name: 'hub_client_hk', type: 'HASH', fk: true },
        { name: 'hub_product_hk', type: 'HASH', fk: true },
        { name: 'hub_manager_hk', type: 'HASH', fk: true },
        { name: 'hub_region_hk', type: 'HASH', fk: true },
        { name: 'load_dts', type: 'TIMESTAMP' },
        { name: 'rec_src', type: 'VARCHAR' },
      ]}
    />
    {/* SATELLITES — bottom */}
    <ERDTable x={20} y={390} w={180} name="sat_client" color="#0288D1"
      columns={[
        { name: 'hub_client_hk', type: 'HASH', fk: true },
        { name: 'load_dts', type: 'TIMESTAMP', pk: true },
        { name: 'client_name', type: 'VARCHAR' },
        { name: 'segment', type: 'VARCHAR' },
        { name: 'hashdiff', type: 'HASH' },
      ]}
    />
    <ERDTable x={230} y={420} w={180} name="sat_sale" color="#0288D1"
      columns={[
        { name: 'link_sale_hk', type: 'HASH', fk: true },
        { name: 'load_dts', type: 'TIMESTAMP', pk: true },
        { name: 'quantity', type: 'INT' },
        { name: 'amount', type: 'DECIMAL' },
        { name: 'hashdiff', type: 'HASH' },
      ]}
    />
    <ERDTable x={510} y={420} w={180} name="sat_product" color="#0288D1"
      columns={[
        { name: 'hub_product_hk', type: 'HASH', fk: true },
        { name: 'load_dts', type: 'TIMESTAMP', pk: true },
        { name: 'product_name', type: 'VARCHAR' },
        { name: 'category', type: 'VARCHAR' },
        { name: 'hashdiff', type: 'HASH' },
      ]}
    />
    <ERDTable x={730} y={370} w={170} name="sat_manager" color="#0288D1"
      columns={[
        { name: 'hub_manager_hk', type: 'HASH', fk: true },
        { name: 'load_dts', type: 'TIMESTAMP', pk: true },
        { name: 'manager_name', type: 'VARCHAR' },
        { name: 'department', type: 'VARCHAR' },
        { name: 'hashdiff', type: 'HASH' },
      ]}
    />
    {/* RELATIONS: hubs → link */}
    <Relation x1={110} y1={130} x2={310} y2={250} label="client" />
    <Relation x1={310} y1={130} x2={360} y2={210} label="product" />
    <Relation x1={615} y1={130} x2={510} y2={250} label="manager" />
    <Relation x1={820} y1={130} x2={510} y2={230} label="region" />
    {/* RELATIONS: link → sats */}
    <Relation x1={360} y1={370} x2={310} y2={420} label="" />
    <Relation x1={440} y1={370} x2={510} y2={420} label="" />
    {/* hubs → sats */}
    <Relation x1={80} y1={130} x2={80} y2={390} label="" />
    <Relation x1={615} y1={130} x2={815} y2={370} label="" />
    {/* label */}
    <text x={460} y={510} textAnchor="middle" fontSize="14" fill="#9da7b3" fontWeight="bold">Data Vault 2.0</text>
  </>,
  920, 530
);

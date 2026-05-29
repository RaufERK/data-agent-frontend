import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';

/* ============ types ============ */
export interface ERDColumn {
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
}

export interface ERDNode {
  id: string;
  name: string;
  color: string;
  columns: ERDColumn[];
  x: number;
  y: number;
  w: number;
}

export interface ERDEdge {
  from: string;
  to: string;
  label?: string;
  /** custom source/target attachment offsets (otherwise centre-to-centre) */
  fromSide?: 'left' | 'right' | 'top' | 'bottom';
  toSide?: 'left' | 'right' | 'top' | 'bottom';
}

interface InteractiveERDProps {
  initialNodes: ERDNode[];
  edges: ERDEdge[];
  title: string;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}

/* ============ helpers ============ */
const ROW_H = 22;
const HEADER_H = 30;
const nodeHeight = (node: ERDNode) => HEADER_H + node.columns.length * ROW_H + 4;

const getAnchor = (node: ERDNode, side?: string) => {
  const h = nodeHeight(node);
  switch (side) {
    case 'left':   return { x: node.x, y: node.y + h / 2 };
    case 'right':  return { x: node.x + node.w, y: node.y + h / 2 };
    case 'top':    return { x: node.x + node.w / 2, y: node.y };
    case 'bottom': return { x: node.x + node.w / 2, y: node.y + h };
    default:       return { x: node.x + node.w / 2, y: node.y + h / 2 };
  }
};

/* ============ component ============ */
const InteractiveERD: React.FC<InteractiveERDProps> = ({
  initialNodes,
  edges,
  title,
  viewBoxWidth = 920,
  viewBoxHeight = 540,
}) => {
  const [nodes, setNodes] = useState<ERDNode[]>(initialNodes);
  const [scale, setScale] = useState(0.92);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingCol, setEditingCol] = useState<{ nodeId: string; colIdx: number; field: 'name' | 'type' } | null>(null);
  const dragRef = useRef<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /* --- zoom --- */
  const zoomIn  = () => setScale(s => Math.min(s + 0.15, 2));
  const zoomOut = () => setScale(s => Math.max(s - 0.15, 0.35));
  const fitScreen = useCallback(() => {
    if (nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + nodeHeight(n));
    });
    const bw = maxX - minX + 60;
    const bh = maxY - minY + 60;
    const sw = viewBoxWidth / bw;
    const sh = viewBoxHeight / bh;
    setScale(Math.max(0.35, Math.min(Math.min(sw, sh), 2)));
  }, [nodes, viewBoxWidth, viewBoxHeight]);

  /* auto-fit on mount */
  useEffect(() => { fitScreen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* --- drag --- */
  const handlePointerDown = (nodeId: string, e: React.PointerEvent) => {
    if (editingNode || editingCol) return;
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm);

    dragRef.current = { nodeId, startX: svgPt.x, startY: svgPt.y, origX: node.x, origY: node.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm);
    const dx = svgPt.x - dragRef.current.startX;
    const dy = svgPt.y - dragRef.current.startY;
    setNodes(prev => prev.map(n =>
      n.id === dragRef.current!.nodeId
        ? { ...n, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy }
        : n
    ));
  };

  const handlePointerUp = () => { dragRef.current = null; };

  /* --- editing --- */
  const updateNodeName = (nodeId: string, name: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, name } : n));
  };

  const updateColumn = (nodeId: string, colIdx: number, field: 'name' | 'type', value: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const cols = [...n.columns];
      cols[colIdx] = { ...cols[colIdx], [field]: value };
      return { ...n, columns: cols };
    }));
  };

  /* ---- build edges ---- */
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const scaledVBW = viewBoxWidth / scale;
  const scaledVBH = viewBoxHeight / scale;
  // centre the content
  let cMinX = Infinity, cMinY = Infinity, cMaxX = -Infinity, cMaxY = -Infinity;
  nodes.forEach(n => { cMinX = Math.min(cMinX, n.x); cMinY = Math.min(cMinY, n.y); cMaxX = Math.max(cMaxX, n.x + n.w); cMaxY = Math.max(cMaxY, n.y + nodeHeight(n)); });
  const cw = cMaxX - cMinX;
  const ch = cMaxY - cMinY;
  const vbX = cMinX - (scaledVBW - cw) / 2;
  const vbY = cMinY - (scaledVBH - ch) / 2;

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      {/* zoom toolbar */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', gap: 0.5, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 2, px: 0.5 }}>
        <Tooltip title="Увеличить"><IconButton size="small" aria-label="Увеличить ERD" onClick={zoomIn}><ZoomInIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Уменьшить"><IconButton size="small" aria-label="Уменьшить ERD" onClick={zoomOut}><ZoomOutIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Вписать в экран"><IconButton size="small" aria-label="Вписать ERD в экран" onClick={fitScreen}><FitScreenIcon fontSize="small" /></IconButton></Tooltip>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', px: 1, color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.7rem' }}>
          {Math.round(scale * 100)}%
        </Typography>
      </Box>

      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${scaledVBW} ${scaledVBH}`}
        style={{ width: '100%', height: Math.min(620, Math.max(420, viewBoxHeight * scale)), display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <marker id="erd-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto" fill="#7d8590">
            <polygon points="0 0, 8 3, 0 6" />
          </marker>
          <filter id="erd-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* edges */}
        {edges.map((edge, idx) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;
          const a = getAnchor(fromNode, edge.fromSide);
          const b = getAnchor(toNode, edge.toSide);
          return (
            <g key={idx}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7d8590" strokeWidth={1.5} markerEnd="url(#erd-arrow)" />
              {edge.label && (
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize="9" fill="#9da7b3" fontFamily="sans-serif">{edge.label}</text>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {nodes.map(node => {
          const h = nodeHeight(node);
          return (
            <g
              key={node.id}
              style={{ cursor: editingNode === node.id || editingCol ? 'default' : 'grab' }}
              onPointerDown={(e) => handlePointerDown(node.id, e)}
            >
              <rect x={node.x} y={node.y} width={node.w} height={h} rx={10} fill="#0f1722" stroke={node.color} strokeWidth={2} filter="url(#erd-shadow)" />
              <rect x={node.x} y={node.y} width={node.w} height={HEADER_H} rx={10} fill={node.color} />
              <rect x={node.x} y={node.y + HEADER_H - 6} width={node.w} height={6} fill={node.color} />

              {/* node name — click to edit */}
              {editingNode === node.id ? (
                <foreignObject x={node.x + 4} y={node.y + 2} width={node.w - 8} height={HEADER_H - 4}>
                  <input
                    autoFocus
                    value={node.name}
                    onChange={e => updateNodeName(node.id, e.target.value)}
                    onBlur={() => setEditingNode(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingNode(null); }}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, color: '#fff', fontWeight: 'bold', fontSize: 12, fontFamily: 'monospace', padding: '2px 6px', outline: 'none', textAlign: 'center' }}
                  />
                </foreignObject>
              ) : (
                <text
                  x={node.x + node.w / 2} y={node.y + 20} textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="12" fontFamily="monospace"
                  style={{ cursor: 'pointer' }}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingNode(node.id); }}
                >
                  {node.name}
                </text>
              )}

              {/* edit icon */}
              <g
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setEditingNode(node.id); }}
              >
                <rect x={node.x + node.w - 22} y={node.y + 4} width={18} height={18} rx={4} fill="rgba(0,0,0,0.25)" />
                <text x={node.x + node.w - 13} y={node.y + 17} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">✎</text>
              </g>

              {/* columns */}
              {node.columns.map((col, i) => {
                const cy = node.y + HEADER_H + 16 + i * ROW_H;
                const isEditingName = editingCol?.nodeId === node.id && editingCol.colIdx === i && editingCol.field === 'name';
                const isEditingType = editingCol?.nodeId === node.id && editingCol.colIdx === i && editingCol.field === 'type';

                return (
                  <g key={`${node.id}-${i}`}>
                    {isEditingName ? (
                      <foreignObject x={node.x + 4} y={cy - 13} width={node.w * 0.55} height={20}>
                        <input
                          autoFocus
                          value={col.name}
                          onChange={e => updateColumn(node.id, i, 'name', e.target.value)}
                          onBlur={() => setEditingCol(null)}
                          onKeyDown={e => { if (e.key === 'Enter') setEditingCol(null); }}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 3, color: '#e6edf3', fontSize: 10, fontFamily: 'monospace', padding: '1px 4px', outline: 'none' }}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={node.x + 8} y={cy} fontSize="11" fontFamily="monospace" fill="#e6edf3"
                        style={{ cursor: 'pointer' }}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingCol({ nodeId: node.id, colIdx: i, field: 'name' }); }}
                      >
                        {col.pk ? 'PK ' : col.fk ? 'FK ' : ''}{col.name}
                      </text>
                    )}

                    {isEditingType ? (
                      <foreignObject x={node.x + node.w * 0.55} y={cy - 13} width={node.w * 0.4} height={20}>
                        <input
                          autoFocus
                          value={col.type}
                          onChange={e => updateColumn(node.id, i, 'type', e.target.value)}
                          onBlur={() => setEditingCol(null)}
                          onKeyDown={e => { if (e.key === 'Enter') setEditingCol(null); }}
                          style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 3, color: '#8b949e', fontSize: 9, fontFamily: 'monospace', padding: '1px 4px', outline: 'none', textAlign: 'right' }}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={node.x + node.w - 8} y={cy} textAnchor="end" fontSize="10" fontFamily="monospace" fill="#8b949e"
                        style={{ cursor: 'pointer' }}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingCol({ nodeId: node.id, colIdx: i, field: 'type' }); }}
                      >
                        {col.type}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* title label */}
        <text x={(cMinX + cMaxX) / 2} y={cMaxY + 30} textAnchor="middle" fontSize="14" fill="#9da7b3" fontWeight="bold">{title}</text>
      </svg>
    </Box>
  );
};

export default InteractiveERD;

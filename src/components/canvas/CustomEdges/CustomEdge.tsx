import React from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import { EdgeData } from '../../../types/graph';
import { Zap, AlertOctagon } from 'lucide-react';

export const CustomEdge: React.FC<any> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}) => {
  const edgeData: EdgeData = data;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isCircuitOpen = edgeData?.state === 'CIRCUIT_OPEN';
  const isSevered = edgeData?.state === 'SEVERED';
  const isDegraded = edgeData?.state === 'DEGRADED';

  let strokeColor = '#475569'; // default slate-600
  let strokeDasharray = 'none';
  let strokeWidth = selected ? 2.5 : 1.5;

  if (isCircuitOpen) {
    strokeColor = '#A855F7'; // purple
    strokeWidth = 2.5;
  } else if (isSevered) {
    strokeColor = '#EF4444'; // red
    strokeWidth = 2.5;
    strokeDasharray = '5 5';
  } else if (isDegraded) {
    strokeColor = '#F59E0B'; // amber
    strokeWidth = 2;
    strokeDasharray = '4 4';
  } else if (selected) {
    strokeColor = '#6366F1'; // indigo
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {isCircuitOpen ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/90 border border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.5)] text-[10px] font-semibold text-purple-200 animate-pulse">
              <Zap className="w-3 h-3 text-purple-300" />
              <span>CIRCUIT OPEN</span>
            </div>
          ) : isSevered ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950/90 border border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.5)] text-[10px] font-semibold text-red-200 animate-pulse">
              <AlertOctagon className="w-3 h-3 text-red-300" />
              <span>SEVERED</span>
            </div>
          ) : (
            <div
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border backdrop-blur-sm transition-all ${
                selected
                  ? 'bg-indigo-950 border-indigo-500 text-indigo-200'
                  : 'bg-[#0B0F19]/90 border-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              {edgeData?.protocol || 'RPC'}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

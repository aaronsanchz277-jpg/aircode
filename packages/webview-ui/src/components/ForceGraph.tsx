import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3-force';

interface Props {
  nodes: { id: string; label: string; risk: number }[];
  edges: { from: string; to: string }[];
}

export const ForceGraph: React.FC<Props> = ({ nodes, edges }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!nodes.length) return;
    // implementación simplificada con D3 force (placeholder)
  }, [nodes, edges]);

  return <svg ref={svgRef} width="100%" height="400" />;
};

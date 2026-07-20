import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3-force';

interface Node {
  id: string;
  label: string;
  risk: number;
}

interface Edge {
  from: string;
  to: string;
}

interface Props {
  nodes: Node[];
  edges: Edge[];
}

export const ForceGraph: React.FC<Props> = ({ nodes, edges }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = 400;

    // Create simulation
    const simulation = d3.forceSimulation<Node>(nodes)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('link', d3.forceLink<Node, d3.SimulationLinkDatum<Node>>(edges)
        .id((d: any) => d.id)
        .distance(150)
      );

    // Draw links
    const links = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke-width', 1.5);

    // Draw nodes
    const node = svg.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => 5 + d.risk / 10)
      .attr('fill', (d) => getRiskColor(d.risk))
      .call(drag(simulation));

    // Add labels
    const labels = svg.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label)
      .attr('font-size', '10px')
      .attr('dx', 12)
      .attr('dy', 4);

    // Update positions on tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d) => d.x!)
        .attr('cy', (d) => d.y!);

      labels
        .attr('x', (d) => d.x!)
        .attr('y', (d) => d.y!);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  function getRiskColor(risk: number): string {
    if (risk < 30) return '#4ade80'; // green
    if (risk < 60) return '#fbbf24'; // yellow
    if (risk < 80) return '#fb923c'; // orange
    return '#f87171'; // red
  }

  function drag(simulation: d3.Simulation<Node, undefined>) {
    function dragstarted(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  return <svg ref={svgRef} width="100%" height="400" style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }} />;
};

import React from 'react';
import { useVSCodeAPI } from './hooks/useVSCodeAPI';
import { ForceGraph } from './components/ForceGraph';
import { FileRankingTable } from './components/FileRankingTable';

const App: React.FC = () => {
  const data = useVSCodeAPI();

  if (!data) return <p>Esperando análisis...</p>;
  if (data.message) return <p>{data.message}</p>;

  return (
    <div>
      <h2>Impacto de la idea</h2>
      <FileRankingTable files={data.files} />
      <ForceGraph nodes={data.graph.nodes} edges={data.graph.edges} />
    </div>
  );
};

export default App;

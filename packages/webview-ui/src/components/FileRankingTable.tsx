import React from 'react';

interface FileData {
  path: string;
  risk: number;
  layer: string;
}

interface Props {
  files: FileData[];
}

export const FileRankingTable: React.FC<Props> = ({ files }) => {
  if (!files.length) return <p>No hay archivos afectados.</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>Archivo</th>
          <th>Capa</th>
          <th>Riesgo</th>
        </tr>
      </thead>
      <tbody>
        {files.map((f, i) => (
          <tr key={i}>
            <td>{f.path}</td>
            <td>{f.layer}</td>
            <td>{f.risk}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

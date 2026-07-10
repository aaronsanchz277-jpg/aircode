import { useEffect, useState } from 'react';

export function useVSCodeAPI() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data.command === 'updateAnalysis') {
        setData(event.data.data);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return data;
}

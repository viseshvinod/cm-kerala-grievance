import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const MetaContext = createContext({ districts: [], categories: [], statuses: [], priorities: [], departments: [], ai: null });

export function MetaProvider({ children }) {
  const [meta, setMeta] = useState({ districts: [], categories: [], statuses: [], priorities: [], departments: [], ai: null });
  useEffect(() => {
    Promise.all([api.get('/meta'), api.get('/departments')])
      .then(([m, d]) => setMeta({ ...m, departments: d.departments }))
      .catch(() => {});
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);

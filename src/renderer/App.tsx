import { useEffect } from 'react';
import MainLayout from './components/Layout/MainLayout';
import { useConnectionStore } from './stores/connectionStore';
import { useQueryStore } from './stores/queryStore';
import { useEditorStore } from './stores/editorStore';
import { ToastContainer } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  const loadConnections = useConnectionStore((state) => state.loadConnections);
  const { loadFolders, loadQueries } = useQueryStore();
  const loadHistory = useEditorStore((state) => state.loadHistory);

  useEffect(() => {
    // Load saved data on startup
    loadConnections();
    loadFolders();
    loadQueries();
    loadHistory();
  }, [loadConnections, loadFolders, loadQueries, loadHistory]);

  return (
    <ErrorBoundary>
      <div className="h-full bg-pastel-bg-primary">
        <MainLayout />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;

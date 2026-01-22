import { useEditorStore } from '../../stores/editorStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useQueryStore } from '../../stores/queryStore';
import { useUIStore } from '../../stores/uiStore';

// Detect if user is on Mac
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';

export default function Toolbar() {
  const { tabs, activeTabId, cancelQuery, setTabDirty } = useEditorStore();
  const { connections, activeConnectionId } = useConnectionStore();
  const { updateQuery, getQueryById } = useQueryStore();
  const { addToast } = useUIStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeConnection = connections.find((c) => c.id === (activeTab?.connectionId || activeConnectionId));
  const isConnected = activeConnection?.status === 'connected';

  const handleRun = () => {
    if (!activeTab) return;
    // Dispatch a custom event that SQLEditor listens for
    // This allows SQLEditor to access the selection and handle multi-statement execution
    window.dispatchEvent(new CustomEvent('run-query', { detail: { tabId: activeTab.id } }));
  };

  const handleCancel = async () => {
    if (!activeTab || !activeConnection) return;
    await cancelQuery(activeTab.id, activeConnection.id);
    addToast({ type: 'info', message: 'Query cancelled' });
  };

  const handleSave = async () => {
    if (!activeTab || !activeTab.queryFileId) {
      addToast({ type: 'info', message: 'Create a new query in the sidebar to save' });
      return;
    }

    const queryFile = getQueryById(activeTab.queryFileId);
    if (queryFile) {
      await updateQuery({
        ...queryFile,
        content: activeTab.content,
        connectionId: activeTab.connectionId,
      });
      setTabDirty(activeTab.id, false);
      addToast({ type: 'success', message: 'Query saved' });
    }
  };

  const handleFormat = () => {
    if (!activeTab) return;
    // Dispatch a custom event that SQLEditor listens for
    window.dispatchEvent(new CustomEvent('format-query', { detail: { tabId: activeTab.id } }));
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-pastel-bg-primary border-b border-pastel-border-light">
      {/* Run button */}
      {activeTab?.isExecuting ? (
        <ToolbarButton
          onClick={handleCancel}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          }
          label="Cancel"
          variant="danger"
        />
      ) : (
        <ToolbarButton
          onClick={handleRun}
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          }
          label="Run"
          shortcut={`${modKey}+Enter`}
          variant="primary"
          disabled={!isConnected}
        />
      )}

      <div className="w-px h-5 bg-pastel-border-light" />

      {/* Save button */}
      <ToolbarButton
        onClick={handleSave}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        }
        label="Save"
        shortcut={`${modKey}+S`}
        disabled={!activeTab?.isDirty}
      />

      {/* Format button */}
      <ToolbarButton
        onClick={handleFormat}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        }
        label="Format"
        shortcut={`${modKey}+Shift+F`}
      />

      <div className="flex-1" />

      {/* Connection selector */}
      <ConnectionSelector />
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}

function ToolbarButton({
  onClick,
  icon,
  label,
  shortcut,
  variant = 'default',
  disabled,
}: ToolbarButtonProps) {
  const variantStyles = {
    default: 'hover:bg-pastel-bg-hover text-pastel-text-secondary hover:text-pastel-text-primary',
    primary: 'bg-pastel-accent-green hover:bg-pastel-accent-green-hover text-pastel-accent-green-text',
    danger: 'bg-pastel-status-error hover:opacity-90 text-pastel-status-error-text',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
      `}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ConnectionSelector() {
  const { connections, activeConnectionId, setActiveConnection } = useConnectionStore();
  const { tabs, activeTabId, updateTabConnection } = useEditorStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const selectedConnectionId = activeTab?.connectionId || activeConnectionId;
  const connectedConnections = connections.filter((c) => c.status === 'connected');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const connectionId = e.target.value || undefined;
    if (activeTabId) {
      updateTabConnection(activeTabId, connectionId);
    }
    if (connectionId) {
      setActiveConnection(connectionId);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-pastel-text-muted">Connection:</span>
      <select
        value={selectedConnectionId || ''}
        onChange={handleChange}
        className="text-sm bg-white border border-pastel-border-medium rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pastel-accent-blue"
      >
        <option value="">Select connection...</option>
        {connectedConnections.map((conn) => (
          <option key={conn.id} value={conn.id}>
            {conn.config.name}
          </option>
        ))}
      </select>
    </div>
  );
}

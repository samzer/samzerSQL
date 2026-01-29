import { useConnectionStore } from '../../stores/connectionStore';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import type { Connection } from '../../../shared/types';

const statusColors = {
  connected: 'bg-pastel-status-success',
  connecting: 'bg-pastel-status-warning animate-pulse-soft',
  disconnected: 'bg-pastel-border-medium',
  error: 'bg-pastel-status-error',
};

const dbTypeIcons: Record<string, string> = {
  postgresql: 'P',
  mysql: 'M',
  snowflake: 'S',
  salesforce: 'SF',
  sqlite: 'SL',
};

export default function ConnectionList() {
  const connections = useConnectionStore((state) => state.connections);
  const openConnectionModal = useUIStore((state) => state.openConnectionModal);

  return (
    <div className="px-2 pb-2">
      {/* Add connection button - at top for visibility */}
      <button
        onClick={() => openConnectionModal()}
        className="w-full flex items-center justify-center gap-2 px-2 py-2 mb-2 text-sm font-medium text-pastel-accent-blue-text bg-pastel-accent-blue hover:bg-pastel-accent-blue-hover rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Connection
      </button>

      {connections.length === 0 ? (
        <p className="text-xs text-pastel-text-muted text-center py-2">
          No connections yet
        </p>
      ) : (
        connections.map((connection) => (
          <ConnectionItem key={connection.id} connection={connection} />
        ))
      )}
    </div>
  );
}

function ConnectionItem({ connection }: { connection: Connection }) {
  const { connect, disconnect, setActiveConnection, activeConnectionId } = useConnectionStore();
  const { activeTabId, updateTabConnection } = useEditorStore();
  const { openConnectionModal, openPasswordPrompt, addToast } = useUIStore();

  const isActive = activeConnectionId === connection.id;
  const isConnected = connection.status === 'connected';

  const handleClick = () => {
    if (isConnected) {
      setActiveConnection(connection.id);
      // Also set as the connection for the active tab
      if (activeTabId) {
        updateTabConnection(activeTabId, connection.id);
      }
    }
  };

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnected) {
      await disconnect(connection.id);
      addToast({ type: 'info', message: `Disconnected from ${connection.config.name}` });
    } else {
      // Check if password is empty - if so, prompt for it
      if (!connection.config.password) {
        openPasswordPrompt(connection.id);
      } else {
        const result = await connect(connection.id);
        if (result.success) {
          addToast({ type: 'success', message: `Connected to ${connection.config.name}` });
        } else {
          addToast({ type: 'error', message: result.error || 'Connection failed' });
        }
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    openConnectionModal(connection.id);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer
        ${isActive ? 'border-2 border-pastel-accent-blue-text' : 'border-2 border-transparent hover:bg-pastel-bg-hover'}
        ${!isConnected ? 'opacity-70' : ''}
        ${isConnected ? 'bg-pastel-accent-green/40 shadow-glow-green' : ''}
        transition-all duration-300
      `}
    >
      {/* Database type badge */}
      <span className="w-5 h-5 flex items-center justify-center text-2xs font-bold rounded bg-pastel-accent-purple text-pastel-accent-purple-text">
        {dbTypeIcons[connection.config.type] || '?'}
      </span>

      {/* Status indicator */}
      <span className={`w-2 h-2 rounded-full ${statusColors[connection.status]}`} />

      {/* Connection name */}
      <span className="flex-1 text-sm text-pastel-text-primary truncate">
        {connection.config.name}
      </span>

      {/* Action buttons */}
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          onClick={handleConnect}
          className="p-1 rounded hover:bg-pastel-bg-active text-pastel-text-muted hover:text-pastel-text-primary"
          title={isConnected ? 'Disconnect' : 'Connect'}
        >
          {isConnected ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </button>
        <button
          onClick={handleEdit}
          className="p-1 rounded hover:bg-pastel-bg-active text-pastel-text-muted hover:text-pastel-text-primary"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { useUIStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';

export default function PasswordPromptModal() {
  const { isPasswordPromptOpen, passwordPromptConnectionId, closePasswordPrompt, addToast } = useUIStore();
  const { connections } = useConnectionStore();
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const connection = connections.find((c) => c.id === passwordPromptConnectionId);

  const handleConnect = async () => {
    if (!connection || !password) return;

    setIsConnecting(true);

    // Temporarily set the password in the connection config for this connection attempt
    const configWithPassword = {
      ...connection.config,
      password,
    };

    try {
      const result = await window.electron.db.connect(configWithPassword);

      if (result.success) {
        // Update the connection status in the store
        useConnectionStore.setState((state) => ({
          connections: state.connections.map((c) =>
            c.id === connection.id
              ? { ...c, status: 'connected', error: undefined }
              : c
          ),
          activeConnectionId: connection.id,
        }));
        addToast({ type: 'success', message: `Connected to ${connection.config.name}` });
        closePasswordPrompt();
        setPassword('');
      } else {
        addToast({ type: 'error', message: result.error || 'Connection failed' });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'Connection failed' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    closePasswordPrompt();
    setPassword('');
  };

  if (!connection) return null;

  return (
    <Modal isOpen={isPasswordPromptOpen} title="Enter Password" onClose={handleClose}>
      <div className="space-y-4">
        <p className="text-sm text-pastel-text-secondary">
          Enter the password for <strong>{connection.config.name}</strong>
        </p>

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && password) {
              handleConnect();
            }
          }}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConnect}
            disabled={!password || isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Modal, { ModalFooter } from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { useUIStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import type { ConnectionConfig, DatabaseType } from '../../../shared/types';

const databaseTypes: { value: DatabaseType; label: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'snowflake', label: 'Snowflake' },
];

const defaultPorts: Record<DatabaseType, number> = {
  postgresql: 5432,
  mysql: 3306,
  snowflake: 443,
};

export default function ConnectionModal() {
  const { closeConnectionModal, editingConnectionId, addToast } = useUIStore();
  const { connections, addConnection, updateConnection, deleteConnection, testConnection } = useConnectionStore();

  const existingConnection = editingConnectionId
    ? connections.find((c) => c.id === editingConnectionId)
    : null;

  const [formData, setFormData] = useState<Partial<ConnectionConfig>>({
    type: 'postgresql',
    name: '',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
    // Snowflake-specific
    account: '',
    warehouse: '',
    schema: 'PUBLIC',
    role: '',
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (existingConnection) {
      setFormData(existingConnection.config);
    }
  }, [existingConnection]);

  const handleTypeChange = (type: DatabaseType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      port: defaultPorts[type],
    }));
    setTestResult(null);
  };

  const handleChange = (field: keyof ConnectionConfig, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    const config: ConnectionConfig = {
      id: editingConnectionId || uuidv4(),
      ...(formData as Omit<ConnectionConfig, 'id'>),
    };

    const result = await testConnection(config);
    setTestResult(result);
    setIsTesting(false);

    if (result.success) {
      addToast({ type: 'success', message: 'Connection successful!' });
    } else {
      addToast({ type: 'error', message: result.error || 'Connection failed' });
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      addToast({ type: 'warning', message: 'Please enter a connection name' });
      return;
    }

    setIsSaving(true);

    const config: ConnectionConfig = {
      id: editingConnectionId || uuidv4(),
      ...(formData as Omit<ConnectionConfig, 'id'>),
    };

    if (editingConnectionId) {
      await updateConnection(config);
      addToast({ type: 'success', message: 'Connection updated' });
    } else {
      await addConnection(config);
      addToast({ type: 'success', message: 'Connection added' });
    }

    setIsSaving(false);
    closeConnectionModal();
  };

  const handleDelete = async () => {
    if (!editingConnectionId) return;

    if (confirm('Are you sure you want to delete this connection?')) {
      await deleteConnection(editingConnectionId);
      addToast({ type: 'success', message: 'Connection deleted' });
      closeConnectionModal();
    }
  };

  const isSnowflake = formData.type === 'snowflake';

  return (
    <Modal
      isOpen={true}
      onClose={closeConnectionModal}
      title={editingConnectionId ? 'Edit Connection' : 'New Connection'}
      width="max-w-lg"
    >
      <div className="space-y-4">
        {/* Database type */}
        <Select
          label="Database Type"
          options={databaseTypes}
          value={formData.type}
          onChange={(e) => handleTypeChange(e.target.value as DatabaseType)}
        />

        {/* Connection name */}
        <Input
          label="Connection Name"
          placeholder="My Database"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
        />

        {isSnowflake ? (
          // Snowflake-specific fields
          <>
            <Input
              label="Account"
              placeholder="account.region"
              value={formData.account}
              onChange={(e) => handleChange('account', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Warehouse"
                placeholder="COMPUTE_WH"
                value={formData.warehouse}
                onChange={(e) => handleChange('warehouse', e.target.value)}
              />
              <Input
                label="Database"
                placeholder="MY_DATABASE"
                value={formData.database}
                onChange={(e) => handleChange('database', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Schema"
                placeholder="PUBLIC"
                value={formData.schema}
                onChange={(e) => handleChange('schema', e.target.value)}
              />
              <Input
                label="Role (optional)"
                placeholder="ACCOUNTADMIN"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
              />
            </div>
          </>
        ) : (
          // PostgreSQL/MySQL fields
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input
                  label="Host"
                  placeholder="localhost"
                  value={formData.host}
                  onChange={(e) => handleChange('host', e.target.value)}
                />
              </div>
              <Input
                label="Port"
                type="number"
                value={formData.port}
                onChange={(e) => handleChange('port', parseInt(e.target.value) || 0)}
              />
            </div>
            <Input
              label="Database"
              placeholder="my_database"
              value={formData.database}
              onChange={(e) => handleChange('database', e.target.value)}
            />
          </>
        )}

        {/* Credentials */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Username"
            value={formData.username}
            onChange={(e) => handleChange('username', e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
          />
        </div>

        {/* SSL option (for non-Snowflake) */}
        {!isSnowflake && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.ssl}
              onChange={(e) => handleChange('ssl', e.target.checked)}
              className="w-4 h-4 rounded border-pastel-border-medium text-pastel-accent-blue focus:ring-pastel-accent-blue"
            />
            <span className="text-sm text-pastel-text-primary">Use SSL</span>
          </label>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className={`p-3 rounded-lg text-sm ${
              testResult.success
                ? 'bg-pastel-status-success text-pastel-status-success-text'
                : 'bg-pastel-status-error text-pastel-status-error-text'
            }`}
          >
            {testResult.success ? 'Connection successful!' : testResult.error}
          </div>
        )}
      </div>

      <ModalFooter>
        {editingConnectionId && (
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="secondary" onClick={closeConnectionModal}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={handleTest} isLoading={isTesting}>
          Test Connection
        </Button>
        <Button onClick={handleSave} isLoading={isSaving}>
          {editingConnectionId ? 'Update' : 'Save'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

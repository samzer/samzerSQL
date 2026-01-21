import { useState } from 'react';
import Modal, { ModalFooter } from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { useUIStore } from '../../stores/uiStore';
import { useQueryStore } from '../../stores/queryStore';

export default function NewFolderModal() {
  const { closeNewFolderModal, newFolderParentId, addToast } = useUIStore();
  const { createFolder } = useQueryStore();

  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      addToast({ type: 'warning', message: 'Please enter a folder name' });
      return;
    }

    setIsCreating(true);

    try {
      await createFolder(trimmedName, newFolderParentId);
      addToast({ type: 'success', message: 'Folder created' });
      closeNewFolderModal();
    } catch {
      addToast({ type: 'error', message: 'Failed to create folder' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={closeNewFolderModal}
      title="New Folder"
      width="max-w-sm"
    >
      <Input
        label="Folder Name"
        placeholder="My Folder"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />

      <ModalFooter>
        <Button variant="secondary" onClick={closeNewFolderModal}>
          Cancel
        </Button>
        <Button onClick={handleCreate} isLoading={isCreating}>
          Create
        </Button>
      </ModalFooter>
    </Modal>
  );
}

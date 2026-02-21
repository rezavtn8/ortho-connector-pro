import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FolderPlus, Plus } from 'lucide-react';
import { type DiscoveredGroup } from '@/hooks/useDiscoveredGroups';

interface SaveToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DiscoveredGroup[];
  selectedCount: number;
  onCreateNew: (name: string) => Promise<void>;
  onAddToExisting: (groupId: string) => Promise<void>;
}

export const SaveToGroupDialog: React.FC<SaveToGroupDialogProps> = ({
  open,
  onOpenChange,
  groups,
  selectedCount,
  onCreateNew,
  onAddToExisting,
}) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [newName, setNewName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (mode === 'new' && newName.trim()) {
        await onCreateNew(newName.trim());
      } else if (mode === 'existing' && selectedGroupId) {
        await onAddToExisting(selectedGroupId);
      }
      setNewName('');
      setSelectedGroupId('');
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = mode === 'new' ? newName.trim().length > 0 : selectedGroupId.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-primary" />
            Save {selectedCount} Office{selectedCount !== 1 ? 's' : ''} to Group
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {groups.length > 0 && (
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="mode-new" />
                <Label htmlFor="mode-new" className="cursor-pointer">Create new group</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="mode-existing" />
                <Label htmlFor="mode-existing" className="cursor-pointer">Add to existing group</Label>
              </div>
            </RadioGroup>
          )}

          {mode === 'new' && (
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., East Side Dentists"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canSave && handleSave()}
                autoFocus
              />
            </div>
          )}

          {mode === 'existing' && groups.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedGroupId === group.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <p className="font-medium text-sm">{group.name}</p>
                  <p className="text-xs text-muted-foreground">{group.member_count || 0} offices</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            <Plus className="h-4 w-4 mr-1" />
            {isSaving ? 'Saving...' : mode === 'new' ? 'Create Group' : 'Add to Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

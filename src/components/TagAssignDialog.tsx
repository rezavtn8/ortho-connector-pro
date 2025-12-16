import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { TagBadge } from './TagBadge';
import { useOfficeTags } from '@/hooks/useOfficeTags';

const TAG_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

interface TagAssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  officeIds: string[];
  officeNames?: string[];
}

export function TagAssignDialog({ isOpen, onClose, officeIds, officeNames = [] }: TagAssignDialogProps) {
  const { tags, assignTags, removeTags, getTagsForOffice, createTag, isAssigning, isCreating } = useOfficeTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  // Get tags that are already assigned to ALL selected offices
  const commonTags = tags.filter(tag => 
    officeIds.every(officeId => 
      getTagsForOffice(officeId).some(t => t.id === tag.id)
    )
  );

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setIsCreatingNew(false);
    }
  };

  const handleApply = () => {
    if (selectedTagIds.length > 0) {
      assignTags({ officeIds, tagIds: selectedTagIds });
    }
    onClose();
    setSelectedTagIds([]);
  };

  const handleRemoveTag = (tagId: string) => {
    removeTags({ officeIds, tagIds: [tagId] });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Manage Tags
            {officeIds.length > 1 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({officeIds.length} offices selected)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Currently assigned tags (common to all selected) */}
          {commonTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Currently assigned:</p>
              <div className="flex flex-wrap gap-2">
                {commonTags.map(tag => (
                  <TagBadge
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    onRemove={() => handleRemoveTag(tag.id)}
                    size="md"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available tags to assign */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Add tags:</p>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No tags created yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags
                  .filter(tag => !commonTags.some(ct => ct.id === tag.id))
                  .map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`relative transition-all ${
                        selectedTagIds.includes(tag.id) ? 'ring-2 ring-primary ring-offset-2 rounded-full' : ''
                      }`}
                    >
                      <TagBadge name={tag.name} color={tag.color} size="md" />
                      {selectedTagIds.includes(tag.id) && (
                        <Check className="absolute -top-1 -right-1 h-4 w-4 text-primary bg-background rounded-full" />
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Create new tag inline */}
          {isCreatingNew ? (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name..."
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      newTagColor === c ? 'ring-2 ring-offset-1 ring-primary' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateTag} disabled={!newTagName.trim() || isCreating}>
                  Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsCreatingNew(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingNew(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Tag
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={selectedTagIds.length === 0 || isAssigning}>
            {isAssigning ? 'Applying...' : `Apply ${selectedTagIds.length > 0 ? `(${selectedTagIds.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TagBadge } from './TagBadge';
import { useOfficeTags, OfficeTag } from '@/hooks/useOfficeTags';

const TAG_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

interface TagFormProps {
  initialName?: string;
  initialColor?: string;
  onSubmit: (name: string, color: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

function TagForm({ initialName = '', initialColor = TAG_COLORS[0], onSubmit, onCancel, isLoading, submitLabel = 'Create' }: TagFormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), color);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tag-name">Tag Name</Label>
        <Input
          id="tag-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Holiday Cards 2024"
          autoFocus
        />
      </div>
      
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all ${
                color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <TagBadge name={name || 'Preview'} color={color} size="md" />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function TagManager() {
  const { tags, createTag, updateTag, deleteTag, isCreating } = useOfficeTags();
  const [isOpen, setIsOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<OfficeTag | null>(null);

  const handleCreate = (name: string, color: string) => {
    createTag({ name, color });
    setIsOpen(false);
  };

  const handleUpdate = (name: string, color: string) => {
    if (editingTag) {
      updateTag({ id: editingTag.id, name, color });
      setEditingTag(null);
    }
  };

  const handleDelete = (tagId: string) => {
    if (confirm('Delete this tag? It will be removed from all offices.')) {
      deleteTag(tagId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Tags</h3>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2">
              <Plus className="h-4 w-4 mr-1" />
              New Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Tag</DialogTitle>
            </DialogHeader>
            <TagForm
              onSubmit={handleCreate}
              onCancel={() => setIsOpen(false)}
              isLoading={isCreating}
            />
          </DialogContent>
        </Dialog>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags yet. Create one to organize your offices.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div key={tag.id} className="group relative">
              <TagBadge name={tag.name} color={tag.color} size="md" />
              <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                <button
                  onClick={() => setEditingTag(tag)}
                  className="p-1 rounded-full bg-background border shadow-sm hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="p-1 rounded-full bg-background border shadow-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          {editingTag && (
            <TagForm
              initialName={editingTag.name}
              initialColor={editingTag.color}
              onSubmit={handleUpdate}
              onCancel={() => setEditingTag(null)}
              submitLabel="Save"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FolderOpen, MoreHorizontal, Pencil, Trash2, Printer, MapPin, Check, X } from 'lucide-react';
import { type DiscoveredGroup } from '@/hooks/useDiscoveredGroups';
import { useNavigate } from 'react-router-dom';

interface DiscoveredOfficeGroupsProps {
  groups: DiscoveredGroup[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  groupMemberIds: string[];
}

export const DiscoveredOfficeGroups: React.FC<DiscoveredOfficeGroupsProps> = ({
  groups,
  activeGroupId,
  onSelectGroup,
  onRenameGroup,
  onDeleteGroup,
  groupMemberIds,
}) => {
  const navigate = useNavigate();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (groups.length === 0) return null;

  const startRename = (group: DiscoveredGroup) => {
    setRenamingId(group.id);
    setRenameValue(group.name);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameGroup(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handlePrintLabels = () => {
    if (groupMemberIds.length > 0) {
      navigate(`/mailing-labels?discovered=true&ids=${groupMemberIds.join(',')}`);
    }
  };

  const handleViewOnMap = () => {
    navigate(`/map-view?showDiscovered=true`);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        
        <Button
          variant={activeGroupId === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelectGroup(null)}
          className="h-8 text-xs"
        >
          All Offices
        </Button>

        {groups.map((group) => (
          <div key={group.id} className="flex items-center gap-0.5">
            {renamingId === group.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="h-8 w-36 text-xs"
                  autoFocus
                />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={confirmRename}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setRenamingId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant={activeGroupId === group.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSelectGroup(group.id)}
                  className="h-8 text-xs gap-1.5"
                >
                  {group.name}
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
                    {group.member_count || 0}
                  </Badge>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-6 p-0">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => startRename(group)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePrintLabels} disabled={!group.member_count}>
                      <Printer className="h-3.5 w-3.5 mr-2" /> Print Labels
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleViewOnMap} disabled={!group.member_count}>
                      <MapPin className="h-3.5 w-3.5 mr-2" /> View on Map
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteConfirmId(group.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the group but won't remove the discovered offices themselves.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  onDeleteGroup(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

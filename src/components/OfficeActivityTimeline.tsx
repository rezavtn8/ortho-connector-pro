import { useState } from 'react';
import { format } from 'date-fns';
import { MessageSquare, Calendar, Gift, Phone, FileText, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOfficeInteractions, OfficeInteraction } from '@/hooks/useOfficeInteractions';

interface OfficeActivityTimelineProps {
  officeId: string;
}

const INTERACTION_ICONS: Record<string, React.ReactNode> = {
  campaign: <Gift className="h-4 w-4" />,
  visit: <Calendar className="h-4 w-4" />,
  referral: <FileText className="h-4 w-4" />,
  note: <MessageSquare className="h-4 w-4" />,
  call: <Phone className="h-4 w-4" />,
};

const INTERACTION_COLORS: Record<string, string> = {
  campaign: 'bg-purple-100 text-purple-700 border-purple-200',
  visit: 'bg-blue-100 text-blue-700 border-blue-200',
  referral: 'bg-green-100 text-green-700 border-green-200',
  note: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  call: 'bg-orange-100 text-orange-700 border-orange-200',
};

export function OfficeActivityTimeline({ officeId }: OfficeActivityTimelineProps) {
  const { interactions, addInteraction, deleteInteraction, isAdding } = useOfficeInteractions(officeId);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [form, setForm] = useState({
    interaction_type: 'note',
    title: '',
    description: '',
  });

  const handleAdd = () => {
    if (!form.title.trim()) return;
    
    addInteraction({
      office_id: officeId,
      interaction_type: form.interaction_type,
      title: form.title,
      description: form.description || undefined,
    });
    
    setIsAddDialogOpen(false);
    setForm({ interaction_type: 'note', title: '', description: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this activity?')) {
      deleteInteraction(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Activity Timeline</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Log Activity
        </Button>
      </div>

      {interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity logged yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <div key={interaction.id} className="relative pl-10 group">
                {/* Timeline dot */}
                <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${INTERACTION_COLORS[interaction.interaction_type] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {INTERACTION_ICONS[interaction.interaction_type] || <MessageSquare className="h-3 w-3" />}
                </div>
                
                <div className="bg-card border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{interaction.title}</p>
                      {interaction.description && (
                        <p className="text-sm text-muted-foreground mt-1">{interaction.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(interaction.occurred_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(interaction.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={form.interaction_type}
                onValueChange={(value) => setForm({ ...form, interaction_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">📝 Note</SelectItem>
                  <SelectItem value="call">📞 Phone Call</SelectItem>
                  <SelectItem value="visit">📅 Visit</SelectItem>
                  <SelectItem value="campaign">🎁 Campaign</SelectItem>
                  <SelectItem value="referral">📄 Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Brief summary..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Details</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!form.title.trim() || isAdding}>
              Log Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

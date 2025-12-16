import { useState } from 'react';
import { format } from 'date-fns';
import { Phone, Mail, User, Star, Trash2, Edit, Plus, Cake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useOfficeContacts, OfficeContact } from '@/hooks/useOfficeContacts';

interface ContactManagerProps {
  officeId: string;
}

export function ContactManager({ officeId }: ContactManagerProps) {
  const { contacts, primaryContact, addContact, updateContact, deleteContact, isAdding } = useOfficeContacts(officeId);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<OfficeContact | null>(null);
  const [form, setForm] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    is_primary: false,
    notes: '',
    birthday: '',
  });

  const resetForm = () => {
    setForm({
      name: '',
      role: '',
      email: '',
      phone: '',
      is_primary: false,
      notes: '',
      birthday: '',
    });
  };

  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (contact: OfficeContact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      is_primary: contact.is_primary,
      notes: contact.notes || '',
      birthday: contact.birthday || '',
    });
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;

    if (editingContact) {
      updateContact({
        id: editingContact.id,
        name: form.name,
        role: form.role || null,
        email: form.email || null,
        phone: form.phone || null,
        is_primary: form.is_primary,
        notes: form.notes || null,
        birthday: form.birthday || null,
      });
      setEditingContact(null);
    } else {
      addContact({
        office_id: officeId,
        name: form.name,
        role: form.role || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        is_primary: form.is_primary,
        notes: form.notes || undefined,
        birthday: form.birthday || undefined,
      });
      setIsAddDialogOpen(false);
    }
    resetForm();
  };

  const handleDelete = (contactId: string) => {
    if (confirm('Delete this contact?')) {
      deleteContact(contactId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Contacts</h3>
        <Button variant="ghost" size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-1" />
          Add Contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts yet. Add one to keep track of your relationships.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <Card key={contact.id} className="p-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.name}</span>
                    {contact.is_primary && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Primary
                      </span>
                    )}
                  </div>
                  {contact.role && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {contact.role}
                    </p>
                  )}
                  {contact.email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </p>
                  )}
                  {contact.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </p>
                  )}
                  {contact.birthday && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Cake className="h-3 w-3" />
                      Birthday: {format(new Date(contact.birthday), 'MMM d')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(contact)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(contact.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || !!editingContact} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingContact(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="e.g., Office Manager, Doctor"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Birthday</Label>
              <Input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any notes about this contact..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_primary"
                checked={form.is_primary}
                onCheckedChange={(checked) => setForm({ ...form, is_primary: !!checked })}
              />
              <Label htmlFor="is_primary" className="cursor-pointer">Set as primary contact</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddDialogOpen(false);
              setEditingContact(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || isAdding}>
              {editingContact ? 'Save Changes' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

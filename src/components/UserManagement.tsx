import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Mail, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ClinicUser {
  id: string;
  email: string;
  role: string;
  clinic_name?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Manager' | 'Front Desk' | 'Marketing Rep'>('Manager');
  const { userProfile, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile) {
      loadUsers();
      loadInvitations();
    }
  }, [userProfile]);

  const loadUsers = async () => {
    if (!userProfile?.clinic_id) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, role')
        .eq('clinic_id', userProfile.clinic_id);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load clinic users",
        variant: "destructive",
      });
    }
  };

  const loadInvitations = async () => {
    if (!userProfile?.clinic_id) return;

    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('clinic_id', userProfile.clinic_id)
        .eq('status', 'pending');

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const sendInvitation = async () => {
    if (!inviteEmail || !inviteRole || !userProfile) return;

    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: inviteEmail,
          role: inviteRole,
          clinicName: userProfile.clinic_name
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteEmail('');
      setInviteRole('Manager');
      loadInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const removeUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user from the clinic?')) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ clinic_id: null })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from clinic",
      });

      loadUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invitation cancelled",
      });

      loadInvitations();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Owner': return 'default';
      case 'Manager': return 'secondary';
      case 'Front Desk': return 'outline';
      case 'Marketing Rep': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Send Invitation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite New User
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Front Desk">Front Desk</SelectItem>
                  <SelectItem value="Marketing Rep">Marketing Rep</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={sendInvitation}
                disabled={isInviting || !inviteEmail}
                className="w-full"
              >
                {isInviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Clinic Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((clinicUser) => (
              <div key={clinicUser.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{clinicUser.email}</p>
                    <Badge variant={getRoleBadgeColor(clinicUser.role)}>
                      {clinicUser.role}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {clinicUser.email === user?.email && (
                    <Badge variant="outline">You</Badge>
                  )}
                  {clinicUser.role !== 'Owner' && clinicUser.email !== user?.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeUser(clinicUser.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={getRoleBadgeColor(invitation.role)}>
                          {invitation.role}
                        </Badge>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelInvitation(invitation.id)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
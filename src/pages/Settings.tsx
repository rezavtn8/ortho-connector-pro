// src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  MapPin,
  User,
  Bell,
  Users,
  Database,
  Shield,
  Upload,
  Download,
  Trash2,
  AlertCircle,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

type UserRole = 'Front Desk' | 'Marketing Rep' | 'Manager';

interface ClinicSettings {
  clinic_name: string;
  clinic_phone: string;
  clinic_address: string;
  clinic_city: string;
  clinic_state: string;
  clinic_zip: string;
}

interface NotificationSettings {
  email_notifications: boolean;
  weekly_reports: boolean;
  monthly_reports: boolean;
  referral_alerts: boolean;
}

interface TeamMember {
  id: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted';
}

const initialClinicSettings: ClinicSettings = {
  clinic_name: '',
  clinic_phone: '',
  clinic_address: '',
  clinic_city: '',
  clinic_state: '',
  clinic_zip: ''
};

const initialNotificationSettings: NotificationSettings = {
  email_notifications: true,
  weekly_reports: true,
  monthly_reports: true,
  referral_alerts: true
};

export function Settings() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(initialClinicSettings);
  const [notifications, setNotifications] = useState<NotificationSettings>(initialNotificationSettings);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('Front Desk');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSettings();
    }
    
    // Load notification settings from localStorage
    const saved = localStorage.getItem('notification_settings');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user?.id) return;
    setLoading(true);
    
    try {
      // Load user profile and clinic info
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (profile) {
        setClinicSettings({
          clinic_name: profile.clinic_name || '',
          clinic_phone: '',
          clinic_address: profile.clinic_address || '',
          clinic_city: '',
          clinic_state: '',
          clinic_zip: ''
        });
      }

      // Load team invitations (using existing user_invitations table)
      const { data: invitations } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('clinic_id', profile?.clinic_id);
      
      if (invitations) {
        const members: TeamMember[] = invitations.map(inv => ({
          id: inv.id,
          email: inv.email,
          role: inv.role as UserRole,
          status: inv.status as 'pending' | 'accepted'
        }));
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveClinicSettings = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          clinic_name: clinicSettings.clinic_name,
          clinic_address: clinicSettings.clinic_address,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Clinic settings saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save clinic settings',
        variant: 'destructive',
      });
    }
  };

  const saveNotificationSettings = async () => {
    // Store notification settings in localStorage for now
    localStorage.setItem('notification_settings', JSON.stringify(notifications));
    
    toast({
      title: 'Success',
      description: 'Notification preferences saved',
    });
  };

  const inviteTeamMember = async () => {
    if (!user?.id || !newMemberEmail || !newMemberRole) return;

    try {
      // Get user's clinic_id first
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.clinic_id) {
        toast({
          title: 'Error',
          description: 'No clinic found for user',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('user_invitations')
        .insert({
          email: newMemberEmail,
          role: newMemberRole,
          invited_by: user.id,
          clinic_id: profile.clinic_id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      setNewMemberEmail('');
      setNewMemberRole('Front Desk');
      
      toast({
        title: 'Success',
        description: 'Team invitation sent successfully',
      });

      loadSettings(); // Reload team members
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send invitation',
        variant: 'destructive',
      });
    }
  };

  const updatePassword = async () => {
    if (!newPassword) return;

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setNewPassword('');
      toast({
        title: 'Success',
        description: 'Password updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update password',
        variant: 'destructive',
      });
    }
  };

  const exportData = async () => {
    if (!user?.id) return;

    try {
      const { data: sources } = await supabase
        .from('patient_sources')
        .select('*')
        .eq('created_by', user.id);

      const { data: visits } = await supabase
        .from('marketing_visits')
        .select('*')
        .eq('user_id', user.id);

      const exportData = {
        sources: sources || [],
        visits: visits || [],
        exported_at: new Date().toISOString()
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `referral-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: 'Data exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export data',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">Manage your account and clinic preferences</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex gap-6">
          <div className="w-64 shrink-0">
            <TabsList className="flex flex-col h-auto w-full p-2 bg-card border">
              {/* Personal Settings */}
              <div className="w-full mb-2">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">
                  Personal
                </div>
                <TabsTrigger value="profile" className="w-full justify-start px-3 py-3 text-left">
                  <User className="w-4 h-4 mr-3" />
                  Profile Settings
                </TabsTrigger>
                <TabsTrigger value="notifications" className="w-full justify-start px-3 py-3 text-left">
                  <Bell className="w-4 h-4 mr-3" />
                  Notifications
                </TabsTrigger>
              </div>

              {/* Organization Settings */}
              <div className="w-full mb-2">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider border-t pt-4">
                  Organization
                </div>
                <TabsTrigger value="clinic" className="w-full justify-start px-3 py-3 text-left">
                  <MapPin className="w-4 h-4 mr-3" />
                  Clinic Information
                </TabsTrigger>
                <TabsTrigger value="team" className="w-full justify-start px-3 py-3 text-left">
                  <Users className="w-4 h-4 mr-3" />
                  Team Management
                </TabsTrigger>
              </div>

              {/* System Settings */}
              <div className="w-full">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider border-t pt-4">
                  System
                </div>
                <TabsTrigger value="data" className="w-full justify-start px-3 py-3 text-left">
                  <Database className="w-4 h-4 mr-3" />
                  Data Management
                </TabsTrigger>
                <TabsTrigger value="security" className="w-full justify-start px-3 py-3 text-left">
                  <Shield className="w-4 h-4 mr-3" />
                  Security & Privacy
                </TabsTrigger>
              </div>
            </TabsList>
          </div>

          <div className="flex-1">
            <div className="bg-card border rounded-lg p-6">
              {/* Profile Settings */}
              <TabsContent value="profile" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      User Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          value={user?.email || ''}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Email address cannot be changed. Contact support if you need to update this.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Clinic Settings */}
              <TabsContent value="clinic" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Clinic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="clinic_name">Clinic Name *</Label>
                          <Input
                            id="clinic_name"
                            value={clinicSettings.clinic_name}
                            onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_name: e.target.value }))}
                            placeholder="Enter your clinic name..."
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="clinic_phone">Phone Number</Label>
                          <Input
                            id="clinic_phone"
                            value={clinicSettings.clinic_phone}
                            onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_phone: e.target.value }))}
                            placeholder="(555) 123-4567"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="clinic_address">Address</Label>
                          <Input
                            id="clinic_address"
                            value={clinicSettings.clinic_address}
                            onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_address: e.target.value }))}
                            placeholder="Street address..."
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="clinic_city">City</Label>
                            <Input
                              id="clinic_city"
                              value={clinicSettings.clinic_city}
                              onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_city: e.target.value }))}
                              placeholder="City..."
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="clinic_state">State</Label>
                            <Input
                              id="clinic_state"
                              value={clinicSettings.clinic_state}
                              onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_state: e.target.value }))}
                              placeholder="State..."
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="clinic_zip">ZIP Code</Label>
                          <Input
                            id="clinic_zip"
                            value={clinicSettings.clinic_zip}
                            onChange={(e) => setClinicSettings(prev => ({ ...prev, clinic_zip: e.target.value }))}
                            placeholder="12345"
                          />
                        </div>

                        <Button onClick={saveClinicSettings} className="w-full">
                          Save Clinic Settings
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Email Notifications</Label>
                          <p className="text-xs text-muted-foreground">Receive important updates via email</p>
                        </div>
                        <Switch
                          checked={notifications.email_notifications}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_notifications: checked }))}
                        />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Weekly Reports</Label>
                          <p className="text-xs text-muted-foreground">Weekly summary of referrals and performance</p>
                        </div>
                        <Switch
                          checked={notifications.weekly_reports}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, weekly_reports: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Monthly Reports</Label>
                          <p className="text-xs text-muted-foreground">Monthly analytics and insights</p>
                        </div>
                        <Switch
                          checked={notifications.monthly_reports}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, monthly_reports: checked }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">New Referral Alerts</Label>
                          <p className="text-xs text-muted-foreground">Get notified when referrals are added</p>
                        </div>
                        <Switch
                          checked={notifications.referral_alerts}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, referral_alerts: checked }))}
                        />
                      </div>
                      
                      <Button onClick={saveNotificationSettings} className="w-full">
                        Save Notification Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Team Management */}
              <TabsContent value="team" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <Label className="text-sm font-medium">Invite Team Member</Label>
                        <div className="space-y-3">
                          <Input
                            placeholder="Email address"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                          />
                          <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as UserRole)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Front Desk">Front Desk</SelectItem>
                              <SelectItem value="Marketing Rep">Marketing Rep</SelectItem>
                              <SelectItem value="Manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button onClick={inviteTeamMember} className="w-full gap-2">
                            <UserPlus className="h-4 w-4" />
                            Send Invitation
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-sm font-medium">Team Members</Label>
                        <div className="space-y-2 max-h-64 overflow-auto">
                          {teamMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No team members yet</p>
                          ) : (
                            teamMembers.map((member) => (
                              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                  <p className="text-sm font-medium">{member.email}</p>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{member.role}</Badge>
                                    <Badge variant={member.status === 'accepted' ? 'default' : 'outline'}>
                                      {member.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Data Management */}
              <TabsContent value="data" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Data Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <Card className="p-4">
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Export Data
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Download all your referral data in JSON format
                          </p>
                          <Button onClick={exportData} variant="outline" className="w-full">
                            Export All Data
                          </Button>
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            Import Data
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Import referral data from CSV or other systems
                          </p>
                          <Button variant="outline" className="w-full" disabled>
                            Coming Soon
                          </Button>
                        </div>
                      </Card>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="font-medium text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Danger Zone
                      </h4>
                      <div className="border border-destructive/20 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Delete All Data</p>
                            <p className="text-sm text-muted-foreground">Permanently delete all referral data. This cannot be undone.</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Data
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete all your referral data, sources, and analytics.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground">
                                  Delete Everything
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Security Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Change Password</Label>
                        <div className="flex gap-2 mt-2">
                          <div className="relative flex-1">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter new password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          <Button onClick={updatePassword} disabled={!newPassword}>
                            Update
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Two-Factor Authentication</Label>
                          <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          Setup 2FA
                        </Button>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <Label className="text-sm font-medium">Account Actions</Label>
                        <div className="flex gap-3">
                          <Button variant="outline" onClick={signOut} className="gap-2">
                            <Lock className="h-4 w-4" />
                            Sign Out
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
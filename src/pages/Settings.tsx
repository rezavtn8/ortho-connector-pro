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
import { ClinicAddressSearch } from '@/components/ClinicAddressSearch';
import { SecuritySettings } from '@/components/SecuritySettings';
import { SecurityAuditLog } from '@/components/SecurityAuditLog';
import { sanitizeText, sanitizePhone, sanitizeEmail } from '@/lib/sanitize';
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
  Loader2,
  Edit,
  Settings as SettingsIcon
} from 'lucide-react';

type UserRole = 'Front Desk' | 'Marketing Rep' | 'Manager';

interface ClinicSettings {
  clinic_name: string;
  clinic_phone: string;
  clinic_address: string;
  clinic_city: string;
  clinic_state: string;
  clinic_zip: string;
  google_place_id: string;
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
  clinic_zip: '',
  google_place_id: ''
};

const initialNotificationSettings: NotificationSettings = {
  email_notifications: true,
  weekly_reports: true,
  monthly_reports: true,
  referral_alerts: true
};

export function Settings() {
  // Redirect to resilient settings
  window.location.replace('/settings-resilient');
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(initialClinicSettings);
  const [notifications, setNotifications] = useState<NotificationSettings>(initialNotificationSettings);
  const [profile, setProfile] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('Front Desk');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingClinic, setEditingClinic] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSettings();
      
      // Load user profile data
      supabase
        .from('user_profiles')
        .select('first_name, last_name, phone, job_title, email, degrees')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setProfile(data);
          }
        });
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
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profile?.clinic_id) {
        // Load full clinic details
        const { data: clinic } = await supabase
          .from('clinics')
          .select('*')
          .eq('id', profile.clinic_id)
          .maybeSingle();
        
        if (clinic) {
          setClinicSettings({
            clinic_name: clinic.name || '',
            clinic_phone: '', // Not stored in clinics table
            clinic_address: clinic.address || '',
            clinic_city: '',
            clinic_state: '',
            clinic_zip: '',
            google_place_id: clinic.google_place_id || ''
          });
        }
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

  const saveProfileSettings = async () => {
    if (!user?.id || !profile) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          job_title: profile.job_title,
          degrees: profile.degrees,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setEditingProfile(false);
      toast({
        title: 'Success',
        description: 'Profile settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to save profile settings',
        variant: 'destructive',
      });
    }
  };

  const cancelProfileEdit = () => {
    setEditingProfile(false);
    // Reload profile data to reset any changes
    if (user?.id) {
      supabase
        .from('user_profiles')
        .select('first_name, last_name, phone, job_title, email, degrees')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setProfile(data);
          }
        });
    }
  };

  const saveClinicSettings = async () => {
    if (!user?.id) return;
    
    // Sanitize all clinic settings inputs
    const sanitizedSettings = {
      clinic_name: sanitizeText(clinicSettings.clinic_name),
      clinic_address: sanitizeText(clinicSettings.clinic_address),
      google_place_id: sanitizeText(clinicSettings.google_place_id)
    };

    // Validate required fields
    if (!sanitizedSettings.clinic_name) {
      toast({
        title: "Error",
        description: "Clinic name is required and cannot contain invalid characters",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Get user's profile to check for existing clinic
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let clinicId = profile?.clinic_id;

      if (clinicId) {
        // Update existing clinic
        const { error: clinicError } = await supabase
          .from('clinics')
          .update({
            name: sanitizedSettings.clinic_name,
            address: sanitizedSettings.clinic_address,
            google_place_id: sanitizedSettings.google_place_id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', clinicId);

        if (clinicError) throw clinicError;
      } else {
        // Create new clinic
        const { data: newClinic, error: createError } = await supabase
          .from('clinics')
          .insert({
            name: clinicSettings.clinic_name,
            address: clinicSettings.clinic_address,
            google_place_id: clinicSettings.google_place_id || null,
            owner_id: user.id
          })
          .select()
          .single();

        if (createError) throw createError;
        clinicId = newClinic.id;
      }

      // Update user profile with clinic info
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ 
          clinic_id: clinicId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      setEditingClinic(false);
      toast({
        title: 'Success',
        description: 'Clinic settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save clinic settings',
        variant: 'destructive',
      });
    }
  };

  const cancelClinicEdit = () => {
    setEditingClinic(false);
    // Reload clinic settings
    loadSettings();
  };

  const saveNotificationSettings = async () => {
    // Store notification settings in localStorage for now
    localStorage.setItem('notification_settings', JSON.stringify(notifications));
    
    toast({
      title: 'Success',
      description: 'Notification preferences saved',
    });
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
      {/* Header */}
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Settings</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage your account and clinic preferences
        </p>
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
              </div>

              {/* System Settings */}
              <div className="w-full">
                <div className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider border-t pt-4">
                  System
                </div>
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
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        User Profile
                      </div>
                      {!editingProfile ? (
                        <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={cancelProfileEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveProfileSettings}>
                            Save
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!editingProfile ? (
                      /* Display Mode */
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                            <p className="text-base font-medium">{profile?.first_name || 'Not set'}</p>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                            <p className="text-base font-medium">{profile?.last_name || 'Not set'}</p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                            <p className="text-base font-medium">{profile?.phone || 'Not set'}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Job Title</Label>
                            <p className="text-base font-medium">{profile?.job_title || 'Not set'}</p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Degrees</Label>
                            <p className="text-base font-medium">{profile?.degrees || 'Not set'}</p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                            <p className="text-base font-medium">{user?.email}</p>
                            <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Edit Mode */
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="first_name">First Name *</Label>
                            <Input
                              id="first_name"
                              value={profile?.first_name || ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
                              placeholder="Enter your first name..."
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name *</Label>
                            <Input
                              id="last_name"
                              value={profile?.last_name || ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
                              placeholder="Enter your last name..."
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                              id="phone"
                              value={profile?.phone || ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="(555) 123-4567"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="job_title">Job Title</Label>
                            <Input
                              id="job_title"
                              value={profile?.job_title || ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, job_title: e.target.value }))}
                              placeholder="e.g., Dentist, Office Manager, etc."
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="degrees">Degrees</Label>
                            <Input
                              id="degrees"
                              value={profile?.degrees || ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, degrees: e.target.value }))}
                              placeholder="e.g., DDS, MS, MDS"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              value={user?.email || ''}
                              disabled
                              className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">
                              Email address cannot be changed. Contact support if you need to update this.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Clinic Settings */}
              <TabsContent value="clinic" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Clinic Information
                      </div>
                      {!editingClinic ? (
                        <Button variant="outline" size="sm" onClick={() => setEditingClinic(true)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={cancelClinicEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={saveClinicSettings}>
                            Save
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!editingClinic ? (
                      /* Display Mode */
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Clinic Name</Label>
                            <p className="text-base font-medium">{clinicSettings.clinic_name || 'Not set'}</p>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                            <p className="text-base font-medium">{clinicSettings.clinic_phone || 'Not set'}</p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                            <p className="text-base font-medium">{clinicSettings.clinic_address || 'Not set'}</p>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-sm font-medium text-muted-foreground">Google Place ID</Label>
                            <p className="text-base font-medium text-xs font-mono bg-muted px-2 py-1 rounded">
                              {clinicSettings.google_place_id || 'Not set'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Edit Mode */
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
                            <ClinicAddressSearch
                              value={clinicSettings.clinic_address}
                              onSelect={(place) => {
                                if (place) {
                                  setClinicSettings(prev => ({
                                    ...prev,
                                    clinic_address: place.address || '',
                                    google_place_id: place.google_place_id || ''
                                  }));
                                }
                              }}
                              placeholder="Search for your clinic address..."
                            />
                            <p className="text-xs text-muted-foreground">
                              Search for your clinic to automatically get the Google Place ID for reviews
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="google_place_id">Google Place ID</Label>
                            <Input
                              id="google_place_id"
                              value={clinicSettings.google_place_id}
                              onChange={(e) => setClinicSettings(prev => ({ ...prev, google_place_id: e.target.value }))}
                              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                            />
                            <p className="text-xs text-muted-foreground">
                              Automatically filled when using address search above, or enter manually
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
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
                          <p className="text-xs text-muted-foreground">Receive email updates about important events</p>
                        </div>
                        <Switch
                          checked={notifications.email_notifications}
                          onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_notifications: checked }))}
                        />
                      </div>
                      
                      <Button onClick={saveNotificationSettings} className="w-full">
                        Save Notification Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security" className="mt-0 space-y-6">
                <SecuritySettings />
                <SecurityAuditLog />
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  MapPin, Save, Crosshair, AlertCircle, CheckCircle, User, Bell, 
  Users, Database, Shield, Key, CreditCard, Download, Upload,
  Trash2, Eye, EyeOff, Mail, Phone, Settings2, Globe, Lock,
  UserPlus, Crown, Edit, Copy
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AddressSearch } from '@/components/AddressSearch';

type UserRole = 'Front Desk' | 'Owner' | 'Marketing Rep' | 'Manager';

interface ClinicSettings {
  clinic_name: string;
  clinic_address: string;
  clinic_latitude: number | null;
  clinic_longitude: number | null;
}

interface UserProfile {
  email: string;
  role: string;
  pin_code: string;
}

interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  weekly_reports: boolean;
  monthly_reports: boolean;
  referral_alerts: boolean;
  goal_reminders: boolean;
}

interface TeamMember {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  created_at: string;
}

export function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('clinic');
  
  // Clinic Settings State
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>({
    clinic_name: '',
    clinic_address: '',
    clinic_latitude: null,
    clinic_longitude: null,
  });
  
  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>({
    email: '',
    role: '',
    pin_code: '',
  });
  
  // Notification Settings State
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_notifications: true,
    sms_notifications: false,
    weekly_reports: true,
    monthly_reports: true,
    referral_alerts: true,
    goal_reminders: false,
  });
  
  // Team Management State
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('Front Desk');
  
  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
  useEffect(() => {
    if (user) {
      loadAllSettings();
    }
  }, [user]);

  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadClinicSettings(),
        loadUserProfile(),
        loadTeamMembers()
      ]);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClinicSettings = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('clinic_name, clinic_address, clinic_latitude, clinic_longitude')
      .eq('user_id', user?.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (data) {
      setClinicSettings({
        clinic_name: data.clinic_name || '',
        clinic_address: data.clinic_address || '',
        clinic_latitude: data.clinic_latitude ? Number(data.clinic_latitude) : null,
        clinic_longitude: data.clinic_longitude ? Number(data.clinic_longitude) : null,
      });
    }
  };

  const loadUserProfile = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('email, role, pin_code')
      .eq('user_id', user?.id)
      .maybeSingle();

    if (data) {
      setUserProfile({
        email: data.email || user?.email || '',
        role: data.role || 'Front Desk',
        pin_code: data.pin_code || '',
      });
    }
  };

  const loadTeamMembers = async () => {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setTeamMembers(data);
    }
  };

  const getCurrentLocation = () => {
    setIsLocating(true);
    
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Please enter coordinates manually.",
        variant: "destructive",
      });
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setClinicSettings(prev => ({
          ...prev,
          clinic_latitude: position.coords.latitude,
          clinic_longitude: position.coords.longitude,
        }));
        setIsLocating(false);
        toast({
          title: "Location detected",
          description: "Your current location has been set.",
        });
      },
      (error) => {
        setIsLocating(false);
        toast({
          title: "Location access denied",
          description: "Please enter coordinates manually or check location permissions.",
          variant: "destructive",
        });
      }
    );
  };

  const saveClinicSettings = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication error",
        description: "Please log in to save your settings.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      // Check if user profile exists first
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id, clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let clinicId = existingProfile?.clinic_id;

      // If no clinic exists, create one
      if (!clinicId) {
        const { data: newClinic, error: clinicError } = await supabase
          .from('clinics')
          .insert({
            name: clinicSettings.clinic_name || 'My Clinic',
            address: clinicSettings.clinic_address || '',
            latitude: clinicSettings.clinic_latitude,
            longitude: clinicSettings.clinic_longitude,
            owner_id: user.id
          })
          .select('id')
          .single();

        if (clinicError) {
          console.error('Clinic creation error:', clinicError);
          throw clinicError;
        }
        clinicId = newClinic.id;
      } else {
        // Update existing clinic
        const { error: clinicUpdateError } = await supabase
          .from('clinics')
          .update({
            name: clinicSettings.clinic_name,
            address: clinicSettings.clinic_address,
            latitude: clinicSettings.clinic_latitude,
            longitude: clinicSettings.clinic_longitude,
          })
          .eq('id', clinicId);

        if (clinicUpdateError) throw clinicUpdateError;
      }

      if (!existingProfile) {
        // Create user profile
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user?.id,
            email: user?.email || '',
            clinic_id: clinicId,
            clinic_name: clinicSettings.clinic_name,
            clinic_address: clinicSettings.clinic_address,
            clinic_latitude: clinicSettings.clinic_latitude,
            clinic_longitude: clinicSettings.clinic_longitude,
          });

        if (insertError) throw insertError;
      } else {
        // Update existing profile
        const { error } = await supabase
          .from('user_profiles')
          .update({
            clinic_id: clinicId,
            clinic_name: clinicSettings.clinic_name,
            clinic_address: clinicSettings.clinic_address,
            clinic_latitude: clinicSettings.clinic_latitude,
            clinic_longitude: clinicSettings.clinic_longitude,
          })
          .eq('user_id', user?.id);

        if (error) throw error;
      }

      toast({
        title: "Clinic settings saved",
        description: "Your clinic information has been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      toast({
        title: "Error saving settings",
        description: "Could not save your clinic settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveUserProfile = async () => {
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          pin_code: userProfile.pin_code,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile settings have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error updating profile",
        description: "Could not save your profile settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setNewPassword('');
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error updating password",
        description: "Could not update your password.",
        variant: "destructive",
      });
    }
  };

  const inviteTeamMember = async () => {
    if (!newMemberEmail || !newMemberRole) {
      toast({
        title: "Missing information",
        description: "Please provide both email and role.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get user's clinic ID from their profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('clinic_id')
        .eq('user_id', user?.id)
        .single();

      const clinicId = profile?.clinic_id || 'default';

      const { error } = await supabase
        .from('user_invitations')
        .insert({
          email: newMemberEmail,
          role: newMemberRole,
          invited_by: user?.id,
          clinic_id: clinicId
        });

      if (error) throw error;

      setNewMemberEmail('');
      setNewMemberRole('Front Desk');
      await loadTeamMembers();
      
      toast({
        title: "Invitation sent",
        description: `Team member invitation sent to ${newMemberEmail}`,
      });
    } catch (error) {
      toast({
        title: "Error sending invitation",
        description: "Could not send the team member invitation.",
        variant: "destructive",
      });
    }
  };

  const exportData = async () => {
    try {
      // Export patient sources data
      const { data: sources } = await supabase
        .from('patient_sources')
        .select('*');
      
      // Export monthly patients data
      const { data: monthlyData } = await supabase
        .from('monthly_patients')
        .select('*');

      const exportData = {
        exported_at: new Date().toISOString(),
        patient_sources: sources || [],
        monthly_patients: monthlyData || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `referral-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Data exported",
        description: "Your data has been exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not export your data.",
        variant: "destructive",
      });
    }
  };

  const hasLocation = clinicSettings.clinic_latitude && clinicSettings.clinic_longitude;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings2 className="w-8 h-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your clinic settings, team, and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Modern Horizontal Tabs */}
        <div className="border-b border-border mb-8">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto p-1 bg-muted/50">
            <TabsTrigger 
              value="clinic" 
              className="flex flex-col items-center gap-2 py-3 px-2 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <MapPin className="h-5 w-5" />
              <span className="hidden sm:block">Clinic</span>
            </TabsTrigger>
            <TabsTrigger 
              value="profile" 
              className="flex flex-col items-center gap-2 py-3 px-2 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <User className="h-5 w-5" />
              <span className="hidden sm:block">Profile</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="flex flex-col items-center gap-2 py-3 px-2 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <Bell className="h-5 w-5" />
              <span className="hidden sm:block">Notifications</span>
            </TabsTrigger>
            <TabsTrigger 
              value="team" 
              className="flex flex-col items-center gap-2 py-3 px-2 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <Users className="h-5 w-5" />
              <span className="hidden sm:block">Team</span>
            </TabsTrigger>
            <TabsTrigger 
              value="data" 
              className="flex flex-col items-center gap-2 py-3 px-2 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <Database className="h-5 w-5" />
              <span className="hidden sm:block">Data</span>
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="flex flex-col items-center gap-2 py-3 px-2 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <Shield className="h-5 w-5" />
              <span className="hidden sm:block">Security</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {/* Clinic Settings */}
          {activeTab === 'clinic' && (
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
                      <Label htmlFor="clinic_address">Clinic Address *</Label>
                      <AddressSearch
                        value={clinicSettings.clinic_address}
                        onSelect={(office) => {
                          if (office) {
                            setClinicSettings(prev => ({
                              ...prev,
                              clinic_address: office.address || office.name || '',
                              clinic_latitude: office.latitude,
                              clinic_longitude: office.longitude
                            }));
                          }
                        }}
                        placeholder="Search for your clinic address..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="latitude">Latitude</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          value={clinicSettings.clinic_latitude || ''}
                          onChange={(e) => setClinicSettings(prev => ({ 
                            ...prev, 
                            clinic_latitude: e.target.value ? Number(e.target.value) : null 
                          }))}
                          placeholder="40.7128"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="longitude">Longitude</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          value={clinicSettings.clinic_longitude || ''}
                          onChange={(e) => setClinicSettings(prev => ({ 
                            ...prev, 
                            clinic_longitude: e.target.value ? Number(e.target.value) : null 
                          }))}
                          placeholder="-74.0060"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={getCurrentLocation}
                      disabled={isLocating}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Crosshair className="h-4 w-4" />
                      {isLocating ? 'Detecting Location...' : 'Use Current Location'}
                    </Button>

                    <div className="flex items-center gap-2">
                      {hasLocation ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Location coordinates set</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm text-yellow-600">Location required for map features</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Location Preview */}
                  <div className="space-y-2">
                    <Label>Location Preview</Label>
                    <div className="h-64 rounded-lg overflow-hidden border">
                      {hasLocation ? (
                        <div className="flex items-center justify-center h-full bg-muted text-muted-foreground">
                          <div className="text-center">
                            <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
                            <p className="text-sm font-medium">{clinicSettings.clinic_name}</p>
                            <p className="text-xs mt-1">Lat: {clinicSettings.clinic_latitude}, Lng: {clinicSettings.clinic_longitude}</p>
                            <p className="text-xs mt-2 text-blue-600">Visit Maps tab to view full map</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full bg-muted flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <MapPin className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-sm">Set coordinates to preview location</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button 
                    onClick={saveClinicSettings} 
                    disabled={isSaving}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Clinic Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input value={userProfile.email} disabled />
                      <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Current Role</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant={userProfile.role === 'Owner' ? 'default' : 'secondary'}>
                          {userProfile.role === 'Owner' && <Crown className="h-3 w-3 mr-1" />}
                          {userProfile.role}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pin_code">PIN Code (Optional)</Label>
                      <Input
                        id="pin_code"
                        type="password"
                        value={userProfile.pin_code}
                        onChange={(e) => setUserProfile(prev => ({ ...prev, pin_code: e.target.value }))}
                        placeholder="Enter 4-6 digit PIN..."
                        maxLength={6}
                      />
                      <p className="text-xs text-muted-foreground">For quick access and security</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={saveUserProfile} disabled={isSaving} className="gap-2">
                    <Save className="h-4 w-4" />
                    Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Management */}
          {activeTab === 'team' && (
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
          )}

          {/* Data Management */}
          {activeTab === 'data' && (
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
          )}

          {/* Security */}
          {activeTab === 'security' && (
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
          )}
        </div>
      </Tabs>
    </div>
  );
}
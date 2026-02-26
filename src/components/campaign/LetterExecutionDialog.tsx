import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  FileText, Wand2, RefreshCw, ChevronLeft, ChevronRight, Download,
  Settings2, ChevronDown, ChevronUp, Pencil, Check, X, Loader2, Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  email_settings?: any;
}

interface CachedLetterTemplates {
  templates: { tier: string; body: string }[];
  generated_at: string;
}

interface LetterDelivery {
  id: string;
  office_id: string;
  email_body?: string;
  email_status: string;
  referral_tier?: string;
  office: {
    name: string;
    address?: string;
    source_type: string;
    email?: string;
  };
  primary_contact?: string;
}

interface LetterStyle {
  fontFamily: string;
  fontSize: number;
  headingColor: string;
  showLogo: boolean;
  marginSize: 'compact' | 'standard' | 'generous';
}

interface LetterExecutionDialogProps {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignUpdated: () => void;
}

const FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: '"Garamond", "EB Garamond", serif', label: 'Garamond' },
  { value: '"Palatino Linotype", Palatino, serif', label: 'Palatino' },
  { value: 'system-ui, -apple-system, sans-serif', label: 'System Sans' },
  { value: '"Segoe UI", Roboto, sans-serif', label: 'Segoe UI' },
];

const MARGIN_OPTIONS = {
  compact: { x: 40, y: 40, label: 'Compact' },
  standard: { x: 60, y: 60, label: 'Standard' },
  generous: { x: 80, y: 80, label: 'Generous' },
};

export function LetterExecutionDialog({ campaign, open, onOpenChange, onCampaignUpdated }: LetterExecutionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [deliveries, setDeliveries] = useState<LetterDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [cachedTemplates, setCachedTemplates] = useState<CachedLetterTemplates | null>(null);

  const [senderContext, setSenderContext] = useState({
    sender_name: '', sender_degrees: '', sender_title: '', clinic_name: '', clinic_address: '', logo_url: '' as string | null,
  });

  const [style, setStyle] = useState<LetterStyle>({
    fontFamily: 'Georgia, serif',
    fontSize: 12,
    headingColor: '#1a365d',
    showLogo: true,
    marginSize: 'standard',
  });

  // Progress tracking
  const readyCount = useMemo(() => deliveries.filter(d => d.email_status === 'ready' || d.email_body).length, [deliveries]);
  const progressPercent = deliveries.length > 0 ? Math.round((readyCount / deliveries.length) * 100) : 0;

  // Tier distribution
  const tierDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    deliveries.forEach(d => {
      const tier = d.referral_tier || 'Unknown';
      counts[tier] = (counts[tier] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [deliveries]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !deliveries.length) return;
    const handler = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(i => i - 1);
        setEditing(false);
      }
      if (e.key === 'ArrowRight' && currentIndex < deliveries.length - 1) {
        setCurrentIndex(i => i + 1);
        setEditing(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, deliveries.length, currentIndex, editing]);

  useEffect(() => {
    if (open && campaign) {
      fetchDeliveries();
      fetchBranding();
      loadCachedTemplates();
    }
  }, [open, campaign]);

  const loadCachedTemplates = async () => {
    if (!campaign) return;
    try {
      const { data } = await supabase
        .from('campaigns')
        .select('email_settings')
        .eq('id', campaign.id)
        .single();
      const settings = data?.email_settings as any;
      if (settings?.letter_templates?.templates?.length) {
        setCachedTemplates(settings.letter_templates);
      } else {
        setCachedTemplates(null);
      }
    } catch {
      setCachedTemplates(null);
    }
  };

  const saveCachedTemplates = async (templates: { tier: string; body: string }[]) => {
    if (!campaign) return;
    const letterTemplates: CachedLetterTemplates = {
      templates,
      generated_at: new Date().toISOString(),
    };
    setCachedTemplates(letterTemplates);
    await supabase
      .from('campaigns')
      .update({ email_settings: { letter_templates: letterTemplates } as any })
      .eq('id', campaign.id);
  };

  const applyTemplates = async (templates: { tier: string; body: string }[]) => {
    if (!deliveries.length || !templates.length) return;
    setGenerating(true);
    try {
      const tierTemplates = new Map<string, string>();
      templates.forEach(t => tierTemplates.set(t.tier, t.body));

      for (const delivery of deliveries) {
        const tier = delivery.referral_tier || 'Cold';
        let template = tierTemplates.get(tier) || tierTemplates.values().next().value || '';
        const info = extractDoctorInfo(delivery);
        const body = template
          .replace(/\{\{doctor_name\}\}/g, info.displayName)
          .replace(/\{\{office_name\}\}/g, delivery.office.name)
          .replace(/\{\{clinic_name\}\}/g, senderContext.clinic_name)
          .replace(/\{\{sender_name\}\}/g, senderContext.sender_name);

        await supabase.from('campaign_deliveries')
          .update({ email_body: body, email_status: 'ready' })
          .eq('id', delivery.id);
      }
      await fetchDeliveries();
      toast({ title: "Templates Applied", description: `${deliveries.length} letters personalized from cached templates` });
    } catch (err: any) {
      toast({ title: "Apply Failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const fetchBranding = async () => {
    if (!user) return;
    const [profileRes, clinicRes, brandRes] = await Promise.all([
      supabase.from('user_profiles').select('first_name, last_name, degrees, job_title').eq('user_id', user.id).single(),
      supabase.from('clinics').select('name, address').eq('owner_id', user.id).maybeSingle(),
      supabase.from('clinic_brand_settings').select('logo_url, brand_name').limit(1).maybeSingle(),
    ]);
    const p = profileRes.data;
    const c = clinicRes.data;
    const b = brandRes.data;
    setSenderContext({
      sender_name: `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Doctor',
      sender_degrees: p?.degrees || '',
      sender_title: p?.job_title || '',
      clinic_name: c?.name || b?.brand_name || 'Our Practice',
      clinic_address: c?.address || '',
      logo_url: b?.logo_url || null,
    });
  };

  const fetchDeliveries = async () => {
    if (!campaign || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_deliveries')
        .select(`*, office:patient_sources (name, address, source_type, email)`)
        .eq('campaign_id', campaign.id)
        .eq('created_by', user.id)
        .order('created_at');
      if (error) throw error;

      const officeIds = (data || []).map((d: any) => d.office_id);
      const { data: contacts } = await supabase
        .from('office_contacts')
        .select('office_id, name, is_primary')
        .in('office_id', officeIds)
        .eq('user_id', user.id);

      const contactMap = new Map<string, string>();
      contacts?.forEach((c: any) => {
        if (c.is_primary || !contactMap.has(c.office_id)) {
          contactMap.set(c.office_id, c.name);
        }
      });

      setDeliveries((data || []).map((d: any) => ({
        ...d,
        primary_contact: contactMap.get(d.office_id) || undefined,
      })));
    } catch {
      toast({ title: "Error", description: "Failed to load deliveries.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateLetters = async () => {
    if (!deliveries.length) return;
    setGenerating(true);
    try {
      const uniqueTiers = [...new Set(deliveries.map(d => d.referral_tier || 'Cold'))];
      const { data, error } = await supabase.functions.invoke('generate-campaign-letters', {
        body: { tiers: uniqueTiers, campaign_type: campaign.campaign_type, campaign_name: campaign.name },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Generation failed');

      const tierTemplates = new Map<string, string>();
      data.letters.forEach((l: any) => tierTemplates.set(l.tier, l.body));

      // Cache the raw tier templates in the campaign
      await saveCachedTemplates(data.letters);

      if (data.context) {
        setSenderContext(prev => ({
          ...prev,
          sender_name: data.context.sender_name || prev.sender_name,
          sender_degrees: data.context.sender_degrees || prev.sender_degrees,
          sender_title: data.context.sender_title || prev.sender_title,
          clinic_name: data.context.clinic_name || prev.clinic_name,
        }));
      }

      for (const delivery of deliveries) {
        const tier = delivery.referral_tier || 'Cold';
        let template = tierTemplates.get(tier) || tierTemplates.values().next().value || '';

        const info = extractDoctorInfo(delivery);
        const body = template
          .replace(/\{\{doctor_name\}\}/g, info.displayName)
          .replace(/\{\{office_name\}\}/g, delivery.office.name)
          .replace(/\{\{clinic_name\}\}/g, senderContext.clinic_name)
          .replace(/\{\{sender_name\}\}/g, senderContext.sender_name);

        await supabase.from('campaign_deliveries')
          .update({ email_body: body, email_status: 'ready' })
          .eq('id', delivery.id);
      }

      await fetchDeliveries();
      toast({ title: "Letters Generated", description: `${deliveries.length} personalized letters ready` });
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const extractDoctorInfo = (delivery: LetterDelivery): { displayName: string; salutation: string } => {
    if (delivery.primary_contact) {
      const name = delivery.primary_contact.trim();
      if (/^dr\.?\s/i.test(name)) {
        const lastName = name.replace(/^dr\.?\s*/i, '').split(' ').pop() || name;
        return { displayName: name, salutation: `Dear ${name},` };
      }
      const lastName = name.split(' ').pop() || name;
      return { displayName: `Dr. ${lastName}`, salutation: `Dear Dr. ${lastName},` };
    }
    const drMatch = delivery.office.name.match(/Dr\.?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (drMatch) {
      const extracted = drMatch[1].trim().split(' ').pop()!;
      return { displayName: `Dr. ${extracted}`, salutation: `Dear Dr. ${extracted},` };
    }
    // No doctor name found — use friendly fallback
    return { displayName: delivery.office.name, salutation: `Dear Friends at ${delivery.office.name},` };
  };

  const current = deliveries[currentIndex];
  const lettersGenerated = deliveries.some(d => d.email_body);

  const saveEdit = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await supabase.from('campaign_deliveries').update({ email_body: editedBody }).eq('id', current.id);
      setEditing(false);
      await fetchDeliveries();
      toast({ title: "Letter Updated" });
    } finally {
      setSaving(false);
    }
  };

  // PDF Export
  const exportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageW = 612;
      const pageH = 792;
      const margin = MARGIN_OPTIONS[style.marginSize];
      const contentW = pageW - margin.x * 2;

      let logoData: string | null = null;
      if (style.showLogo && senderContext.logo_url) {
        try {
          const res = await fetch(senderContext.logo_url);
          const blob = await res.blob();
          logoData = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { /* skip logo */ }
      }

      // Map web fonts to jsPDF built-in fonts
      const getJsPDFFont = (fontFamily: string): string => {
        const lower = fontFamily.toLowerCase();
        if (/georgia|times|garamond|palatino|serif/i.test(lower)) return 'times';
        if (/courier|mono/i.test(lower)) return 'courier';
        return 'helvetica';
      };
      const pdfFont = getJsPDFFont(style.fontFamily);

      // Preview-matched relative sizes
      const headingFontSize = style.fontSize * 1.3;
      const dateFontSize = style.fontSize * 0.85;
      const addressFontSize = style.fontSize * 0.9;
      const smallFontSize = style.fontSize * 0.75;
      const lineHeight = style.fontSize * 1.6;

      // Logo max dimensions matching preview w-14 h-14 (56px ≈ 42pt)
      const logoMaxPt = 42;

      for (let i = 0; i < deliveries.length; i++) {
        if (i > 0) doc.addPage();
        const d = deliveries[i];
        let y = margin.y;

        doc.setFont(pdfFont, 'normal');

        if (logoData) {
          // Preserve aspect ratio: fit within logoMaxPt box
          let logoW = logoMaxPt;
          let logoH = logoMaxPt;
          try {
            const img = doc.getImageProperties(logoData);
            const aspect = img.width / img.height;
            if (aspect > 1) { logoH = logoMaxPt / aspect; } else { logoW = logoMaxPt * aspect; }
          } catch {}
          try { doc.addImage(logoData, 'PNG', margin.x, y + (logoMaxPt - logoH) / 2, logoW, logoH); } catch {}
          const textX = margin.x + logoMaxPt + 12;
          doc.setFontSize(headingFontSize);
          doc.setFont(pdfFont, 'bold');
          doc.setTextColor(style.headingColor);
          doc.text(senderContext.clinic_name, textX, y + headingFontSize);
          doc.setFontSize(smallFontSize);
          doc.setFont(pdfFont, 'normal');
          doc.setTextColor('#888888');
          if (senderContext.clinic_address) doc.text(senderContext.clinic_address, textX, y + headingFontSize + smallFontSize + 4);
          y += logoMaxPt + 12;
        } else {
          doc.setFontSize(headingFontSize);
          doc.setFont(pdfFont, 'bold');
          doc.setTextColor(style.headingColor);
          doc.text(senderContext.clinic_name, margin.x, y + headingFontSize);
          doc.setFontSize(smallFontSize);
          doc.setFont(pdfFont, 'normal');
          doc.setTextColor('#888888');
          if (senderContext.clinic_address) { y += headingFontSize + 6; doc.text(senderContext.clinic_address, margin.x, y + smallFontSize); }
          y += smallFontSize + 16;
        }

        doc.setDrawColor('#dddddd');
        doc.line(margin.x, y, pageW - margin.x, y);
        y += 16;

        // Date
        doc.setFontSize(dateFontSize);
        doc.setFont(pdfFont, 'normal');
        doc.setTextColor('#555555');
        doc.text(format(new Date(), 'MMMM d, yyyy'), margin.x, y + dateFontSize);
        y += dateFontSize + 20;

        // Recipient address block
    const info = extractDoctorInfo(d);
        doc.setFontSize(addressFontSize);
        doc.setTextColor('#333333');
        // Only show displayName if it's different from office name (i.e. a doctor was found)
        if (info.displayName !== d.office.name) {
          doc.text(info.displayName, margin.x, y); y += addressFontSize + 4;
        }
        doc.text(d.office.name, margin.x, y); y += addressFontSize + 4;
        if (d.office.address) {
          const addrLines = doc.splitTextToSize(d.office.address, contentW);
          addrLines.forEach((line: string) => { doc.text(line, margin.x, y); y += addressFontSize + 4; });
        }
        y += 12;

        // Salutation
        doc.setFontSize(style.fontSize);
        doc.setFont(pdfFont, 'normal');
        doc.setTextColor('#111111');
        doc.text(info.salutation, margin.x, y);
        y += lineHeight + 4;

        // Body
        if (d.email_body) {
          const paragraphs = d.email_body.split(/\n\n+/);
          for (const para of paragraphs) {
            const lines = doc.splitTextToSize(para.trim(), contentW);
            for (const line of lines) {
              if (y > pageH - margin.y - 60) { doc.addPage(); y = margin.y; }
              doc.text(line, margin.x, y);
              y += lineHeight;
            }
            y += lineHeight * 0.5;
          }
        }

        // Signature
        y += lineHeight;
        if (y > pageH - margin.y - 50) { doc.addPage(); y = margin.y; }
        doc.text('Sincerely,', margin.x, y); y += lineHeight * 1.5;
        const sigLine = senderContext.sender_degrees
          ? `${senderContext.sender_name}, ${senderContext.sender_degrees}`
          : senderContext.sender_name;
        doc.setFont(pdfFont, 'bold');
        doc.text(sigLine, margin.x, y); y += lineHeight;
        doc.setFont(pdfFont, 'normal');
        if (senderContext.sender_title) { doc.text(senderContext.sender_title, margin.x, y); y += lineHeight; }
        doc.text(senderContext.clinic_name, margin.x, y);
      }

      const dateStr = format(new Date(), 'yyyy-MM-dd');
      doc.save(`${campaign.name.replace(/[^a-zA-Z0-9]/g, '_')}_letters_${dateStr}.pdf`);
      toast({ title: "PDF Exported", description: `${deliveries.length} letters exported` });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  }, [deliveries, style, senderContext, campaign]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {campaign.name} - Letters
          </DialogTitle>
          <DialogDescription>
            Generate personalized letters for {deliveries.length} offices, preview, and export as PDF
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        {deliveries.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {readyCount} of {deliveries.length} letters ready
              </span>
              <Badge variant={readyCount === deliveries.length ? 'default' : 'secondary'} className="text-xs">
                {progressPercent}%
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Controls Bar */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex flex-wrap items-center gap-2">
            {!lettersGenerated ? (
              <div className="flex items-center gap-2">
                {cachedTemplates ? (
                  <>
                    <Button onClick={() => applyTemplates(cachedTemplates.templates)} disabled={generating || !deliveries.length} className="gap-2">
                      <Wand2 className="w-4 h-4" /> {generating ? 'Applying...' : 'Apply Cached Templates'}
                    </Button>
                    <Button variant="outline" onClick={generateLetters} disabled={generating || !deliveries.length} className="gap-2">
                      <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Generate New
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Cached {new Date(cachedTemplates.generated_at).toLocaleDateString()}
                    </span>
                  </>
                ) : (
                  <Button onClick={generateLetters} disabled={generating || !deliveries.length} className="gap-2">
                    <Wand2 className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate Letters'}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={generateLetters} disabled={generating} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} /> Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={exportPdf} disabled={exportingPdf} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(!settingsOpen)} className="gap-1.5">
              <Settings2 className="w-3.5 h-3.5" /> Style
              {settingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>

          {/* Style Settings */}
          <Collapsible open={settingsOpen}>
            <CollapsibleContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t">
                <div>
                  <Label className="text-xs">Font</Label>
                  <Select value={style.fontFamily} onValueChange={v => setStyle(s => ({ ...s, fontFamily: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Font Size</Label>
                  <Select value={String(style.fontSize)} onValueChange={v => setStyle(s => ({ ...s, fontSize: Number(v) }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 11, 12, 13, 14].map(s => <SelectItem key={s} value={String(s)}>{s}pt</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Heading Color</Label>
                  <Input type="color" value={style.headingColor} onChange={e => setStyle(s => ({ ...s, headingColor: e.target.value }))} className="h-8 p-1" />
                </div>
                <div>
                  <Label className="text-xs">Margins</Label>
                  <Select value={style.marginSize} onValueChange={(v: any) => setStyle(s => ({ ...s, marginSize: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARGIN_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Switch checked={style.showLogo} onCheckedChange={v => setStyle(s => ({ ...s, showLogo: v }))} />
                  <Label className="text-xs">Show Logo</Label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Letter Preview */}
        <ScrollArea className="flex-1 min-h-0">
          {loading || generating ? (
            <div className="text-center py-16">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{generating ? 'Generating personalized letters...' : 'Loading...'}</p>
            </div>
          ) : !lettersGenerated ? (
            <div className="text-center py-12 space-y-4">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No letters generated yet</h3>
              <p className="text-sm text-muted-foreground">Click "Generate Letters" to create AI-powered tier-based letters</p>
              
              {/* Tier Distribution Preview */}
              {tierDistribution.length > 0 && (
                <div className="max-w-sm mx-auto mt-4 p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Office Tier Distribution</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {tierDistribution.map(([tier, count]) => (
                      <Badge key={tier} variant="outline" className="text-xs gap-1">
                        {tier}: {count}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {tierDistribution.length} unique tier{tierDistribution.length !== 1 ? 's' : ''} → {tierDistribution.length} AI call{tierDistribution.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          ) : current ? (
            <div className="space-y-3">
              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" disabled={currentIndex === 0} onClick={() => { setCurrentIndex(i => i - 1); setEditing(false); }}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <span className="text-sm font-medium">{current.office.name}</span>
                  <p className="text-xs text-muted-foreground">
                    Letter {currentIndex + 1} of {deliveries.length}
                    {current.referral_tier && <Badge variant="outline" className="ml-2 text-xs">{current.referral_tier}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">← → arrow keys to navigate</p>
                </div>
                <Button variant="ghost" size="sm" disabled={currentIndex === deliveries.length - 1} onClick={() => { setCurrentIndex(i => i + 1); setEditing(false); }}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Styled Letter Preview */}
              <Card className="mx-auto max-w-[680px] shadow-lg">
                <CardContent className="p-0">
                  <div
                    style={{
                      fontFamily: style.fontFamily,
                      fontSize: `${style.fontSize}px`,
                      padding: `${MARGIN_OPTIONS[style.marginSize].y}px ${MARGIN_OPTIONS[style.marginSize].x}px`,
                      lineHeight: 1.6,
                      color: '#111',
                      minHeight: '600px',
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-4 pb-4 mb-4" style={{ borderBottom: '1px solid #ddd' }}>
                      {style.showLogo && senderContext.logo_url && (
                        <img src={senderContext.logo_url} alt="Logo" className="w-14 h-14 object-contain rounded" />
                      )}
                      <div>
                        <div style={{ color: style.headingColor, fontSize: '1.3em', fontWeight: 700 }}>
                          {senderContext.clinic_name}
                        </div>
                        {senderContext.clinic_address && (
                          <div style={{ fontSize: '0.75em', color: '#888' }}>{senderContext.clinic_address}</div>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: '0.85em', color: '#555', marginBottom: '20px' }}>
                      {format(new Date(), 'MMMM d, yyyy')}
                    </div>

                    {/* Recipient */}
                    <div style={{ fontSize: '0.9em', marginBottom: '20px', lineHeight: 1.5 }}>
                      {extractDoctorInfo(current).displayName !== current.office.name && (
                        <div>{extractDoctorInfo(current).displayName}</div>
                      )}
                      <div>{current.office.name}</div>
                      {current.office.address && <div>{current.office.address}</div>}
                    </div>

                    {/* Salutation */}
                    <div style={{ marginBottom: '16px' }}>
                      {extractDoctorInfo(current).salutation}
                    </div>

                    {/* Body */}
                    {editing ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editedBody}
                          onChange={e => setEditedBody(e.target.value)}
                          rows={12}
                          style={{ fontFamily: style.fontFamily, fontSize: `${style.fontSize}px` }}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={saving} className="gap-1">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {saving ? 'Saving...' : 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving} className="gap-1">
                            <X className="w-3 h-3" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer hover:bg-muted/20 rounded p-1 -m-1 transition-colors group relative"
                        onClick={() => { setEditing(true); setEditedBody(current.email_body || ''); }}
                      >
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge variant="secondary" className="text-xs gap-1"><Pencil className="w-3 h-3" /> Click to edit</Badge>
                        </div>
                        {current.email_body?.split(/\n\n+/).map((para, i) => (
                          <p key={i} style={{ marginBottom: '12px' }}>{para}</p>
                        ))}
                      </div>
                    )}

                    {/* Signature */}
                    <div style={{ marginTop: '32px' }}>
                      <div>Sincerely,</div>
                      <div style={{ marginTop: '24px', fontWeight: 600 }}>
                        {senderContext.sender_degrees
                          ? `${senderContext.sender_name}, ${senderContext.sender_degrees}`
                          : senderContext.sender_name}
                      </div>
                      {senderContext.sender_title && <div style={{ fontSize: '0.9em' }}>{senderContext.sender_title}</div>}
                      <div style={{ fontSize: '0.9em' }}>{senderContext.clinic_name}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

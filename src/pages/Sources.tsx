import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Globe, MessageSquare, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

import { useSources } from '@/hooks/useSources';
import { useSourceOperations } from '@/hooks/useSourceOperations';
import { SourcesFilters } from '@/components/SourcesFilters';
import { SourcesTable } from '@/components/SourcesTable';
import { SourcesGrid } from '@/components/SourcesGrid';

export function Sources() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { sources, loading, loadData, getPatientCounts, filterSources } = useSources();
  
  const {
    selectedSources,
    editingSource,
    editForm,
    setEditForm,
    handleSelectAll,
    handleSelectSource,
    handleEditSource,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteSources,
    handleToggleActive
  } = useSourceOperations(loadData);

  const handleViewSource = (sourceId: string) => {
    navigate(`/sources/${sourceId}`);
  };

  const onlineSourceTypes = ['Google', 'Yelp', 'Website', 'Social Media'];
  const officeSourceTypes = ['Office'];
  const otherSourceTypes = ['Word of Mouth', 'Insurance', 'Other'];

  const renderSourceView = (sources: any[], title: string, icon: React.ElementType) => {
    const filteredSources = filterSources(sources, searchTerm, 
      title === 'Online Sources' ? onlineSourceTypes :
      title === 'Offices' ? officeSourceTypes : otherSourceTypes
    );

    const commonProps = {
      title,
      icon,
      sources: filteredSources,
      selectedSources,
      editingSource,
      editForm,
      loading,
      getPatientCounts,
      onSelectSource: handleSelectSource,
      onEditSource: handleEditSource,
      onSaveEdit: handleSaveEdit,
      onCancelEdit: handleCancelEdit,
      onDeleteSources: handleDeleteSources,
      onToggleActive: handleToggleActive,
      onEditFormChange: setEditForm,
      onUpdatePatients: loadData,
      onViewSource: handleViewSource
    };

    if (isMobile) {
      return <SourcesGrid {...commonProps} />;
    }

    return (
      <SourcesTable
        {...commonProps}
        onSelectAll={handleSelectAll}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-3 mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 title-icon" />
          <h1 className="text-4xl font-bold page-title">Patient Sources</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Manage your patient referral sources and track monthly performance
        </p>
      </div>

      <SourcesFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onDataChange={loadData}
      />

      <Tabs defaultValue="online" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="online" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Online Sources
          </TabsTrigger>
          <TabsTrigger value="offices" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Offices
          </TabsTrigger>
          <TabsTrigger value="other" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Other Sources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="online" className="mt-6">
          {renderSourceView(
            filterSources(sources, '', onlineSourceTypes),
            'Online Sources',
            Globe
          )}
        </TabsContent>

        <TabsContent value="offices" className="mt-6">
          {renderSourceView(
            filterSources(sources, '', officeSourceTypes),
            'Offices',
            Building2
          )}
        </TabsContent>

        <TabsContent value="other" className="mt-6">
          {renderSourceView(
            filterSources(sources, '', otherSourceTypes),
            'Other Sources',
            MessageSquare
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
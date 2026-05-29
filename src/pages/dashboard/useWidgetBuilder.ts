import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { DashboardWidgetType, UploadedFile } from '../../types';
import {
  BUILDER_TEMPLATE_LIBRARY,
  buildBuilderSources,
  pickDefaultBuilderFields,
  rankTemplatesForSource,
  type BuilderSource,
  type BuilderTemplateRanking,
} from './dashboardBuilder';

export interface WidgetBuilderState {
  pendingWidgetType: DashboardWidgetType | null;
  pendingSourceId: string | null;
  pendingTemplateId: string | null;
  builderPrimaryField: string;
  builderSecondaryField: string;
  builderTableFields: string[];
  availableSources: BuilderSource[];
  rankedTemplates: BuilderTemplateRanking[];
  selectedSource: BuilderSource | undefined;
  selectedTemplate: import('../../types').MockWidgetTemplate | null;
  setPendingWidgetType: (type: DashboardWidgetType | null) => void;
  setPendingSourceId: (id: string | null) => void;
  setPendingTemplateId: (id: string | null) => void;
  setBuilderPrimaryField: (field: string) => void;
  setBuilderSecondaryField: (field: string) => void;
  setBuilderTableFields: Dispatch<SetStateAction<string[]>>;
  open: (type: DashboardWidgetType) => void;
  close: () => void;
}

export function useWidgetBuilder(files: UploadedFile[]): WidgetBuilderState {
  const [pendingWidgetType, setPendingWidgetType] = useState<DashboardWidgetType | null>(null);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [builderPrimaryField, setBuilderPrimaryField] = useState('');
  const [builderSecondaryField, setBuilderSecondaryField] = useState('');
  const [builderTableFields, setBuilderTableFields] = useState<string[]>([]);

  const availableSources = buildBuilderSources(files);

  const selectedSource: BuilderSource | undefined = pendingSourceId
    ? availableSources.find(s => s.id === pendingSourceId)
    : undefined;

  const availableTemplates = pendingWidgetType && pendingSourceId
    ? BUILDER_TEMPLATE_LIBRARY.filter(t => t.paletteType === pendingWidgetType)
    : [];

  const rankedTemplates = selectedSource ? rankTemplatesForSource(selectedSource, availableTemplates) : [];

  const selectedTemplate = pendingTemplateId
    ? rankedTemplates.find(item => item.template.id === pendingTemplateId)?.template ?? null
    : rankedTemplates[0]?.template ?? null;

  useEffect(() => {
    if (!pendingSourceId) return;
    if (availableSources.some(s => s.id === pendingSourceId)) return;
    setPendingSourceId(null);
  }, [availableSources, pendingSourceId]);

  useEffect(() => {
    if (!selectedSource) {
      setPendingTemplateId(null);
      return;
    }
    if (pendingWidgetType && selectedSource.widgetTypes.includes(pendingWidgetType)) return;
    setPendingWidgetType(selectedSource.widgetTypes[0] ?? null);
  }, [selectedSource, pendingWidgetType]);

  useEffect(() => {
    if (rankedTemplates.length === 0) {
      setPendingTemplateId(null);
      return;
    }
    if (pendingTemplateId && rankedTemplates.some(item => item.template.id === pendingTemplateId)) return;
    setPendingTemplateId(rankedTemplates[0].template.id);
  }, [rankedTemplates, pendingTemplateId]);

  useEffect(() => {
    if (!selectedSource || !selectedTemplate) {
      setBuilderPrimaryField('');
      setBuilderSecondaryField('');
      setBuilderTableFields([]);
      return;
    }
    const defaults = pickDefaultBuilderFields(selectedSource, selectedTemplate);
    setBuilderPrimaryField(defaults.primary);
    setBuilderSecondaryField(defaults.secondary);
    setBuilderTableFields(defaults.tableColumns);
  }, [selectedSource?.id, selectedTemplate?.id]);

  const reset = () => {
    setPendingWidgetType(null);
    setPendingSourceId(null);
    setPendingTemplateId(null);
    setBuilderPrimaryField('');
    setBuilderSecondaryField('');
    setBuilderTableFields([]);
  };

  const open = (type: DashboardWidgetType) => {
    setPendingWidgetType(type);
    setPendingSourceId(null);
    setPendingTemplateId(null);
    setBuilderPrimaryField('');
    setBuilderSecondaryField('');
    setBuilderTableFields([]);
  };

  return {
    pendingWidgetType,
    pendingSourceId,
    pendingTemplateId,
    builderPrimaryField,
    builderSecondaryField,
    builderTableFields,
    availableSources,
    rankedTemplates,
    selectedSource,
    selectedTemplate,
    setPendingWidgetType,
    setPendingSourceId,
    setPendingTemplateId,
    setBuilderPrimaryField,
    setBuilderSecondaryField,
    setBuilderTableFields,
    open,
    close: reset,
  };
}

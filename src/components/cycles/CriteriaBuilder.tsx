import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  BookOpen,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { type CriteriaItem, type TierConfig, type MeasurementType, type DataSource } from '../../types/cycle';
import { cycleService } from '../../services/cycleService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIERS: TierConfig[] = [
  { id: crypto.randomUUID(), name: 'Needs Improvement', minScore: 0, maxScore: 49, incrementMin: 0, incrementMax: 3, color: '#EF4444' },
  { id: crypto.randomUUID(), name: 'Meets Expectations', minScore: 50, maxScore: 74, incrementMin: 3, incrementMax: 6, color: '#F59E0B' },
  { id: crypto.randomUUID(), name: 'Exceeds Expectations', minScore: 75, maxScore: 89, incrementMin: 6, incrementMax: 10, color: '#10B981' },
  { id: crypto.randomUUID(), name: 'Outstanding', minScore: 90, maxScore: 100, incrementMin: 10, incrementMax: 15, color: '#3B82F6' },
];

const TEMPLATES = [
  {
    name: 'Standard Performance',
    description: '5 balanced criteria covering KPI, attendance, peer review, manager rating, and learning',
    criteria: [
      { name: 'KPI Achievement', weight: 40, measurementType: 'percentage' as MeasurementType, dataSource: 'manager' as DataSource, description: 'Achievement against agreed KPIs', minValue: 0, maxValue: 100 },
      { name: 'Attendance', weight: 15, measurementType: 'percentage' as MeasurementType, dataSource: 'system' as DataSource, description: 'Attendance and punctuality record' },
      { name: 'Peer Review', weight: 20, measurementType: 'rating' as MeasurementType, dataSource: 'manager' as DataSource, description: 'Peer feedback and collaboration score', minValue: 1, maxValue: 5 },
      { name: 'Manager Rating', weight: 15, measurementType: 'rating' as MeasurementType, dataSource: 'manager' as DataSource, description: 'Direct manager performance rating', minValue: 1, maxValue: 5 },
      { name: 'Learning & Development', weight: 10, measurementType: 'boolean' as MeasurementType, dataSource: 'self' as DataSource, description: 'Completion of assigned training and development activities' },
    ],
  },
  {
    name: 'Sales Performance',
    description: '4 criteria focused on revenue, client acquisition, customer satisfaction, and collaboration',
    criteria: [
      { name: 'Revenue Target', weight: 50, measurementType: 'percentage' as MeasurementType, dataSource: 'system' as DataSource, description: 'Percentage of revenue target achieved', minValue: 0, maxValue: 200 },
      { name: 'New Clients', weight: 25, measurementType: 'numeric' as MeasurementType, dataSource: 'system' as DataSource, description: 'Number of new clients acquired', minValue: 0 },
      { name: 'Customer Satisfaction', weight: 15, measurementType: 'rating' as MeasurementType, dataSource: 'manager' as DataSource, description: 'Average customer satisfaction score', minValue: 1, maxValue: 10 },
      { name: 'Team Collaboration', weight: 10, measurementType: 'rating' as MeasurementType, dataSource: 'manager' as DataSource, description: 'Contribution to team goals', minValue: 1, maxValue: 5 },
    ],
  },
  {
    name: 'Technical Excellence',
    description: '4 criteria for engineering teams: code quality, delivery, innovation, and mentoring',
    criteria: [
      { name: 'Code Quality', weight: 35, measurementType: 'rating' as MeasurementType, dataSource: 'manager' as DataSource, description: 'Code review scores, test coverage, and technical debt reduction', minValue: 1, maxValue: 5 },
      { name: 'Project Delivery', weight: 30, measurementType: 'percentage' as MeasurementType, dataSource: 'system' as DataSource, description: 'On-time delivery rate for assigned projects', minValue: 0, maxValue: 100 },
      { name: 'Innovation', weight: 20, measurementType: 'rating' as MeasurementType, dataSource: 'manager' as DataSource, description: 'Contributions to process improvements and technical innovation', minValue: 1, maxValue: 5 },
      { name: 'Mentoring', weight: 15, measurementType: 'numeric' as MeasurementType, dataSource: 'self' as DataSource, description: 'Number of team members mentored', minValue: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Save indicator
// ---------------------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ---------------------------------------------------------------------------
// Sortable Criteria Card
// ---------------------------------------------------------------------------

interface CriteriaCardProps {
  item: CriteriaItem;
  onUpdate: (id: string, partial: Partial<CriteriaItem>) => void;
  onDelete: (id: string) => void;
}

function SortableCriteriaCard({ item, onUpdate, onDelete }: CriteriaCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [expanded, setExpanded] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dsColors: Record<DataSource, string> = {
    manager: 'bg-blue-100 text-blue-700',
    system: 'bg-emerald-100 text-emerald-700',
    self: 'bg-amber-100 text-amber-700',
  };

  const mtLabel: Record<MeasurementType, string> = {
    numeric: 'Numeric',
    boolean: 'Yes/No',
    rating: 'Rating',
    percentage: 'Percentage',
  };

  const showMinMax = item.measurementType === 'numeric' || item.measurementType === 'rating';

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 p-4">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Name */}
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate(item.id, { name: e.target.value })}
          className="flex-1 text-sm font-semibold text-slate-900 bg-transparent border-none outline-none focus:bg-slate-50 rounded px-1 py-0.5"
          placeholder="Criteria name"
        />

        {/* Weight */}
        <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg px-2 py-1">
          <input
            type="number"
            min={1}
            max={100}
            value={item.weight}
            onChange={(e) => onUpdate(item.id, { weight: Number(e.target.value) })}
            className="w-10 text-sm font-bold text-slate-900 text-center bg-transparent border-none outline-none"
          />
          <span className="text-sm text-slate-400">%</span>
        </div>

        {/* Badges */}
        <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
          {mtLabel[item.measurementType]}
        </span>
        <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${dsColors[item.dataSource]}`}>
          {item.dataSource}
        </span>

        {/* Expand / Delete */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Measurement Type</label>
              <select
                value={item.measurementType}
                onChange={(e) => onUpdate(item.id, { measurementType: e.target.value as MeasurementType })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="numeric">Numeric</option>
                <option value="boolean">Yes/No (Boolean)</option>
                <option value="rating">Rating</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data Source</label>
              <select
                value={item.dataSource}
                onChange={(e) => onUpdate(item.id, { dataSource: e.target.value as DataSource })}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="manager">Manager</option>
                <option value="system">System</option>
                <option value="self">Self</option>
              </select>
            </div>
          </div>

          {showMinMax && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Min Value</label>
                <input
                  type="number"
                  value={item.minValue ?? ''}
                  onChange={(e) => onUpdate(item.id, { minValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Max Value</label>
                <input
                  type="number"
                  value={item.maxValue ?? ''}
                  onChange={(e) => onUpdate(item.id, { maxValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
            <textarea
              value={item.description ?? ''}
              onChange={(e) => onUpdate(item.id, { description: e.target.value })}
              rows={2}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Describe what this criteria measures..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier Card
// ---------------------------------------------------------------------------

function TierCard({
  tier,
  onUpdate,
  onDelete,
}: {
  tier: TierConfig;
  onUpdate: (id: string, partial: Partial<TierConfig>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4" style={{ borderLeftColor: tier.color, borderLeftWidth: 4 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tier.color }} />
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={tier.name}
                onChange={(e) => onUpdate(tier.id, { name: e.target.value })}
                className="w-full text-sm font-semibold border-b border-emerald-400 bg-transparent outline-none"
                autoFocus
              />
            ) : (
              <p className="text-sm font-semibold text-slate-900 truncate">{tier.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing((e) => !e)}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {editing ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <span className="text-xs text-slate-400 underline">Edit</span>}
          </button>
          <button onClick={() => onDelete(tier.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500">Score Range</label>
            <div className="flex items-center gap-1 mt-0.5">
              <input type="number" min={0} max={100} value={tier.minScore}
                onChange={(e) => onUpdate(tier.id, { minScore: Number(e.target.value) })}
                className="w-14 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              <span className="text-xs text-slate-400">–</span>
              <input type="number" min={0} max={100} value={tier.maxScore}
                onChange={(e) => onUpdate(tier.id, { maxScore: Number(e.target.value) })}
                className="w-14 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Increment Range</label>
            <div className="flex items-center gap-1 mt-0.5">
              <input type="number" min={0} value={tier.incrementMin}
                onChange={(e) => onUpdate(tier.id, { incrementMin: Number(e.target.value) })}
                className="w-14 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              <span className="text-xs text-slate-400">–</span>
              <input type="number" min={0} value={tier.incrementMax}
                onChange={(e) => onUpdate(tier.id, { incrementMax: Number(e.target.value) })}
                className="w-14 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Color</label>
            <input type="color" value={tier.color}
              onChange={(e) => onUpdate(tier.id, { color: e.target.value })}
              className="mt-0.5 w-8 h-6 border border-slate-200 rounded cursor-pointer" />
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Score: <strong className="text-slate-700">{tier.minScore}%–{tier.maxScore}%</strong></span>
          <span>Increment: <strong className="text-slate-700">{tier.incrementMin}%–{tier.incrementMax}%</strong></span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Criteria Inline Form
// ---------------------------------------------------------------------------

function AddCriteriaForm({ onAdd, onCancel }: { onAdd: (c: Omit<CriteriaItem, 'id' | 'order'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(10);
  const [measurementType, setMeasurementType] = useState<MeasurementType>('rating');
  const [dataSource, setDataSource] = useState<DataSource>('manager');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!name.trim()) { toast.error('Criteria name is required.'); return; }
    if (weight < 1 || weight > 100) { toast.error('Weight must be between 1 and 100.'); return; }
    onAdd({ name: name.trim(), weight, measurementType, dataSource, description: description.trim() || undefined });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-900">New Criteria</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Criteria name" autoFocus
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2.5 bg-white">
          <input type="number" min={1} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))}
            className="w-10 text-sm font-bold text-center bg-transparent outline-none" />
          <span className="text-sm text-slate-400">%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={measurementType} onChange={(e) => setMeasurementType(e.target.value as MeasurementType)}
          className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option value="numeric">Numeric</option>
          <option value="boolean">Yes/No</option>
          <option value="rating">Rating</option>
          <option value="percentage">Percentage</option>
        </select>
        <select value={dataSource} onChange={(e) => setDataSource(e.target.value as DataSource)}
          className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option value="manager">Manager</option>
          <option value="system">System</option>
          <option value="self">Self</option>
        </select>
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500" />
      <div className="flex gap-2">
        <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
          <Check className="w-3.5 h-3.5" /> Add
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Modal
// ---------------------------------------------------------------------------

function TemplateModal({
  onSelect,
  onClose,
}: {
  onSelect: (criteria: Omit<CriteriaItem, 'id' | 'order'>[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg font-brand">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Use a Template</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {TEMPLATES.map((t, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer"
              onClick={() => onSelect(t.criteria)}>
              <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">{t.description}</p>
              <div className="space-y-1">
                {t.criteria.map((c, j) => (
                  <div key={j} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{c.name}</span>
                    <span className="font-semibold text-slate-900">{c.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee Preview Modal
// ---------------------------------------------------------------------------

function EmployeePreviewModal({ criteria, onClose }: { criteria: CriteriaItem[]; onClose: () => void }) {
  const mtLabel: Record<MeasurementType, string> = { numeric: 'Numeric', boolean: 'Yes/No', rating: 'Rating', percentage: 'Percentage' };
  const dsLabel: Record<DataSource, string> = { manager: 'Submitted by manager', system: 'Pulled from system', self: 'Self-reported' };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md font-brand">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Employee View Preview</h3>
            <p className="text-xs text-slate-500 mt-0.5">This is what employees will see</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {criteria.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No criteria added yet.</p>
          ) : (
            criteria.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                  <span className="text-xs font-bold text-emerald-600">{c.weight}%</span>
                </div>
                {c.description && <p className="text-xs text-slate-500 mb-2">{c.description}</p>}
                <div className="flex gap-2 text-xs text-slate-400">
                  <span>{mtLabel[c.measurementType]}</span>
                  <span>·</span>
                  <span>{dsLabel[c.dataSource]}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CriteriaBuilder
// ---------------------------------------------------------------------------

interface CriteriaBuilderProps {
  cycleId: string;
  initialCriteria: CriteriaItem[];
  initialTiers: TierConfig[];
}

export default function CriteriaBuilder({ cycleId, initialCriteria, initialTiers }: CriteriaBuilderProps) {
  const [criteria, setCriteria] = useState<CriteriaItem[]>(initialCriteria);
  const [tiers, setTiers] = useState<TierConfig[]>(
    initialTiers.length > 0 ? initialTiers : DEFAULT_TIERS
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const weightOk = Math.round(totalWeight) === 100;

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Auto-save (debounced 2s) — only if weights sum to 100
  const save = useCallback(
    async (c: CriteriaItem[], t: TierConfig[]) => {
      const total = c.reduce((s, x) => s + x.weight, 0);
      if (c.length > 0 && Math.round(total) !== 100) return; // don't save if invalid
      setSaveState('saving');
      try {
        await cycleService.updateCycleCriteria({ cycleId, criteria: c, tiers: t });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch {
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 3000);
      }
    },
    [cycleId]
  );

  const scheduleAutoSave = useCallback(
    (c: CriteriaItem[], t: TierConfig[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(c, t), 2000);
    },
    [save]
  );

  const updateCriteria = (next: CriteriaItem[]) => {
    setCriteria(next);
    scheduleAutoSave(next, tiers);
  };

  const updateTiers = (next: TierConfig[]) => {
    setTiers(next);
    scheduleAutoSave(criteria, next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = criteria.findIndex((c) => c.id === active.id);
      const newIndex = criteria.findIndex((c) => c.id === over.id);
      const reordered = arrayMove(criteria, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }));
      updateCriteria(reordered);
    }
  };

  const handleUpdateCriteria = (id: string, partial: Partial<CriteriaItem>) => {
    updateCriteria(criteria.map((c) => (c.id === id ? { ...c, ...partial } : c)));
  };

  const handleDeleteCriteria = (id: string) => {
    updateCriteria(criteria.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })));
  };

  const handleAddCriteria = (item: Omit<CriteriaItem, 'id' | 'order'>) => {
    const newItem: CriteriaItem = { ...item, id: crypto.randomUUID(), order: criteria.length };
    updateCriteria([...criteria, newItem]);
    setShowAddForm(false);
  };

  const handleApplyTemplate = (templateCriteria: Omit<CriteriaItem, 'id' | 'order'>[]) => {
    const newCriteria = templateCriteria.map((c, i) => ({ ...c, id: crypto.randomUUID(), order: i }));
    updateCriteria(newCriteria);
    setShowTemplateModal(false);
    toast.success('Template applied!');
  };

  const handleUpdateTier = (id: string, partial: Partial<TierConfig>) => {
    updateTiers(tiers.map((t) => (t.id === id ? { ...t, ...partial } : t)));
  };

  const handleDeleteTier = (id: string) => {
    updateTiers(tiers.filter((t) => t.id !== id));
  };

  const handleAddTier = () => {
    const newTier: TierConfig = {
      id: crypto.randomUUID(),
      name: 'New Tier',
      minScore: 0,
      maxScore: 50,
      incrementMin: 0,
      incrementMax: 5,
      color: '#6366F1',
    };
    updateTiers([...tiers, newTier]);
  };

  // Detect tier gaps
  const sortedTiers = [...tiers].sort((a, b) => a.minScore - b.minScore);
  const tierGaps: string[] = [];
  for (let i = 0; i < sortedTiers.length - 1; i++) {
    if (sortedTiers[i].maxScore < sortedTiers[i + 1].minScore) {
      tierGaps.push(`Gap: ${sortedTiers[i].maxScore}%–${sortedTiers[i + 1].minScore}% not covered`);
    }
  }

  const saveIndicator: Record<SaveState, string> = {
    idle: '',
    saving: 'Saving...',
    saved: '✓ Saved',
    error: 'Save failed',
  };

  return (
    <>
      <div className="flex justify-end mb-2 h-5">
        <span className={`text-xs font-medium ${
          saveState === 'saved' ? 'text-emerald-600' :
          saveState === 'error' ? 'text-red-500' :
          saveState === 'saving' ? 'text-slate-500' : ''
        }`}>
          {saveState === 'saving' && <Loader2 className="inline w-3 h-3 animate-spin mr-1" />}
          {saveIndicator[saveState]}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Criteria List */}
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Evaluation Criteria</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" /> Templates
              </button>
            </div>
          </div>

          {/* Weight summary bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Total Weight</span>
              <span className={`text-sm font-bold ${weightOk ? 'text-emerald-600' : 'text-red-500'}`}>
                {totalWeight} / 100%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${weightOk ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-red-400'}`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
            {!weightOk && criteria.length > 0 && (
              <p className="text-xs text-red-500 mt-2">
                Weights must sum to exactly 100% to publish. Currently at {totalWeight}%.
              </p>
            )}
          </div>

          {/* Drag-and-drop criteria list */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={criteria.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {criteria.map((item) => (
                  <SortableCriteriaCard
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateCriteria}
                    onDelete={handleDeleteCriteria}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add criteria form / button */}
          {showAddForm ? (
            <AddCriteriaForm onAdd={handleAddCriteria} onCancel={() => setShowAddForm(false)} />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Criteria
            </button>
          )}
        </div>

        {/* RIGHT — Tier Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Score Tiers</h3>
            <button
              onClick={handleAddTier}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tier
            </button>
          </div>

          {/* Gap warnings */}
          {tierGaps.map((gap, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <span className="font-bold">⚠</span>
              <span>{gap} — employees in this range won't receive an increment.</span>
            </div>
          ))}

          <div className="space-y-3">
            {tiers.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                No tiers configured. Add a tier above.
              </div>
            ) : (
              sortedTiers.map((tier) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  onUpdate={handleUpdateTier}
                  onDelete={handleDeleteTier}
                />
              ))
            )}
          </div>

          {/* Coverage summary */}
          {tiers.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-medium text-slate-600 mb-2">Score Coverage</p>
              <div className="h-3 bg-white border border-slate-200 rounded-full overflow-hidden flex">
                {sortedTiers.map((t) => (
                  <div
                    key={t.id}
                    title={`${t.name}: ${t.minScore}–${t.maxScore}%`}
                    style={{
                      width: `${t.maxScore - t.minScore}%`,
                      backgroundColor: t.color,
                      marginLeft: `${t.minScore === 0 || t === sortedTiers[0] ? 0 : 0}%`,
                    }}
                    className="opacity-80"
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showTemplateModal && (
        <TemplateModal
          onSelect={handleApplyTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
      {showPreviewModal && (
        <EmployeePreviewModal
          criteria={criteria}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </>
  );
}

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
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
  Plus,
  TrendingUp,
  Edit3,
  Users,
  Trash2,
  GripVertical,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowUpCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { type CareerPath, type CareerLevel, type Milestone, type EmployeeCareerMap } from '../../types/careerPath';
import { type Employee } from '../../types/employee';
import { type SalaryBand } from '../../types/salaryBand';
import {
  createCareerPath,
  updateCareerPath,
  assignCareerPath,
  approvePromotion,
} from '../../services/careerPathService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LevelFormData extends CareerLevel {}

interface PathFormData {
  name: string;
  description: string;
  isActive: boolean;
  levels: LevelFormData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyPath = (): PathFormData => ({
  name: '',
  description: '',
  isActive: true,
  levels: [createEmptyLevel(1), createEmptyLevel(2)],
});

function createEmptyLevel(number: number): LevelFormData {
  return {
    levelId: crypto.randomUUID(),
    levelNumber: number,
    title: '',
    salaryBandId: '',
    salaryBandName: '',
    requiredScore: 75,
    requiredCycles: 2,
    description: '',
    milestones: [],
  };
}

function createEmptyMilestone(): Milestone {
  return {
    milestoneId: crypto.randomUUID(),
    title: '',
    description: '',
    type: 'cycle_count',
    targetValue: 1,
  };
}

function renumberLevels(levels: LevelFormData[]): LevelFormData[] {
  return levels.map((l, i) => ({ ...l, levelNumber: i + 1 }));
}

// ---------------------------------------------------------------------------
// Sortable Level Row
// ---------------------------------------------------------------------------

interface SortableLevelRowProps {
  level: LevelFormData;
  index: number;
  salaryBands: SalaryBand[];
  onChange: (index: number, updates: Partial<LevelFormData>) => void;
  onDelete: (index: number) => void;
  canDelete: boolean;
  onAddMilestone: (levelIndex: number) => void;
  onUpdateMilestone: (levelIndex: number, mIndex: number, updates: Partial<Milestone>) => void;
  onDeleteMilestone: (levelIndex: number, mIndex: number) => void;
}

function SortableLevelRow({
  level,
  index,
  salaryBands,
  onChange,
  onDelete,
  canDelete,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
}: SortableLevelRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: level.levelId,
  });
  const [milestonesOpen, setMilestonesOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const usedBandIds = new Set<string>();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-2 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Level</label>
            <div className="px-2 py-2 bg-slate-50 rounded-lg text-sm font-bold text-slate-700 text-center">
              {level.levelNumber}
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
            <input
              type="text"
              value={level.title}
              onChange={(e) => onChange(index, { title: e.target.value })}
              placeholder="e.g. Junior Engineer"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Salary Band *</label>
            <select
              value={level.salaryBandId}
              onChange={(e) => {
                const band = salaryBands.find((b) => b.id === e.target.value);
                onChange(index, {
                  salaryBandId: e.target.value,
                  salaryBandName: band?.name || '',
                });
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select band</option>
              {salaryBands.map((band) => (
                <option key={band.id} value={band.id}>
                  {band.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Req. Score (0-100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={level.requiredScore}
              onChange={(e) => onChange(index, { requiredScore: Math.min(100, Math.max(0, Number(e.target.value))) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Req. Cycles</label>
            <input
              type="number"
              min={1}
              value={level.requiredCycles}
              onChange={(e) => onChange(index, { requiredCycles: Math.max(1, Number(e.target.value)) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="md:col-span-1 flex items-end justify-end">
            <button
              type="button"
              onClick={() => onDelete(index)}
              disabled={!canDelete}
              className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="pl-8">
        <input
          type="text"
          value={level.description}
          onChange={(e) => onChange(index, { description: e.target.value })}
          placeholder="Level description (optional)"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Milestones */}
      <div className="pl-8">
        <button
          type="button"
          onClick={() => setMilestonesOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          {milestonesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Milestones ({level.milestones.length})
        </button>

        <AnimatePresence>
          {milestonesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {level.milestones.map((m, mIdx) => (
                  <div key={m.milestoneId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => onUpdateMilestone(index, mIdx, { title: e.target.value })}
                      placeholder="Milestone title"
                      className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <select
                      value={m.type}
                      onChange={(e) => onUpdateMilestone(index, mIdx, { type: e.target.value as Milestone['type'] })}
                      className="px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="cycle_count">Cycle Count</option>
                      <option value="score_threshold">Score Threshold</option>
                      <option value="tenure_months">Tenure (months)</option>
                      <option value="manual">Manual</option>
                    </select>
                    <input
                      type="number"
                      value={m.targetValue}
                      onChange={(e) => onUpdateMilestone(index, mIdx, { targetValue: Number(e.target.value) })}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteMilestone(index, mIdx)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onAddMilestone(index)}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Milestone
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit Modal
// ---------------------------------------------------------------------------

function PathModal({
  isOpen,
  onClose,
  initialData,
  salaryBands,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData: PathFormData | null;
  salaryBands: SalaryBand[];
  onSubmit: (data: PathFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<PathFormData>(emptyPath());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(initialData ? { ...initialData, levels: initialData.levels.map((l) => ({ ...l })) } : emptyPath());
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, initialData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setForm((prev) => {
          const oldIndex = prev.levels.findIndex((l) => l.levelId === active.id);
          const newIndex = prev.levels.findIndex((l) => l.levelId === over.id);
          const moved = arrayMove(prev.levels, oldIndex, newIndex);
          return { ...prev, levels: renumberLevels(moved) };
        });
      }
    },
    []
  );

  const updateLevel = useCallback((index: number, updates: Partial<LevelFormData>) => {
    setForm((prev) => {
      const levels = [...prev.levels];
      levels[index] = { ...levels[index], ...updates };
      return { ...prev, levels };
    });
  }, []);

  const addLevel = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      levels: [...prev.levels, createEmptyLevel(prev.levels.length + 1)],
    }));
  }, []);

  const deleteLevel = useCallback((index: number) => {
    setForm((prev) => {
      const levels = prev.levels.filter((_, i) => i !== index);
      return { ...prev, levels: renumberLevels(levels) };
    });
  }, []);

  const addMilestone = useCallback((levelIndex: number) => {
    setForm((prev) => {
      const levels = [...prev.levels];
      levels[levelIndex] = {
        ...levels[levelIndex],
        milestones: [...levels[levelIndex].milestones, createEmptyMilestone()],
      };
      return { ...prev, levels };
    });
  }, []);

  const updateMilestone = useCallback((levelIndex: number, mIndex: number, updates: Partial<Milestone>) => {
    setForm((prev) => {
      const levels = [...prev.levels];
      const milestones = [...levels[levelIndex].milestones];
      milestones[mIndex] = { ...milestones[mIndex], ...updates };
      levels[levelIndex] = { ...levels[levelIndex], milestones };
      return { ...prev, levels };
    });
  }, []);

  const deleteMilestone = useCallback((levelIndex: number, mIndex: number) => {
    setForm((prev) => {
      const levels = [...prev.levels];
      const milestones = levels[levelIndex].milestones.filter((_, i) => i !== mIndex);
      levels[levelIndex] = { ...levels[levelIndex], milestones };
      return { ...prev, levels };
    });
  }, []);

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Path name is required.';
    if (form.levels.length < 2) return 'At least 2 levels are required.';
    for (let i = 0; i < form.levels.length; i++) {
      const l = form.levels[i];
      if (!l.title.trim()) return `Title is required for level ${i + 1}.`;
      if (!l.salaryBandId) return `Salary band is required for level ${i + 1}.`;
    }
    const bandIds = form.levels.map((l) => l.salaryBandId);
    const unique = new Set(bandIds);
    if (unique.size !== bandIds.length) return 'Duplicate salary bands are not allowed.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save career path.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 font-brand">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {initialData ? 'Edit Career Path' : 'Create Career Path'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Basic Info</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Path Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Engineering Track"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>

          {/* Levels Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Levels</h3>
              <button
                type="button"
                onClick={addLevel}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Level
              </button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={form.levels.map((l) => l.levelId)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {form.levels.map((level, idx) => (
                    <SortableLevelRow
                      key={level.levelId}
                      level={level}
                      index={idx}
                      salaryBands={salaryBands}
                      onChange={updateLevel}
                      onDelete={deleteLevel}
                      canDelete={form.levels.length > 2}
                      onAddMilestone={addMilestone}
                      onUpdateMilestone={updateMilestone}
                      onDeleteMilestone={deleteMilestone}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? 'Saving...' : initialData ? 'Update Path' : 'Create Path'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign Modal
// ---------------------------------------------------------------------------

function AssignModal({
  isOpen,
  onClose,
  path,
  employees,
}: {
  isOpen: boolean;
  onClose: () => void;
  path: CareerPath | null;
  employees: Employee[];
}) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && path && path.levels.length > 0) {
      setSelectedLevelId(path.levels[0].levelId);
    } else {
      setSelectedLevelId('');
    }
    setSelectedEmployeeId('');
    setSearch('');
    setSubmitting(false);
  }, [isOpen, path]);

  const filteredEmployees = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        (e.departmentName || '').toLowerCase().includes(term)
    );
  }, [employees, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !path) return;
    setSubmitting(true);
    try {
      await assignCareerPath(selectedEmployeeId, path.id, selectedLevelId || undefined);
      toast.success('Career path assigned successfully.');
      setSelectedEmployeeId('');
      setSearch('');
      // Keep modal open for multiple assignments
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign career path.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !path) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 font-brand">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Assign Career Path</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Path</label>
            <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
              {path.name}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
              {filteredEmployees.length === 0 ? (
                <div className="p-3 text-sm text-slate-500 text-center">No employees found.</div>
              ) : (
                filteredEmployees.map((emp) => (
                  <button
                    key={emp.uid}
                    type="button"
                    onClick={() => setSelectedEmployeeId(emp.uid)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                      selectedEmployeeId === emp.uid ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-slate-500">
                        {emp.departmentName || 'No department'} • {emp.salaryBandName || 'No band'}
                      </div>
                    </div>
                    {selectedEmployeeId === emp.uid && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Starting Level *</label>
            <select
              value={selectedLevelId}
              onChange={(e) => setSelectedLevelId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {path.levels.map((l) => (
                <option key={l.levelId} value={l.levelId}>
                  Level {l.levelNumber}: {l.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Done
            </button>
            <button
              type="submit"
              disabled={!selectedEmployeeId || submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Assign
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assign Path to Employee Modal (from table)
// ---------------------------------------------------------------------------

function AssignPathToEmployeeModal({
  isOpen,
  onClose,
  employee,
  careerPaths,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  careerPaths: CareerPath[];
}) {
  const [selectedPathId, setSelectedPathId] = useState(() =>
    careerPaths.length > 0 ? careerPaths[0].id : ''
  );
  const [selectedLevelId, setSelectedLevelId] = useState(() =>
    careerPaths.length > 0 ? careerPaths[0].levels[0]?.levelId || '' : ''
  );
  const [submitting, setSubmitting] = useState(false);

  const selectedPath = careerPaths.find((p) => p.id === selectedPathId);

  useEffect(() => {
    if (selectedPath && selectedPath.levels.length > 0) {
      const hasCurrentLevel = selectedPath.levels.some((l) => l.levelId === selectedLevelId);
      if (!hasCurrentLevel) {
        setSelectedLevelId(selectedPath.levels[0].levelId);
      }
    }
  }, [selectedPathId, selectedPath, selectedLevelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !selectedPathId) return;
    setSubmitting(true);
    try {
      await assignCareerPath(employee.uid, selectedPathId, selectedLevelId || undefined);
      toast.success(`Career path assigned to ${employee.name}.`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign career path.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 font-brand">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Assign Career Path</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-900">
              {employee.name} <span className="text-slate-500 font-normal">({employee.departmentName || 'No department'})</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Career Path *</label>
            {careerPaths.length === 0 ? (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                No career paths available. Create one first.
              </div>
            ) : (
              <select
                value={selectedPathId}
                onChange={(e) => setSelectedPathId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>Select a career path</option>
                {careerPaths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Starting Level *</label>
            <select
              value={selectedLevelId}
              onChange={(e) => setSelectedLevelId(e.target.value)}
              disabled={!selectedPath}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="" disabled>Select a level</option>
              {selectedPath?.levels.map((l) => (
                <option key={l.levelId} value={l.levelId}>
                  Level {l.levelNumber}: {l.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedPathId || submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Assign Path
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const CareerPathManagement: React.FC = () => {
  const { user } = useAuth();
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeMaps, setEmployeeMaps] = useState<Map<string, EmployeeCareerMap>>(new Map());
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPathModal, setShowPathModal] = useState(false);
  const [editingPath, setEditingPath] = useState<CareerPath | null>(null);
  const [assigningPath, setAssigningPath] = useState<CareerPath | null>(null);
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null);
  const [promotingEmployeeId, setPromotingEmployeeId] = useState<string | null>(null);

  // Fetch career paths
  useEffect(() => {
    if (!user?.companyId) return;
    const q = query(collection(db, 'companies', user.companyId, 'careerPaths'));
    const unsub = onSnapshot(q, (snap) => {
      const paths = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CareerPath));
      setCareerPaths(paths);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.companyId]);

  // Fetch employees
  useEffect(() => {
    if (!user?.companyId) return;
    const q = query(
      collection(db, 'users'),
      where('companyId', '==', user.companyId),
      where('status', '==', 'active')
    );
    const unsub = onSnapshot(q, (snap) => {
      const emps = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as Employee));
      setEmployees(emps);
    });
    return () => unsub();
  }, [user?.companyId]);

  // Fetch salary bands
  useEffect(() => {
    if (!user?.companyId) return;
    getDocs(collection(db, 'companies', user.companyId, 'salaryBands'))
      .then((snap) => {
        setSalaryBands(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SalaryBand)));
      })
      .catch((err) => {
        console.error('Failed to fetch salary bands:', err);
        toast.error('Failed to load salary bands.');
      });
  }, [user?.companyId]);

  // Fetch career maps for employees
  useEffect(() => {
    if (employees.length === 0) {
      setEmployeeMaps(new Map());
      return;
    }

    const fetchMaps = async () => {
      const maps = new Map<string, EmployeeCareerMap>();
      await Promise.all(
        employees.map(async (emp) => {
          const snap = await getDoc(doc(db, 'users', emp.uid, 'careerMap', 'current'));
          if (snap.exists()) {
            maps.set(emp.uid, snap.data() as EmployeeCareerMap);
          }
        })
      );
      setEmployeeMaps(maps);
    };

    fetchMaps();
  }, [employees]);

  const handleCreate = async (form: PathFormData) => {
    if (!user?.companyId) return;
    await createCareerPath(form);
    toast.success('Career path created successfully.');
  };

  const handleUpdate = async (form: PathFormData) => {
    if (!editingPath) return;
    await updateCareerPath(editingPath.id, form);
    toast.success('Career path updated successfully.');
  };

  const handlePromote = async (empId: string) => {
    const map = employeeMaps.get(empId);
    if (!map?.nextLevelId) return;
    setPromotingEmployeeId(empId);
    try {
      await approvePromotion(empId, map.nextLevelId);
      toast.success('Promotion approved successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve promotion.';
      toast.error(msg);
    } finally {
      setPromotingEmployeeId(null);
    }
  };

  const activeEmployees = employees.filter((e) => e.role === 'employee');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-brand pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Career Path Management</h1>
          <p className="text-sm text-slate-500 mt-1">Define progression tracks and manage employee advancement.</p>
        </div>
        <button
          onClick={() => {
            setEditingPath(null);
            setShowPathModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Create Career Path
        </button>
      </div>

      {/* Career Paths Grid */}
      {careerPaths.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-700">No career paths defined yet.</p>
          <p className="text-sm text-slate-500 mt-1">Create your first career path to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {careerPaths.map((path) => (
            <div
              key={path.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-slate-900">{path.name}</h3>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    path.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {path.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{path.description || 'No description.'}</p>
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  {path.levels.length} levels
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingPath(path);
                    setShowPathModal(true);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => setAssigningPath(path)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                >
                  <Users className="w-3.5 h-3.5" /> Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Employee Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Employee Career Map Overview</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Career Path</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Current Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Next Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeEmployees.map((emp) => {
                const map = employeeMaps.get(emp.uid);
                const canPromote =
                  map &&
                  map.nextLevelId &&
                  map.progressPercent >= 100 &&
                  map.completedCyclesAtLevel >= map.nextRequiredCycles;

                return (
                  <tr key={emp.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{emp.name}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.departmentName || '—'}</td>
                    <td className="px-4 py-3">
                      {map ? (
                        <span className="text-slate-700">{map.careerPathName}</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          No path assigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{map?.currentLevelTitle || '—'}</td>
                    <td className="px-4 py-3">
                      {map ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, map.progressPercent)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{map.progressPercent}%</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{map?.nextLevelTitle || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!map && (
                          <button
                            onClick={() => setAssigningEmployee(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Assign Path
                          </button>
                        )}
                        {canPromote && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Approve promotion for ${emp.name} to ${map.nextLevelTitle}?`)) {
                                handlePromote(emp.uid);
                              }
                            }}
                            disabled={promotingEmployeeId === emp.uid}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {promotingEmployeeId === emp.uid ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                            )}
                            Promote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {activeEmployees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No active employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <PathModal
        isOpen={showPathModal}
        onClose={() => setShowPathModal(false)}
        initialData={
          editingPath
            ? {
                name: editingPath.name,
                description: editingPath.description,
                isActive: editingPath.isActive,
                levels: editingPath.levels.map((l) => ({ ...l })),
              }
            : null
        }
        salaryBands={salaryBands}
        onSubmit={editingPath ? handleUpdate : handleCreate}
      />

      <AssignModal
        isOpen={!!assigningPath}
        onClose={() => setAssigningPath(null)}
        path={assigningPath}
        employees={activeEmployees}
      />

      <AssignPathToEmployeeModal
        key={assigningEmployee?.uid || 'closed'}
        isOpen={!!assigningEmployee}
        onClose={() => setAssigningEmployee(null)}
        employee={assigningEmployee}
        careerPaths={careerPaths}
      />
    </div>
  );
};

export default CareerPathManagement;

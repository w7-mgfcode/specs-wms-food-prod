import { useState } from 'react';
import { useProductionStore } from '../../stores/useProductionStore';
import type { QCGate } from '../../types/scenario';
import { cn } from '../../lib/utils';

interface EditingGate {
    id: number | string;
    nameEn: string;
    nameHu: string;
    type: string;
    isCcp: boolean;
    checklist: string[];
}

export function QCGatesManager() {
    const { scenario, addQCGate, updateQCGate, deleteQCGate } = useProductionStore();
    const [editingGate, setEditingGate] = useState<EditingGate | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<number | string | null>(null);

    const qcGates = scenario?.config?.qcGates || [];

    const handleEdit = (gate: QCGate) => {
        setEditingGate({
            id: gate.id,
            nameEn: gate.name?.en || '',
            nameHu: gate.name?.hu || '',
            type: gate.type || 'oPRP',
            isCcp: gate.type?.includes('CCP') || false,
            checklist: (gate as any).checklist || []
        });
        setShowAddForm(false);
    };

    const handleSave = () => {
        if (!editingGate) return;

        updateQCGate(editingGate.id, {
            name: { en: editingGate.nameEn, hu: editingGate.nameHu },
            type: editingGate.isCcp ? 'CCP/oPRP' : 'oPRP'
        } as any);

        setEditingGate(null);
    };

    const handleAddGate = () => {
        addQCGate({
            name: { en: 'New Gate', hu: 'Új Kapu' },
            type: 'oPRP'
        });
        setShowAddForm(false);
    };

    const handleDelete = (id: number | string) => {
        deleteQCGate(id);
        setConfirmDelete(null);
    };

    const handleAddChecklistItem = () => {
        if (!editingGate || !newChecklistItem.trim()) return;

        setEditingGate({
            ...editingGate,
            checklist: [...editingGate.checklist, newChecklistItem.trim()]
        });
        setNewChecklistItem('');
    };

    const handleRemoveChecklistItem = (index: number) => {
        if (!editingGate) return;

        setEditingGate({
            ...editingGate,
            checklist: editingGate.checklist.filter((_, i) => i !== index)
        });
    };

    const getGateTypeColor = (type: string) => {
        if (type?.includes('CCP')) return 'border-red-500/50 bg-red-900/20 text-red-400';
        return 'border-yellow-500/50 bg-yellow-900/20 text-yellow-400';
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <h4 className="font-bold text-yellow-400">QC GATES CONFIGURATION</h4>
                </div>
                <button
                    onClick={() => { setShowAddForm(true); setEditingGate(null); }}
                    className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/50 rounded-lg text-sm font-semibold transition-all flex items-center gap-1"
                >
                    <span>+</span> Add Gate
                </button>
            </div>

            {/* Add New Gate Form */}
            {showAddForm && (
                <div className="bg-slate-800/80 rounded-lg p-4 border border-yellow-500/30 animate-fadeIn">
                    <h5 className="font-semibold text-white mb-3">Add New QC Gate</h5>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddGate}
                            className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-semibold transition-colors"
                        >
                            Create Gate
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Gates List */}
            <div className="space-y-2">
                {qcGates.length === 0 ? (
                    <div className="text-center text-slate-500 py-8 italic">
                        No QC Gates configured. Click "Add Gate" to create one.
                    </div>
                ) : (
                    qcGates.map((gate: QCGate) => (
                        <div key={gate.id} className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            {/* Gate Header - Always visible */}
                            <div className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-slate-400">#{gate.id}</span>
                                    <span className="font-semibold text-white">{gate.name?.en || 'Unnamed'}</span>
                                    <span className={cn("text-xs px-2 py-0.5 rounded border font-mono", getGateTypeColor(gate.type))}>
                                        {gate.type || 'oPRP'}
                                    </span>
                                    {gate.type?.includes('CCP') && (
                                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded font-bold">
                                            ⚠️ CCP
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(gate)}
                                        className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                                        title="Edit"
                                    >
                                        ✏️
                                    </button>
                                    {confirmDelete === gate.id ? (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleDelete(gate.id)}
                                                className="px-2 py-1 bg-red-600 text-white rounded text-xs font-bold"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(null)}
                                                className="px-2 py-1 bg-slate-600 text-white rounded text-xs"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDelete(gate.id)}
                                            className="p-1.5 hover:bg-red-900/50 rounded transition-colors text-slate-400 hover:text-red-400"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Edit Form - Expandable */}
                            {editingGate?.id === gate.id && (
                                <div className="p-4 border-t border-slate-700 bg-slate-900/50 space-y-4 animate-fadeIn">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-400 block mb-1">Name (English)</label>
                                            <input
                                                value={editingGate.nameEn}
                                                onChange={(e) => setEditingGate({ ...editingGate, nameEn: e.target.value })}
                                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 block mb-1">Name (Hungarian)</label>
                                            <input
                                                value={editingGate.nameHu}
                                                onChange={(e) => setEditingGate({ ...editingGate, nameHu: e.target.value })}
                                                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div>
                                            <label className="text-xs text-slate-400 block mb-1">Gate Type</label>
                                            <select
                                                value={editingGate.type}
                                                onChange={(e) => setEditingGate({ ...editingGate, type: e.target.value })}
                                                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                                            >
                                                <option value="oPRP">oPRP (Operational)</option>
                                                <option value="CCP/oPRP">CCP/oPRP (Critical)</option>
                                                <option value="CHECKPOINT">CHECKPOINT</option>
                                                <option value="BLOCKING">BLOCKING</option>
                                                <option value="INFO">INFO</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-400">Critical Control Point (CCP):</label>
                                            <button
                                                onClick={() => setEditingGate({ ...editingGate, isCcp: !editingGate.isCcp })}
                                                className={cn(
                                                    "w-10 h-5 rounded-full transition-all",
                                                    editingGate.isCcp ? "bg-red-500" : "bg-slate-600"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5",
                                                    editingGate.isCcp ? "translate-x-5" : "translate-x-0"
                                                )} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Checklist Editor */}
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-2">Checklist Items</label>
                                        <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                                            {editingGate.checklist.map((item, index) => (
                                                <div key={index} className="flex items-center gap-2 bg-slate-800 rounded p-2">
                                                    <span className="text-slate-300 text-sm flex-1">{item}</span>
                                                    <button
                                                        onClick={() => handleRemoveChecklistItem(index)}
                                                        className="text-red-400 hover:text-red-300 text-xs"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                value={newChecklistItem}
                                                onChange={(e) => setNewChecklistItem(e.target.value)}
                                                placeholder="Add checklist item..."
                                                className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-yellow-500 focus:outline-none"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                                            />
                                            <button
                                                onClick={handleAddChecklistItem}
                                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                                            >
                                                + Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Save/Cancel */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleSave}
                                            className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-semibold transition-colors"
                                        >
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => setEditingGate(null)}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* CCP Warning Note */}
            {qcGates.some((g: QCGate) => g.type?.includes('CCP')) && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
                    <strong>⚠️ CCP Gates Active:</strong> Critical Control Points require temperature verification
                    and cannot be bypassed without manager override.
                </div>
            )}
        </div>
    );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { qcDecisionSchema, type QCDecisionInput } from '../../lib/schemas';
import { useProductionStore } from '../../stores/useProductionStore';
import { cn } from '../../lib/utils';
import type { Database } from '../../types/database.types';

type QCGate = Database['public']['Tables']['qc_gates']['Row'];

interface Props {
    gate: QCGate;
    lotId: string;
}

export function QCDecisionPanel({ gate, lotId }: Props) {
    const { addQCDecision, activeRun } = useProductionStore();
    const [expanded, setExpanded] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<QCDecisionInput>({
        resolver: zodResolver(qcDecisionSchema),
        defaultValues: {
            gateId: gate.id,
            lotId: lotId,
            decision: undefined
        }
    });

    const currentDecision = watch('decision');

    const onSubmit = async (data: QCDecisionInput) => {
        if (!activeRun) return;

        try {
            await addQCDecision({
                lot_id: data.lotId,
                qc_gate_id: data.gateId,
                decision: data.decision,
                notes: data.notes ?? null,  // Fix undefined -> null
                temperature_c: data.temperature ?? null, // Fix undefined -> null
                digital_signature: data.signature ?? null, // Fix undefined -> null
                operator_id: activeRun.operator_id
            });
            reset();
            setExpanded(false);
        } catch (error) {
            console.error(error);
            alert("Failed to submit decision");
        }
    };

    const getTypeColor = () => {
        switch (gate.gate_type) {
            case 'BLOCKING': return 'border-red-500/50 bg-red-900/10';
            case 'CHECKPOINT': return 'border-yellow-500/50 bg-yellow-900/10';
            default: return 'border-blue-500/50 bg-blue-900/10';
        }
    };

    return (
        <div className={cn("rounded-lg border mb-4 overflow-hidden transition-all", getTypeColor())}>
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                onClick={() => setExpanded(!expanded)}
            >
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{(gate.name as any).en}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-black/30 border border-white/10 uppercase">{gate.gate_type}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Gate #{gate.gate_number}</div>
                </div>
                <div className="text-2xl">{expanded ? '−' : '+'}</div>
            </div>

            {expanded && (
                <div className="p-4 border-t border-white/10 bg-black/20">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="flex gap-2 justify-center">
                            {['PASS', 'HOLD', 'FAIL'].map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setValue('decision', d as any)}
                                    className={cn(
                                        "flex-1 py-3 rounded-lg font-bold border transition-all",
                                        currentDecision === d
                                            ? d === 'PASS'
                                                ? 'bg-green-600 border-green-400 text-white shadow-lg'
                                                : d === 'FAIL'
                                                    ? 'bg-red-600 border-red-400 text-white shadow-lg'
                                                    : 'bg-yellow-600 border-yellow-400 text-white shadow-lg'
                                            : "bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700"
                                    )}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                        {errors.decision && <p className="text-red-400 text-center text-xs">{errors.decision.message}</p>}

                        {(currentDecision === 'HOLD' || currentDecision === 'FAIL' || gate.gate_type === 'BLOCKING') && (
                            <div className="space-y-3 animate-fadeIn">
                                <div>
                                    <label className="text-xs text-slate-400">Notes (Required for Hold/Fail)</label>
                                    <textarea
                                        {...register('notes')}
                                        className="w-full bg-slate-900/50 border border-slate-600 rounded p-2 text-sm text-white"
                                        placeholder="Explain the reason..."
                                    />
                                    {errors.notes && <p className="text-red-400 text-xs">{errors.notes.message}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-400">Digital Signature</label>
                                        <input
                                            {...register('signature')}
                                            className="w-full bg-slate-900/50 border border-slate-600 rounded p-2 text-sm text-white"
                                            placeholder="Initials"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400">Verified Temp</label>
                                        <input
                                            type="number" step="0.1"
                                            {...register('temperature', { valueAsNumber: true })}
                                            className="w-full bg-slate-900/50 border border-slate-600 rounded p-2 text-sm text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !currentDecision}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold disabled:opacity-50"
                        >
                            {isSubmitting ? 'Recording...' : 'Submit Decision'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { lotRegistrationSchema, type LotRegistrationInput } from '../../lib/schemas';
import { useProductionStore } from '../../stores/useProductionStore';

interface Props {
    phaseId?: string;
}

export function LotRegistrationForm({ phaseId }: Props) {
    const { registerLot, activeRun, currentPhase, lots } = useProductionStore();

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isSubmitting }
    } = useForm<LotRegistrationInput>({
        resolver: zodResolver(lotRegistrationSchema),
        defaultValues: {
            lotType: 'RAW',
            weight: 0,
            temperature: 0,
            notes: ''
        }
    });

    const lotType = watch('lotType');

    const onSubmit = async (data: LotRegistrationInput) => {
        try {
            if (!activeRun) {
                alert("Please start a production run first.");
                return;
            }

            // HARD RULE: No Yesterday MIX for SKW lots
            if (data.lotType === 'SKW' && data.parentLots && data.parentLots.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const yesterdayMixViolations = data.parentLots.filter(parent => {
                    const parentLot = lots[parent.lotId];
                    if (!parentLot) return false;
                    const parentDate = parentLot.created_at?.split('T')[0];
                    return parentLot.lot_type === 'MIX' && parentDate !== today;
                });

                if (yesterdayMixViolations.length > 0) {
                    alert("❌ HARD RULE VIOLATION: Cannot use yesterday's MIX lots for SKW production. HACCP Compliance requires same-day MIX.");
                    return;
                }
            }

            const lotCode = `LOT-${new Date().getTime().toString().slice(-6)}-${data.lotType}`;

            await registerLot({
                lot_code: lotCode,
                lot_type: data.lotType,
                weight_kg: data.weight,
                temperature_c: data.temperature,
                phase_id: phaseId || null,
                production_run_id: activeRun.id,
                operator_id: activeRun.operator_id,
                metadata: {
                    notes: data.notes,
                    supplierId: data.supplierId,
                    scanData: data.barcode,
                    parentLots: data.parentLots
                }
            });

            reset();
            // Optional: Show toast success
        } catch (error) {
            console.error(error);
            alert("Failed to register lot");
        }
    };

    if (!activeRun) {
        return (
            <div className="p-8 text-center border-2 border-dashed border-slate-700 rounded-xl text-slate-500">
                Start a Production Run to enable Data Entry.
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-slate-800/80 p-6 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">📝 Register New LOT</h3>
                <div className="text-xs text-slate-400 font-mono">Phase: {currentPhase}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Barcode Scanner Input */}
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Barcode Scan</label>
                    <div className="relative">
                        <input
                            {...register('barcode')}
                            placeholder="Scan or type barcode..."
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2 focus:border-cyan-500 focus:outline-none text-white font-mono"
                            autoFocus
                        />
                        <span className="absolute left-3 top-2.5 text-slate-500">🔍</span>
                    </div>
                    {errors.barcode && <p className="text-red-400 text-xs mt-1">{errors.barcode.message}</p>}
                </div>

                {/* Lot Type */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                    <select
                        {...register('lotType')}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    >
                        <option value="RAW">Raw Material</option>
                        <option value="DEB">Deboned</option>
                        <option value="BULK">Bulk Mix</option>
                        <option value="MIX">Final Mix</option>
                        <option value="SKW">Skewer</option>
                        <option value="FRZ">Frozen</option>
                    </select>
                </div>

                {/* Supplier (Conditional) */}
                {lotType === 'RAW' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Supplier ID</label>
                        <input
                            {...register('supplierId')}
                            placeholder="UUID"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                        />
                        {errors.supplierId && <p className="text-red-400 text-xs mt-1">{errors.supplierId.message}</p>}
                    </div>
                )}

                {/* Weight */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Weight (kg)</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register('weight', { valueAsNumber: true })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                    {errors.weight && <p className="text-red-400 text-xs mt-1">{errors.weight.message}</p>}
                </div>

                {/* Temperature */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Temp (°C)</label>
                    <input
                        type="number"
                        step="0.1"
                        {...register('temperature', { valueAsNumber: true })}
                        className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-white focus:outline-none 
                    ${errors.temperature ? 'border-red-500' : 'border-slate-600 focus:border-cyan-500'}`}
                    />
                    {errors.temperature && <p className="text-red-400 text-xs mt-1">{errors.temperature.message}</p>}
                </div>

                {/* Notes */}
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                    <textarea
                        {...register('notes')}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none h-20"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
                {isSubmitting ? 'Registering...' : 'Register LOT'}
            </button>
        </form>
    );
}

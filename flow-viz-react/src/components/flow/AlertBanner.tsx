import { useProductionStore } from '../../stores/useProductionStore';
import { useEffect, useRef } from 'react';

export function AlertBanner() {
    const { qcDecisions } = useProductionStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Filter for active alerts (HOLD or FAIL that haven't been dismissed)
    const activeAlerts = Object.values(qcDecisions).filter(
        (d) => d.decision === 'HOLD' || d.decision === 'FAIL'
    );

    // Play audio on new FAIL
    useEffect(() => {
        const failCount = activeAlerts.filter(a => a.decision === 'FAIL').length;
        if (failCount > 0 && audioRef.current) {
            audioRef.current.play().catch(() => { }); // Ignore autoplay restrictions
        }
    }, [activeAlerts.length]);

    if (activeAlerts.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 space-y-1">
            {/* Audio element for fail beep */}
            <audio ref={audioRef} src="/sounds/alert-beep.mp3" preload="auto" />

            {activeAlerts.slice(0, 3).map((alert) => (
                <div
                    key={alert.id}
                    className={`p-3 flex items-center justify-between text-white font-bold shadow-lg animate-pulse
                        ${alert.decision === 'FAIL'
                            ? 'bg-red-600/95 border-b-4 border-red-800'
                            : 'bg-amber-500/95 border-b-4 border-amber-700'
                        }
                    `}
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{alert.decision === 'FAIL' ? '🚨' : '⚠️'}</span>
                        <div>
                            <div className="text-sm uppercase tracking-wider opacity-80">
                                QC {alert.decision}
                            </div>
                            <div className="text-lg">
                                Gate: {alert.qc_gate_id?.slice(0, 8)} | {alert.notes || 'No notes'}
                            </div>
                        </div>
                    </div>
                    <div className="text-xs opacity-70">
                        {new Date(alert.decided_at).toLocaleTimeString()}
                    </div>
                </div>
            ))}

            {activeAlerts.length > 3 && (
                <div className="bg-slate-800 text-white text-center py-1 text-sm">
                    +{activeAlerts.length - 3} more alerts
                </div>
            )}
        </div>
    );
}

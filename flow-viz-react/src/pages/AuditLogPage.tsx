/**
 * Audit Log Page
 *
 * System audit event stream with filtering.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { listAuditEvents, AuditEvent, AuditFilters } from '../lib/api/qc';

const EVENT_TYPE_STYLES: Record<string, string> = {
    CREATE: 'bg-green-500/20 text-green-400',
    UPDATE: 'bg-blue-500/20 text-blue-400',
    DELETE: 'bg-red-500/20 text-red-400',
    STATUS_CHANGE: 'bg-yellow-500/20 text-yellow-400',
};

export function AuditLogPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<AuditFilters>({ limit: 50 });

    useEffect(() => {
        const fetchEvents = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await listAuditEvents(filters);
                setEvents(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load audit events');
            } finally {
                setIsLoading(false);
            }
        };
        fetchEvents();
    }, [filters]);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.95)] border-b border-white/10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/validator')}
                        className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                    >
                        <span className="text-xl">&larr;</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-white">
                            {language === 'hu' ? 'Audit napló' : 'Audit Log'}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            {language === 'hu' ? 'Rendszer események' : 'System events'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.6)] border-b border-white/5">
                <div className="flex items-center gap-4">
                    <select
                        value={filters.entity_type || ''}
                        onChange={(e) =>
                            setFilters((f) => ({
                                ...f,
                                entity_type: e.target.value || undefined,
                            }))
                        }
                        className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white"
                    >
                        <option value="">{language === 'hu' ? 'Összes entitás' : 'All entities'}</option>
                        <option value="lot">Lot</option>
                        <option value="run">Run</option>
                        <option value="qc_decision">QC Decision</option>
                        <option value="buffer">Buffer</option>
                    </select>
                    <select
                        value={filters.event_type || ''}
                        onChange={(e) =>
                            setFilters((f) => ({
                                ...f,
                                event_type: e.target.value || undefined,
                            }))
                        }
                        className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white"
                    >
                        <option value="">{language === 'hu' ? 'Összes típus' : 'All types'}</option>
                        <option value="CREATE">CREATE</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                        <option value="STATUS_CHANGE">STATUS_CHANGE</option>
                    </select>
                    <input
                        type="text"
                        placeholder={language === 'hu' ? 'Entity ID szűrés...' : 'Filter by Entity ID...'}
                        value={filters.entity_id || ''}
                        onChange={(e) =>
                            setFilters((f) => ({
                                ...f,
                                entity_id: e.target.value || undefined,
                            }))
                        }
                        className="flex-1 px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="text-red-400 text-center">{error}</div>
                ) : events.length === 0 ? (
                    <div className="text-gray-400 text-center">
                        {language === 'hu' ? 'Nincsenek események' : 'No events found'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map((event) => (
                            <div
                                key={event.id}
                                className="p-4 rounded-lg bg-[rgba(26,31,58,0.95)] border border-white/10"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${EVENT_TYPE_STYLES[event.event_type] || 'bg-gray-500/20 text-gray-400'}`}
                                        >
                                            {event.event_type}
                                        </span>
                                        <span className="text-white text-sm">
                                            {event.entity_type}
                                        </span>
                                        <span className="font-mono text-gray-400 text-xs">
                                            {event.entity_id.slice(0, 8)}...
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(event.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                                    <span>
                                        {language === 'hu' ? 'Felhasználó:' : 'User:'} {event.user_id.slice(0, 8)}...
                                    </span>
                                    {event.ip_address && (
                                        <span>IP: {event.ip_address}</span>
                                    )}
                                </div>
                                {(event.old_state || event.new_state) && (
                                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                                        {event.old_state && (
                                            <div className="p-2 rounded bg-red-500/5 border border-red-500/20">
                                                <span className="text-red-400 block mb-1">
                                                    {language === 'hu' ? 'Régi:' : 'Old:'}
                                                </span>
                                                <pre className="text-gray-400 overflow-auto">
                                                    {JSON.stringify(event.old_state, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                        {event.new_state && (
                                            <div className="p-2 rounded bg-green-500/5 border border-green-500/20">
                                                <span className="text-green-400 block mb-1">
                                                    {language === 'hu' ? 'Új:' : 'New:'}
                                                </span>
                                                <pre className="text-gray-400 overflow-auto">
                                                    {JSON.stringify(event.new_state, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

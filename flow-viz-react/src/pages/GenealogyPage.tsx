/**
 * Genealogy Page
 *
 * 1-back / 1-forward lot traceability query interface.
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { getGenealogyTree, GenealogyTree } from '../lib/api/qc';

export function GenealogyPage() {
    const navigate = useNavigate();
    const { language } = useUIStore();

    const [lotId, setLotId] = useState('');
    const [depth, setDepth] = useState(3);
    const [tree, setTree] = useState<GenealogyTree | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!lotId.trim()) return;

        setIsLoading(true);
        setError(null);
        try {
            const result = await getGenealogyTree(lotId.trim(), depth);
            setTree(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load genealogy');
            setTree(null);
        } finally {
            setIsLoading(false);
        }
    };

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
                            {language === 'hu' ? 'Nyomkövetés' : 'Genealogy'}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            {language === 'hu'
                                ? 'Lot származás és leszármazottak lekérdezése'
                                : 'Query lot parents and children'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Search Controls */}
            <div className="px-6 py-4 bg-[rgba(26,31,58,0.6)] border-b border-white/5">
                <div className="flex items-center gap-4">
                    <input
                        type="text"
                        value={lotId}
                        onChange={(e) => setLotId(e.target.value)}
                        placeholder={language === 'hu' ? 'Lot ID...' : 'Lot ID...'}
                        className="flex-1 px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <select
                        value={depth}
                        onChange={(e) => setDepth(Number(e.target.value))}
                        className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-white"
                    >
                        <option value={1}>1 {language === 'hu' ? 'szint' : 'level'}</option>
                        <option value={2}>2 {language === 'hu' ? 'szint' : 'levels'}</option>
                        <option value={3}>3 {language === 'hu' ? 'szint' : 'levels'}</option>
                        <option value={5}>5 {language === 'hu' ? 'szint' : 'levels'}</option>
                    </select>
                    <button
                        onClick={handleSearch}
                        disabled={isLoading || !lotId.trim()}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                    >
                        {isLoading
                            ? language === 'hu'
                                ? 'Keresés...'
                                : 'Searching...'
                            : language === 'hu'
                              ? 'Keresés'
                              : 'Search'}
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-6">
                {error && <div className="text-red-400 text-center mb-4">{error}</div>}

                {tree ? (
                    <div className="space-y-6">
                        {/* Central Lot */}
                        <div className="p-4 rounded-lg bg-[rgba(26,31,58,0.95)] border border-blue-500">
                            <h3 className="text-sm text-gray-400 mb-2">
                                {language === 'hu' ? 'Központi lot' : 'Central Lot'}
                            </h3>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-white">{tree.lot.lot_code}</span>
                                <span className="text-xs text-gray-400">{tree.lot.lot_type}</span>
                            </div>
                            <div className="mt-2 text-sm text-gray-400">
                                {tree.lot.weight_kg && `${tree.lot.weight_kg} kg`}
                                {tree.lot.status && ` - ${tree.lot.status}`}
                            </div>
                        </div>

                        {/* Nodes */}
                        {tree.nodes.length > 0 && (
                            <div>
                                <h3 className="text-sm text-gray-400 mb-2">
                                    {language === 'hu'
                                        ? `Kapcsolódó lotok (${tree.nodes.length})`
                                        : `Related Lots (${tree.nodes.length})`}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {tree.nodes.map((node) => (
                                        <div
                                            key={node.id}
                                            className="p-4 rounded-lg bg-[rgba(26,31,58,0.95)] border border-white/10"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-white text-sm">
                                                    {node.lot_code}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {node.lot_type}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500">
                                                {node.weight_kg && `${node.weight_kg} kg`}
                                                {node.status && ` - ${node.status}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Links */}
                        {tree.links.length > 0 && (
                            <div>
                                <h3 className="text-sm text-gray-400 mb-2">
                                    {language === 'hu'
                                        ? `Kapcsolatok (${tree.links.length})`
                                        : `Links (${tree.links.length})`}
                                </h3>
                                <div className="space-y-2">
                                    {tree.links.map((link, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 text-sm text-gray-400"
                                        >
                                            <span className="font-mono">
                                                {link.parent_lot_id?.slice(0, 8)}
                                            </span>
                                            <span>&rarr;</span>
                                            <span className="font-mono">
                                                {link.child_lot_id?.slice(0, 8)}
                                            </span>
                                            {link.quantity_used_kg && (
                                                <span className="text-xs">
                                                    ({link.quantity_used_kg} kg)
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    !isLoading && (
                        <div className="flex items-center justify-center h-64 text-gray-400">
                            {language === 'hu'
                                ? 'Adjon meg egy Lot ID-t a kereséshez'
                                : 'Enter a Lot ID to search'}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

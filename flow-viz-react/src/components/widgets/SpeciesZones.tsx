export function SpeciesZones() {
    return (
        <div className="grid grid-cols-2 gap-8 my-8">
            <div className="border-4 border-[#f59e0b] rounded-xl p-6 bg-[rgba(245,158,11,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-[#f59e0b] text-black font-bold px-3 py-1 rounded-bl-lg">ZONE A</div>
                <h4 className="text-2xl font-bold text-[#f59e0b] mb-4">🐔 CHICKEN</h4>
                <ul className="text-[var(--color-text-secondary)] space-y-2">
                    <li>• Elkülönített átvevő kapu</li>
                    <li>• Sárga jelölésű eszközök</li>
                    <li>• Dedikált hűtőkamra</li>
                </ul>
            </div>
            <div className="border-4 border-[#3b82f6] rounded-xl p-6 bg-[rgba(59,130,246,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-[#3b82f6] text-white font-bold px-3 py-1 rounded-bl-lg">ZONE B</div>
                <h4 className="text-2xl font-bold text-[#3b82f6] mb-4">🦃 TURKEY</h4>
                <ul className="text-[var(--color-text-secondary)] space-y-2">
                    <li>• Külön légtér</li>
                    <li>• Kék jelölésű eszközök</li>
                    <li>• Szigorú kereszt-út tilalom</li>
                </ul>
            </div>
        </div>
    )
}

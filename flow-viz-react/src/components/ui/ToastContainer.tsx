import { useToastStore, ToastType } from '../../stores/useToastStore';

const iconMap: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
};

const colorMap: Record<ToastType, string> = {
    success: 'border-green-500 bg-green-900/80 text-green-100',
    error: 'border-red-500 bg-red-900/80 text-red-100',
    warning: 'border-yellow-500 bg-yellow-900/80 text-yellow-100',
    info: 'border-cyan-500 bg-cyan-900/80 text-cyan-100'
};

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
                        backdrop-blur-sm animate-slideIn
                        ${colorMap[toast.type]}
                    `}
                    onClick={() => removeToast(toast.id)}
                >
                    <span className="text-lg">{iconMap[toast.type]}</span>
                    <span className="text-sm font-medium flex-1">{toast.message}</span>
                    <button
                        className="text-white/50 hover:text-white transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeToast(toast.id);
                        }}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

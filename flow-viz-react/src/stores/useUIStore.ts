import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'hu' | 'en';
type Theme = 'dark' | 'light';

interface UIState {
    language: Language;
    theme: Theme;
    setLanguage: (lang: Language) => void;
    toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            language: 'hu',
            theme: 'dark',
            setLanguage: (lang) => set({ language: lang }),
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
        }),
        {
            name: 'ui-storage',
        }
    )
);

import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

type AllowedRoles = 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'OPERATOR' | 'VIEWER';

interface ProtectedRouteProps {
    allowedRoles?: AllowedRoles[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { user, role, isLoading, checkSession } = useAuthStore();
    const location = useLocation();

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-slate-900 text-cyan-400">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
};

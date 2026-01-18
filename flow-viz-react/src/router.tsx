import { createHashRouter, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { FlowVizV1 } from './pages/FlowVizV1';
import { FlowVizV2 } from './pages/FlowVizV2';
import { FlowVizV3 } from './pages/FlowVizV3';
import { Presentation } from './pages/Presentation';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FirstFlowPage } from './components/flow/FirstFlowPage';

export const router = createHashRouter([
    {
        path: '/login',
        element: <Login />,
    },
    {
        element: <ProtectedRoute />,
        children: [
            {
                element: (
                    <AppShell>
                        <Outlet />
                    </AppShell>
                ),
                children: [
                    {
                        path: '/',
                        element: <Navigate to="/dashboard" replace />,
                    },
                    {
                        path: '/dashboard',
                        element: <FlowVizV1 />, // V1: Live Dashboard
                    },
                    // Legacy redirects
                    { path: 'flow-v1', element: <Navigate to="/dashboard" replace /> },

                    {
                        path: '/command',
                        element: <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR', 'ADMIN']} />,
                        children: [
                            {
                                index: true,
                                element: <FlowVizV2 />, // V2: Command Center
                            }
                        ]
                    },
                    { path: 'flow-v2', element: <Navigate to="/command" replace /> },

                    {
                        path: '/validator',
                        element: <ProtectedRoute allowedRoles={['AUDITOR', 'ADMIN', 'MANAGER']} />,
                        children: [
                            {
                                index: true,
                                element: <FlowVizV3 />, // V3: Validator
                            }
                        ]
                    },
                    { path: 'flow-v3', element: <Navigate to="/validator" replace /> },

                    {
                        path: '/presentation',
                        element: <Presentation />,
                    },
                    {
                        path: '/first-flow',
                        element: <FirstFlowPage />,
                    },
                ],
            },
        ],
    },
]);

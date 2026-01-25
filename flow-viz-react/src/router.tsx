/**
 * Application Router
 *
 * Phase 8.5: Route Consolidation & UI Migration
 */

import { createHashRouter, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { FlowVizV1 } from './pages/FlowVizV1';
import { FlowVizV2 } from './pages/FlowVizV2';
import { FlowVizV3 } from './pages/FlowVizV3';
import { FirstFlowPage } from './components/flow/FirstFlowPage';
import { Presentation } from './pages/Presentation';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FlowCatalogPage, FlowEditorPage } from './components/flowEditor';

// Phase 8.5: New imports
import { CommandCenterPage } from './pages/CommandCenterPage';
import { CreateRunPage } from './pages/CreateRunPage';
import {
    ActiveRunLayout,
    RunControlsTab,
    RunBuffersTab,
    RunLotsTab,
    RunQCTab,
} from './components/run';
import { ValidatorDashboard } from './pages/ValidatorDashboard';
import { GenealogyPage } from './pages/GenealogyPage';
import { InspectionsPage } from './pages/InspectionsPage';
import { AuditLogPage } from './pages/AuditLogPage';

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
                    // Default redirect
                    { path: '/', element: <Navigate to="/dashboard" replace /> },

                    // Dashboard (V1)
                    { path: '/dashboard', element: <FlowVizV1 /> },

                    // Legacy redirects
                    { path: '/flow-v1', element: <Navigate to="/dashboard" replace /> },
                    { path: '/flow-v2', element: <Navigate to="/command" replace /> },
                    { path: '/flow-v3', element: <Navigate to="/validator" replace /> },
                    { path: '/first-flow', element: <Navigate to="/command" replace /> },

                    // Command Center (V2)
                    {
                        path: '/command',
                        element: <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR', 'ADMIN']} />,
                        children: [
                            { index: true, element: <CommandCenterPage /> },
                            { path: 'new', element: <CreateRunPage /> },
                            {
                                path: 'run/:runId',
                                element: <ActiveRunLayout />,
                                children: [
                                    { index: true, element: <RunControlsTab /> },
                                    { path: 'buffers', element: <RunBuffersTab /> },
                                    { path: 'lots', element: <RunLotsTab /> },
                                    { path: 'qc', element: <RunQCTab /> },
                                ],
                            },
                        ],
                    },

                    // Quality Validator (V3)
                    {
                        path: '/validator',
                        element: <ProtectedRoute allowedRoles={['AUDITOR', 'ADMIN', 'MANAGER']} />,
                        children: [
                            { index: true, element: <ValidatorDashboard /> },
                            { path: 'genealogy', element: <GenealogyPage /> },
                            { path: 'inspections', element: <InspectionsPage /> },
                            { path: 'audit', element: <AuditLogPage /> },
                        ],
                    },

                    // Flow Editor
                    {
                        path: '/flow-editor',
                        element: <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']} />,
                        children: [
                            { index: true, element: <FlowCatalogPage /> },
                            { path: ':flowId', element: <FlowEditorPage /> },
                            { path: ':flowId/v/:versionNum', element: <FlowEditorPage /> },
                        ],
                    },

                    // Presentation
                    { path: '/presentation', element: <Presentation /> },

                    // OLD section routes - use LEGACY components for comparison
                    { path: '/old/command', element: <FlowVizV2 /> },
                    { path: '/old/validator', element: <FlowVizV3 /> },
                    { path: '/old/first-flow', element: <FirstFlowPage /> },
                ],
            },
        ],
    },
]);

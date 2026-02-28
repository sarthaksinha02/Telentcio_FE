import React, { Suspense } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Loader } from 'lucide-react';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const navigation = useNavigation();
    const isNavigating = navigation.state === 'loading';

    return (
        <div className="min-h-screen bg-slate-100 flex font-sans overflow-x-hidden w-screen">
            {/* Top navigation progress bar — visible during route transitions */}
            {isNavigating && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                        zIndex: 9999,
                        animation: 'progressBar 1.5s ease-in-out infinite',
                    }}
                />
            )}
            <style>{`
                @keyframes progressBar {
                    0%   { transform: translateX(-100%); }
                    50%  { transform: translateX(0%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <main className="flex-1 flex flex-col md:pl-64 transition-all duration-300 min-h-screen overflow-x-hidden min-w-0">
                <Topbar toggleSidebar={() => setIsSidebarOpen(true)} />

                <div className="flex-1 overflow-x-hidden">
                    <Suspense fallback={
                        <div className="flex h-full w-full items-center justify-center py-32">
                            <Loader className="animate-spin text-blue-600" size={32} />
                        </div>
                    }>
                        <Outlet />
                    </Suspense>
                </div>
            </main>
        </div>
    );
};

export default Layout;

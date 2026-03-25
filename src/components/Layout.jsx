import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const location = useLocation();
    const timerRef = useRef(null);
    const { user } = useAuth();

    useEffect(() => {
        if (user?.company?.settings?.themeColor) {
            document.documentElement.style.setProperty('--primary-color', user.company.settings.themeColor);
            // Also set a hover variant or lighter variant if needed
            document.documentElement.style.setProperty('--primary-hover', `${user.company.settings.themeColor}dd`);
        }
    }, [user]);

    useEffect(() => {
        // Show progress bar on route change
        setProgress(0);
        setIsNavigating(true);

        // Quickly animate to 80% then wait for render
        const t1 = setTimeout(() => setProgress(60), 50);
        const t2 = setTimeout(() => setProgress(80), 150);

        // After a short delay, complete and hide
        const t3 = setTimeout(() => {
            setProgress(100);
            const t4 = setTimeout(() => {
                setIsNavigating(false);
                setProgress(0);
            }, 300);
            timerRef.current = t4;
        }, 400);

        timerRef.current = t3;

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-slate-100 flex font-sans overflow-x-hidden w-screen">
            {/* Top navigation progress bar */}
            {isNavigating && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: `${progress}%`,
                        height: 3,
                        background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                        zIndex: 9999,
                        transition: 'width 0.25s ease',
                        borderRadius: '0 2px 2px 0',
                    }}
                />
            )}

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

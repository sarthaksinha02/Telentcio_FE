import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    return (
        <div className="min-h-screen bg-slate-100 flex font-sans overflow-x-hidden w-screen">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <main className="flex-1 flex flex-col md:pl-64 transition-all duration-300 min-h-screen overflow-x-hidden min-w-0">
                <Topbar toggleSidebar={() => setIsSidebarOpen(true)} />

                <div className="flex-1 overflow-x-hidden">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;

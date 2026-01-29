import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
    return (
        <div className="min-h-screen bg-slate-100 flex font-sans">
            <Sidebar />
            <main className="flex-1 flex flex-col md:pl-64 transition-all duration-300">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;

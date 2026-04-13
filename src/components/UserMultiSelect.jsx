import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

const UserMultiSelect = ({ users = [], selectedUserIds = [], onChange, placeholder = "Select users..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef(null);

    const filteredUsers = users.filter(user =>
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.employeeCode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleUser = (userId) => {
        const newSelected = selectedUserIds.includes(userId)
            ? selectedUserIds.filter(id => id !== userId)
            : [...selectedUserIds, userId];
        onChange(newSelected);
    };

    const handleSelectAll = (e) => {
        e.stopPropagation();
        if (selectedUserIds.length === users.length) {
            onChange([]);
        } else {
            onChange(users.map(u => u._id));
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-1.5 cursor-pointer hover:border-blue-400 transition-all min-w-[180px] shadow-sm"
            >
                <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                    {selectedUserIds.length === 0 ? (
                        <span className="text-gray-400 text-xs font-medium">{placeholder}</span>
                    ) : selectedUserIds.length === users.length ? (
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">All Team Members</span>
                    ) : (
                        <span className="text-xs font-bold text-gray-700">
                            {selectedUserIds.length} Employee{selectedUserIds.length > 1 ? 's' : ''} Selected
                        </span>
                    )}
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ml-2 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[60] mt-2 w-72 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 right-0">
                    <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto py-1">
                        <div
                            onClick={handleSelectAll}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 group"
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedUserIds.length === users.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                {selectedUserIds.length === users.length && <Check size={12} className="text-white" />}
                            </div>
                            <span className="text-xs font-bold text-gray-700">Select All Team</span>
                        </div>

                        {filteredUsers.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-xs italic">No users found</div>
                        ) : (
                            filteredUsers.map(user => (
                                <div
                                    key={user._id}
                                    onClick={(e) => { e.stopPropagation(); toggleUser(user._id); }}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedUserIds.includes(user._id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                        {selectedUserIds.includes(user._id) && <Check size={12} className="text-white" />}
                                    </div>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                                        </div>
                                        <div className="truncate">
                                            <p className="text-xs font-bold text-gray-700 truncate">{user.firstName} {user.lastName}</p>
                                            <p className="text-[10px] text-gray-400 font-mono truncate">{user.employeeCode}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {selectedUserIds.length > 0 && (
                        <div className="p-2 border-t border-gray-50 bg-gray-50/30 flex justify-end">
                            <button
                                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                                className="text-[9px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-widest px-2 py-1 transition-colors"
                            >
                                Clear Selection
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UserMultiSelect;

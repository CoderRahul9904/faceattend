import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, ChevronDown, LogOut, User } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between shadow-sm relative z-30">
      {/* Search Input */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search lectures, reports, students..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B5BDB] focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>

      {/* Right-Side Meta Information */}
      <div className="flex items-center gap-6">
        {/* Date Display */}
        <span className="text-xs font-semibold text-gray-500 hidden md:inline-block bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
          {formatDate()}
        </span>

        {/* Notifications Icon */}
        <button className="relative p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-all duration-200">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-[#00C9A7] rounded-full ring-2 ring-white"></span>
        </button>

        {/* Vertical Divider */}
        <div className="h-6 w-px bg-gray-200"></div>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 hover:bg-gray-50 p-1.5 rounded-lg transition-all duration-200"
          >
            <div className="h-8 w-8 rounded-full bg-[#3B5BDB] text-white flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-gray-700 leading-tight">{user?.name}</p>
              <p className="text-[10px] text-gray-400 font-medium capitalize mt-0.5">{user?.role}</p>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-185' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 animate-fadeIn">
              <div className="px-4 py-2.5 border-b border-gray-50">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-sm font-semibold text-gray-700 truncate">{user?.email}</p>
                {user?.student_id && (
                  <span className="inline-block mt-1 text-[10px] bg-blue-50 text-[#3B5BDB] font-semibold px-2 py-0.5 rounded">
                    ID: {user.student_id}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-150"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;

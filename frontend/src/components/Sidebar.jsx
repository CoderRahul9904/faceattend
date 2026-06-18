import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  BookOpen,
  Megaphone,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  Camera
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isTeacher = user?.role === 'teacher';
  const dashboardPath = isTeacher ? '/teacher/dashboard' : '/student/dashboard';

  const menuItems = [
    { name: 'Dashboard', path: dashboardPath, icon: LayoutDashboard },
    { name: 'Attendance', path: '#attendance', icon: Calendar },
    { name: 'Students', path: '#students', icon: Users },
    { name: 'Lectures', path: '#lectures', icon: BookOpen },
    { name: 'Notices', path: '#notices', icon: Megaphone },
    { name: 'Messages', path: '#messages', icon: MessageSquare },
    { name: 'Results', path: '#results', icon: FileText },
    { name: 'Settings', path: '#settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#1E3A8A] text-white flex flex-col h-full shadow-lg">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#2A4EB3] gap-3">
        <div className="p-1.5 bg-[#3B5BDB] rounded-lg">
          <Camera className="h-6 w-6 text-[#00C9A7]" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-wider">FaceAttend</span>
          <span className="text-[10px] block text-[#00C9A7] font-semibold -mt-1 uppercase tracking-widest">
            {user?.role} Portal
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '#' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 text-white border-l-4 border-[#00C9A7] pl-3'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`h-5 w-5 transition-colors duration-200 ${isActive ? 'text-[#00C9A7]' : 'text-gray-400'}`} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* User Quick Info & Logout */}
      <div className="p-4 border-t border-[#2A4EB3] bg-[#1a337a]">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-[#3B5BDB] flex items-center justify-center font-bold text-white uppercase shadow-inner">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate leading-tight">{user?.name}</p>
            <p className="text-[11px] text-gray-300 truncate mt-0.5">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white rounded-lg text-xs font-semibold transition-all duration-200 border border-red-500/30"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

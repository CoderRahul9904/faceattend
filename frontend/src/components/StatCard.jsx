import React from 'react';

/**
 * StatCard — reusable metric card
 * Props:
 *   icon       — lucide-react component
 *   label      — string label below value
 *   value      — string/number to display prominently
 *   accentColor — tailwind bg color class, e.g. 'bg-blue-50'
 *   iconColor   — tailwind text color class, e.g. 'text-[#3B5BDB]'
 *   sublabel    — optional small grey text beneath label
 */
const StatCard = ({ icon: Icon, label, value, accentColor = 'bg-blue-50', iconColor = 'text-[#3B5BDB]', sublabel }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
      {/* Icon badge */}
      <div className={`p-3 rounded-xl ${accentColor} flex-shrink-0`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>

      {/* Text content */}
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-800 leading-tight truncate">{value}</p>
        <p className="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">{label}</p>
        {sublabel && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sublabel}</p>
        )}
      </div>
    </div>
  );
};

export default StatCard;

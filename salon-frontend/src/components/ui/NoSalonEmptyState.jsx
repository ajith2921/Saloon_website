import React from 'react';
import { Link } from 'react-router-dom';

export default function NoSalonEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center">
      <div className="w-24 h-24 mb-6 rounded-full bg-indigo-100 flex items-center justify-center shadow-inner">
        <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">Set up your Salon</h2>
      <p className="text-lg text-gray-600 mb-8 max-w-md leading-relaxed">
        You need to configure your salon profile before you can manage workers, services, or the queue.
      </p>
      <Link 
        to="/admin/settings" 
        className="inline-flex items-center px-8 py-3 border border-transparent text-lg font-semibold rounded-lg shadow-md text-white bg-indigo-600 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Complete Setup
      </Link>
    </div>
  );
}

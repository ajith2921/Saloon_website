import React from 'react';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';

export default function NoSalonEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] px-4 text-center animate-fade-in">
      <div className="w-24 h-24 mb-6 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shadow-glow-sm">
        <Store className="w-12 h-12 text-brand-400" />
      </div>
      <h2 className="text-3xl font-display font-bold text-white mb-4 tracking-tight">Set up your Salon</h2>
      <p className="text-lg text-dark-100 mb-8 max-w-md leading-relaxed">
        You need to configure your salon profile before you can manage workers, services, or the queue.
      </p>
      <Link 
        to="/admin/settings" 
        className="inline-flex items-center px-8 py-3 font-medium rounded-lg text-white bg-brand-500 hover:bg-brand-400 hover:shadow-glow-sm transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-dark-900"
      >
        Complete Setup
      </Link>
    </div>
  );
}

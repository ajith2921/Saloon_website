import { Calendar } from 'lucide-react'

export default function DateRangePicker({ value, onChange }) {
  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2 bg-surface-secondary border border-white/10 rounded-xl px-4 py-2 hover:border-brand-500/50 transition-colors">
        <Calendar className="w-4 h-4 text-brand-400" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white font-medium cursor-pointer appearance-none pr-4"
        >
          <option value="today" className="bg-surface-primary">Today</option>
          <option value="7d" className="bg-surface-primary">Last 7 Days</option>
          <option value="30d" className="bg-surface-primary">Last 30 Days</option>
          <option value="all" className="bg-surface-primary">All Time</option>
        </select>
      </div>
    </div>
  )
}

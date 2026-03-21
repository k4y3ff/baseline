import { NavLink } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Today', icon: '◉' },
  { to: '/analyze', label: 'Analyze', icon: '↗' },
  { to: '/prepare', label: 'Prepare', icon: '⊕' },
  { to: '/history', label: 'History', icon: '≡' },
]

export default function Nav() {
  return (
    <nav className="no-drag flex flex-col shrink-0 w-[52px] h-full bg-[--color-surface]" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Drag region — clears macOS traffic lights */}
      <div className="drag-region h-[42px] shrink-0" />

      {/* Primary nav items */}
      <div className="flex flex-col flex-1 gap-0.5 px-1.5">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `flex items-center justify-center w-full h-10 rounded-lg text-[18px] leading-none transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-[--color-muted] hover:text-white hover:bg-white/[0.06]'
              }`
            }
          >
            {icon}
          </NavLink>
        ))}
      </div>

      {/* Settings pinned to bottom */}
      <div className="px-1.5 pb-5">
        <NavLink
          to="/settings"
          title="Settings"
          className={({ isActive }) =>
            `flex items-center justify-center w-full h-10 rounded-lg text-[18px] leading-none transition-colors ${
              isActive
                ? 'bg-white/10 text-white'
                : 'text-[--color-muted] hover:text-white hover:bg-white/[0.06]'
            }`
          }
        >
          ⚙
        </NavLink>
      </div>
    </nav>
  )
}

import { NavLink } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Today', icon: '◉' },
  { to: '/analyze', label: 'Analyze', icon: '↗' },
  { to: '/prepare', label: 'Prepare', icon: '⊕' },
  { to: '/history', label: 'History', icon: '≡' },
]

export default function Nav() {
  return (
    <nav className="no-drag border-t border-[--color-border] bg-[--color-surface] flex">
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
              isActive ? 'text-[--color-brand]' : 'text-[--color-muted] hover:text-[--color-text]'
            }`
          }
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

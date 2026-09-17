import { useState, type ReactNode } from 'react'

/** Window chrome uses 98.css itself; only layout belongs to the lesson. */
export function Desktop({ children }: { children: ReactNode }) {
  const [maximized, setMaximized] = useState(false)
  return (
    <div className={`desktop ${maximized ? 'desktop-maximized' : ''}`}>
      <div className="window lesson-window">
        <header className="title-bar">
          <div className="title-bar-text lesson-title">
            <span className="computer-icon" aria-hidden="true" />
            Memory manager
          </div>
          <div className="title-bar-controls">
            <button type="button" aria-label={maximized ? 'Restore' : 'Maximize'}
              title={maximized ? 'Restore window' : 'Maximize window'}
              onClick={() => setMaximized((value) => !value)} />
          </div>
        </header>
        <div className="window-body lesson-body">{children}</div>
        <footer className="status-bar lesson-status">
          <p className="status-bar-field">Memory manager</p>
          <p className="status-bar-field">Interactive lesson</p>
        </footer>
      </div>
      <div className="desktop-taskbar" aria-hidden="true">
        <div className="status-field-border taskbar-program"><span className="computer-icon" /> Memory manager</div>
        <div className="status-field-border taskbar-caption">Learning by doing</div>
      </div>
    </div>
  )
}

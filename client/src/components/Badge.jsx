export default function Badge({ className = '' }) {
  const text = 'SCALIO • REAL-TIME USDT • SCALIO • REAL-TIME USDT • '
  return (
    <div className={`badge ${className}`}>
      <svg viewBox="0 0 120 120" className="badge-ring">
        <defs><path id={`circ-${className}`} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
        <text><textPath href={`#circ-${className}`}>{text}</textPath></text>
      </svg>
      <span className="badge-arrow">↓</span>
    </div>
  )
}

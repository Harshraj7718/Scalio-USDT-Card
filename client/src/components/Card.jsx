export default function Card({ variant = 'orange', name = 'YOUR NAME', className = '', style }) {
  return (
    <div className={`vcard ${variant} ${className}`} style={style}>
      <div className="vcard-shine" />
      <div className="vcard-top">
        <span className="vcard-brand">Scalio</span>
        <span className="vcard-visa">VISA</span>
      </div>
      <div className="vcard-chip" />
      <div className="vcard-num">2243 6652 9435 9982</div>
      <div className="vcard-bot">
        <div><small>Card holder</small><b>{name}</b></div>
        <div><small>Expiry</small><b>10/29</b></div>
        <div><small>Network</small><b>USDT</b></div>
      </div>
    </div>
  )
}

function KidCard({ kid, time, onAddTime, onSubtractTime, onRefresh, onReset }) {
  return (
    <div className="kid-card">
      <h2>{kid.toUpperCase()}</h2>
      <p>
        <span className="time-left-label">Time Left:</span>{' '}
        <span className="time-left-value">{time || 'Loading...'}</span>
      </p>
      <div className="button-group">
        {[5, 10, 20, 30].map(m => (
          <button key={m} onClick={() => onAddTime(kid, m)} className="time-button">
            +{m} min
          </button>
        ))}
      </div>
      <div className="button-group">
        {[5, 10, 20, 30].map(m => (
          <button key={`sub-${m}`} onClick={() => onSubtractTime(kid, m)} className="time-button">
            -{m} min
          </button>
        ))}
      </div>
      <button onClick={() => onRefresh(kid, true)} className="refresh-button">
        Refresh Time Left
      </button>
      <button onClick={() => onReset(kid)} className="reset-button">
        Reset to 0
      </button>
    </div>
  );
}

export default KidCard;

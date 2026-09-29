import propTypes from 'prop-types';

export default function TimerClock({ timeLeft, totalTime }) {
    // Simple calculation for circle progress
    // Circumference = 2 * PI * r
    const radius = 24;
    const circumference = 2 * Math.PI * radius;

    const percentage = (timeLeft / totalTime);
    const strokeDashoffset = circumference - (percentage * circumference);

    // Color logic
    let color = 'var(--color-success)';
    if (percentage < 0.5) color = 'var(--color-primary)';
    if (percentage < 0.2) color = 'var(--color-danger)';

    return (
        <div
            role="timer"
            aria-label={`${timeLeft} seconds remaining`}
            style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            {/* Background Circle */}
            <svg width="60" height="60" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="6"
                />
                {/* Progress Circle */}
                <circle
                    cx="30"
                    cy="30"
                    r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                />
            </svg>
            {/* Text Number */}
            <div style={{ position: 'absolute', fontWeight: 'bold', fontSize: '1.1rem' }}>
                {timeLeft}
            </div>
        </div>
    );
}

TimerClock.propTypes = {
    timeLeft: propTypes.number.isRequired,
    totalTime: propTypes.number.isRequired
};

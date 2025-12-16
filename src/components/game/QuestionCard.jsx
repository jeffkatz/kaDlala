import propTypes from 'prop-types';

/* 
  QuestionCard Component
  Displays the question text, category, and answer options.
*/

export default function QuestionCard({ question, onAnswer }) {
    const { category, text, options } = question;

    return (
        <div className="question-card" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
            textAlign: 'center'
        }}>

            {/* Header / Category */}
            <div>
                <span style={{
                    background: 'var(--color-secondary)',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '99px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    {category}
                </span>
            </div>

            {/* Question Body */}
            <h3 style={{
                fontSize: '2rem',
                fontWeight: '600',
                minHeight: '120px', // Prevent layout jump
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {text}
            </h3>

            {/* Options Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '1rem',
                marginTop: '1rem'
            }}>
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => onAnswer(opt.id)}
                        className="btn glass-panel"
                        style={{
                            width: '100%',
                            padding: '1.5rem',
                            fontSize: '1.2rem',
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            border: '1px solid rgba(255,255,255,0.1)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            color: 'var(--text-main)',
                            background: 'rgba(255,255,255,0.03)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 184, 0, 0.2)';
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        }}
                    >
                        {opt.text}
                    </button>
                ))}
            </div>
        </div>
    );
}

QuestionCard.propTypes = {
    question: propTypes.object.isRequired,
    onAnswer: propTypes.func.isRequired,
};

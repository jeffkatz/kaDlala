import { useGame } from './context/GameContext';
import questionData from './data/questions.json';

import QuestionCard from './components/game/QuestionCard';
import TimerClock from './components/game/TimerClock';
import useGameTimer from './hooks/useGameTimer';

function App() {
  const { state, startGame, submitAnswer, nextQuestion } = useGame();

  // Current Question Data
  const currentQ = state.questions[state.currentQuestionIndex];

  // Timer Hook
  const handleExpire = () => {
    handleAnswer(null); // Null answer means timeout
  };

  const { timeLeft, stopTimer } = useGameTimer(
    currentQ ? currentQ.timeLimit : 15, // Default 15s if missing
    handleExpire,
    currentQ ? currentQ.id : 'setup' // Reset key
  );

  const handleStart = () => {
    // In a real app, we would shuffle here
    startGame(questionData);
  };

  const handleAnswer = (answerId) => {
    if (!currentQ) return;

    // Stop timer immediately on interaction
    stopTimer();

    // Find selected option to check if correct
    const selectedOption = currentQ.options.find(o => o.id === answerId);
    const isCorrect = selectedOption?.isCorrect || false;

    // Submit Answer
    submitAnswer({
      questionId: currentQ.id,
      answerId, // can be null
      isCorrect,
      timeTaken: currentQ.timeLimit - timeLeft
    });

    // Move to next (with a small delay in future)
    // Small timeout to allow UI updates/animation to potentially happen or just safe state transition
    setTimeout(() => {
      nextQuestion();
    }, 500);
  };

  return (
    <div className="app-container">
      <main style={{
        width: '100%',
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '2rem',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>

        {state.gameState === 'IDLE' && (
          <div className="glass-panel animate-fade-in" style={{
            padding: '4rem',
            textAlign: 'center',
            maxWidth: '600px',
            width: '100%'
          }}>
            <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>kaDlala</h1>
            <p style={{
              fontSize: '1.5rem',
              color: 'var(--text-muted)',
              marginBottom: '3rem'
            }}>
              The Ultimate South African Quiz Challenge
            </p>

            <button className="btn btn-primary" onClick={handleStart}>
              Start Playing
            </button>

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <span style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', fontSize: '0.9rem' }}>🇿🇦 South African Edition</span>
              <span style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '1rem', fontSize: '0.9rem' }}>⚡ Fast Paced</span>
            </div>
          </div>
        )}

        {state.gameState === 'PLAYING' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '800px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Question {state.currentQuestionIndex + 1} / {state.questions.length}</p>
                <p style={{ fontWeight: 'bold' }}>Score: {state.score}</p>
              </div>

              <TimerClock timeLeft={timeLeft} totalTime={currentQ.timeLimit || 15} />
            </div>

            <QuestionCard
              question={state.questions[state.currentQuestionIndex]}
              onAnswer={handleAnswer}
            />
          </div>
        )}

        {state.gameState === 'FINISHED' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '3rem', textAlign: 'center', width: '100%', maxWidth: '600px' }}>
            <h1 style={{ marginBottom: '2rem' }}>Game Over!</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Final Score</p>
                <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{state.score}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Accuracy</p>
                <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-secondary)' }}>
                  {Math.round((state.answers.filter(a => a.isCorrect).length / state.questions.length) * 100)}%
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'left', marginBottom: '3rem' }}>
              <p>Correct Answers: <strong style={{ color: 'var(--color-success)' }}>{state.answers.filter(a => a.isCorrect).length}</strong></p>
              <p>Incorrect / Missed: <strong style={{ color: 'var(--color-danger)' }}>{state.questions.length - state.answers.filter(a => a.isCorrect).length}</strong></p>
            </div>

            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Play Again
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;

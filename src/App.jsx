import { lazy, Suspense, useRef, useState } from 'react';
import { useGame } from './context/useGame';
import useGameRecords from './hooks/useGameRecords';
import useGameSettings from './hooks/useGameSettings';
import useQuestionLibrary from './hooks/useQuestionLibrary';
import { createGameDeck, shuffle } from './lib/createGameDeck';
import TimerClock from './components/game/TimerClock';
import useGameTimer from './hooks/useGameTimer';
import SettingsPanel from './components/game/SettingsPanel';

const QuestionCard = lazy(() => import('./components/game/QuestionCard'));
const GameResults = lazy(() => import('./components/game/GameResults'));
const OnlineLobby = lazy(() => import('./components/game/OnlineLobby'));

function getCurrentStreak(answers) {
  let streak = 0;
  for (let index = answers.length - 1; index >= 0 && answers[index].isCorrect; index -= 1) {
    streak += 1;
  }
  return streak;
}

function getBestStreak(answers) {
  let currentStreak = 0;
  let bestStreak = 0;

  answers.forEach((answer) => {
    currentStreak = answer.isCorrect ? currentStreak + 1 : 0;
    bestStreak = Math.max(bestStreak, currentStreak);
  });

  return bestStreak;
}

function GameRound({ question, questionNumber, questionCount, score, streak, onAnswer }) {
  const duration = question.timeLimit || 15;
  const answeredRef = useRef(false);
  const [isAnswered, setIsAnswered] = useState(false);

  function submitQuestionAnswer(answerId, timeTaken) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setIsAnswered(true);
    onAnswer(answerId, timeTaken);
  }

  const { timeLeft: remainingTime, stopTimer } = useGameTimer(
    duration,
    () => submitQuestionAnswer(null, duration)
  );

  function handleQuestionAnswer(answerId) {
    stopTimer();
    submitQuestionAnswer(answerId, duration - remainingTime);
  }

  return (
    <section className="game-board" aria-label="Quiz round">
      <div className="game-board__top">
        <div>
          <p className="eyebrow">FIELD TEST · {question.difficulty.toUpperCase()} TERRAIN</p>
          <p className="round-count">Question <strong>{String(questionNumber).padStart(2, '0')}</strong><span> / {String(questionCount).padStart(2, '0')}</span></p>
        </div>
        <TimerClock timeLeft={remainingTime} totalTime={duration} />
      </div>

      <div
        className="round-progress"
        role="progressbar"
        aria-label="Round progress"
        aria-valuemin={0}
        aria-valuemax={questionCount}
        aria-valuenow={questionNumber}
      >
        <span style={{ width: `${(questionNumber / questionCount) * 100}%` }} />
      </div>

      <div className="score-strip">
        <div>
          <span className="score-strip__label">ROUND SCORE</span>
          <strong>{score.toLocaleString()}</strong>
        </div>
        <div className={streak > 0 ? 'streak-mark streak-mark--active' : 'streak-mark'} aria-live="polite">
          <span aria-hidden="true">✳</span>
          <strong>{streak} streak</strong>
          {streak >= 2 && <small>+50 at 3</small>}
        </div>
        <span className="point-tag">BASE {question.points} · SPEED BONUS</span>
      </div>

      <Suspense fallback={<div className="question-loading" role="status">Loading the next question…</div>}>
        <QuestionCard
          key={question.id}
          question={question}
          timeLeft={remainingTime}
          isAnswered={isAnswered}
          onAnswer={handleQuestionAnswer}
        />
      </Suspense>
    </section>
  );
}

function App() {
  const { state, startGame, submitAnswer, nextQuestion } = useGame();
  const { records, recordGame, newPersonalBest, resetRunRecord } = useGameRecords();
  const questionLibrary = useQuestionLibrary();
  const gameSettings = useGameSettings(questionLibrary.categories);
  const [screen, setScreen] = useState('home');
  const answeredQuestionRef = useRef(null);
  const currentQuestion = state.questions[state.currentQuestionIndex];
  const streak = getCurrentStreak(state.answers);

  function handleStart() {
    answeredQuestionRef.current = null;
    resetRunRecord();
    startGame(createGameDeck(
      questionLibrary.questions,
      gameSettings.categoryPercentages,
      gameSettings.questionCount
    ));
    setScreen('home');
  }

  function handleAnswer(answerId, timeTaken) {
    if (!currentQuestion || answeredQuestionRef.current === currentQuestion.id) return;
    answeredQuestionRef.current = currentQuestion.id;

    const selectedOption = currentQuestion.options.find((option) => option.id === answerId);
    const isCorrect = Boolean(selectedOption?.isCorrect);
    const nextStreak = isCorrect ? streak + 1 : 0;
    const basePoints = isCorrect
      ? currentQuestion.points + Math.ceil((currentQuestion.timeLimit - timeTaken) * 4)
      : 0;
    const streakBonus = isCorrect && nextStreak >= 3 && nextStreak % 3 === 0 ? 50 : 0;
    const points = basePoints + streakBonus;

    submitAnswer({
      questionId: currentQuestion.id,
      answerId,
      isCorrect,
      points,
      timeTaken,
      streakBonus
    });

    if (state.currentQuestionIndex === state.questions.length - 1) {
      recordGame(state.score + points, Math.max(getBestStreak(state.answers), nextStreak));
    }

    setTimeout(nextQuestion, 750);
  }

  function handleRetryMissed() {
    const missedQuestionIds = new Set(
      state.answers.filter((answer) => !answer.isCorrect).map((answer) => answer.questionId)
    );
    const retryQuestions = state.questions
      .filter((question) => missedQuestionIds.has(question.id))
      .map((question) => ({ ...question, options: shuffle(question.options) }));

    answeredQuestionRef.current = null;
    resetRunRecord();
    startGame(retryQuestions);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label="kaDlala home">
          <span className="brand-sun" aria-hidden="true">✳</span>
          <span className="brand-name">kaDlala</span>
          <span className="brand-divider" />
          <span className="brand-edition">SOUTH AFRICA FIELD GUIDE</span>
        </a>
        <div className="header-right">
          {state.gameState === 'IDLE' && (
            <>
              <button type="button" className="header-link" onClick={() => setScreen('online')}>Play with friends</button>
              <button type="button" className="header-link" onClick={() => setScreen('settings')}>Settings</button>
            </>
          )}
          <div className="header-note"><span className="status-dot" /> A LITTLE WISER EACH ROUND</div>
        </div>
      </header>

      <main className="main-stage">
        {state.gameState === 'IDLE' && screen === 'settings' && (
          <SettingsPanel
            categories={questionLibrary.categories}
            questions={questionLibrary.questions}
            weights={gameSettings.categoryPercentages}
            questionCount={gameSettings.questionCount}
            onClose={() => setScreen('home')}
            onUpdateWeights={gameSettings.updateCategoryPercentages}
            onUpdateQuestionCount={gameSettings.updateQuestionCount}
            onGameMode={() => setScreen('online')}
            onAddQuestionBank={questionLibrary.addQuestionBank}
          />
        )}

        {state.gameState === 'IDLE' && screen === 'online' && (
          <Suspense fallback={<div className="question-loading" role="status">Preparing your game room…</div>}>
            <OnlineLobby
              questions={questionLibrary.questions}
              questionCount={gameSettings.questionCount}
              categoryPercentages={gameSettings.categoryPercentages}
              onBack={() => setScreen('home')}
            />
          </Suspense>
        )}

        {state.gameState === 'IDLE' && screen === 'home' && (
          <section className="landing-card" aria-labelledby="game-title">
            <div className="landing-copy">
              <p className="eyebrow">A QUIZ ACROSS THE NATION</p>
              <h1 id="game-title">Know the place.<br /><em>Feel the pace.</em></h1>
              <p className="landing-lede">
                Play solo or bring your friends. Choose a game, share the questions, and see who knows South Africa best.
              </p>
              <div className="landing-actions">
                <button className="btn btn-primary" onClick={handleStart}>Play solo <span aria-hidden="true">↗</span></button>
                <button className="btn btn-outline" onClick={() => setScreen('online')}>Play with friends</button>
                <button className="settings-entry-link" onClick={() => setScreen('settings')}>Tune your categories and question files →</button>
              </div>
              <div className="landing-records">
                <span><strong>{records.gamesPlayed}</strong> rounds played</span>
                <span><strong>{records.bestScore.toLocaleString()}</strong> personal best</span>
                <span><strong>{questionLibrary.questions.length}</strong> questions · {questionLibrary.categories.length} categories</span>
              </div>
            </div>
            <div className="field-seal" aria-label={`South Africa field guide, ${questionLibrary.categories.length} knowledge categories`}>
              <div className="field-seal__orbit field-seal__orbit--outer" />
              <div className="field-seal__orbit field-seal__orbit--inner" />
              <span className="field-seal__north">N</span>
              <span className="field-seal__south">S</span>
              <span className="field-seal__center">SA</span>
              <span className="field-seal__caption">FIELD<br />GUIDE<br /><i>NO. 01</i></span>
              <span className="field-seal__coordinates">22° · 35° S</span>
            </div>
            <div className="landing-foot">
              <span><i className="landing-foot__line" /> {questionLibrary.categories.length} CATEGORIES</span>
              <span>{questionLibrary.questions.length} QUESTIONS IN THE FIELD</span>
              <span>THREE LEVELS · ONE STREAK</span>
            </div>
          </section>
        )}

        {state.gameState === 'PLAYING' && currentQuestion && (
          <GameRound
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={state.currentQuestionIndex + 1}
            questionCount={state.questions.length}
            score={state.score}
            streak={streak}
            onAnswer={handleAnswer}
          />
        )}

        {state.gameState === 'FINISHED' && (
          <Suspense fallback={<div className="results-loading" role="status">Gathering your field notes…</div>}>
            <GameResults
              questions={state.questions}
              answers={state.answers}
              score={state.score}
              personalBest={records.bestScore}
              personalBestStreak={records.bestStreak}
              bestStreak={getBestStreak(state.answers)}
              gamesPlayed={records.gamesPlayed}
              newPersonalBest={newPersonalBest}
              onPlayAgain={handleStart}
              onRetryMissed={handleRetryMissed}
            />
          </Suspense>
        )}
      </main>

      <footer className="site-footer">
        <span>KA<span>D</span>LALA · KEEP YOUR CURIOSITY MOVING</span>
        <span>MADE FOR THE LOVE OF HOME</span>
      </footer>
    </div>
  );
}

export default App;

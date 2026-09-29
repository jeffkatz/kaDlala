import { motion, useReducedMotion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const MotionSection = motion.section;
const CHART_COLORS = ['#e5ae3d', '#ee735c', '#9dc4a6', '#81b8bd', '#c4a2cc', '#d29b6a', '#82a2d0', '#d2c675'];

function buildCategoryStats(questions, answers) {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const categoryMap = new Map();

  answers.forEach((answer) => {
    const category = questionsById.get(answer.questionId)?.category;
    if (!category) return;

    const stats = categoryMap.get(category) || { category, correct: 0, total: 0 };
    stats.total += 1;
    if (answer.isCorrect) stats.correct += 1;
    categoryMap.set(category, stats);
  });

  return [...categoryMap.values()].map((stats) => ({
    ...stats,
    accuracy: Math.round((stats.correct / stats.total) * 100)
  }));
}

function getStreakLabel(streak) {
  if (streak >= 8) return 'Unstoppable';
  if (streak >= 5) return 'On a roll';
  if (streak >= 3) return 'Finding your rhythm';
  return 'Keep building';
}

export default function GameResults({
  questions,
  answers,
  score,
  personalBest,
  personalBestStreak,
  newPersonalBest,
  bestStreak,
  gamesPlayed,
  onPlayAgain,
  onRetryMissed
}) {
  const reduceMotion = useReducedMotion();
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const accuracy = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
  const missedAnswers = answers.filter((answer) => !answer.isCorrect);
  const categoryStats = buildCategoryStats(questions, answers);
  const accuracyData = [
    { name: 'Correct', value: correctCount },
    { name: 'To learn', value: answers.length - correctCount }
  ];
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const averageTime = answers.length
    ? (answers.reduce((total, answer) => total + answer.timeTaken, 0) / answers.length).toFixed(1)
    : '0.0';

  return (
    <MotionSection
      className="results-page"
      aria-labelledby="results-title"
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="results-heading">
        <div>
          <p className="eyebrow">FIELD NOTES · ROUND {String(gamesPlayed).padStart(2, '0')}</p>
          <h1 id="results-title">{accuracy >= 80 ? 'Brilliant run.' : 'Every round teaches.'}</h1>
          <p className="results-lede">
            {accuracy >= 80
              ? 'You know your way around the map. Keep that streak alive.'
              : 'Your next run starts with what you learned here.'}
          </p>
        </div>
        <div className="results-seal" aria-label={`${accuracy}% accuracy`}>
          <span>{accuracy}%</span>
          <small>ACCURACY</small>
        </div>
      </div>

      <div className="results-stats">
        <article className="result-stat result-stat--score">
          <span>ROUND SCORE</span>
          <strong>{score.toLocaleString()}</strong>
          <small>{newPersonalBest ? 'New personal best!' : `Personal best · ${personalBest.toLocaleString()}`}</small>
        </article>
        <article className="result-stat">
          <span>RIGHT ANSWERS</span>
          <strong>{correctCount}<small> / {answers.length}</small></strong>
          <small>{missedAnswers.length ? `${missedAnswers.length} to revisit` : 'A clean sweep'}</small>
        </article>
        <article className="result-stat">
          <span>BEST STREAK</span>
          <strong>{bestStreak}<small> in a row</small></strong>
          <small>{bestStreak > 0 && bestStreak === personalBestStreak ? 'Personal streak best' : getStreakLabel(bestStreak)}</small>
        </article>
        <article className="result-stat">
          <span>PACE</span>
          <strong>{averageTime}<small> sec</small></strong>
          <small>Average answer time</small>
        </article>
      </div>

      <div className="results-charts">
        <article className="chart-panel chart-panel--ring">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">THE BIG PICTURE</p>
              <h2>Your round, at a glance</h2>
            </div>
            <span className="chart-total">{answers.length} Qs</span>
          </div>
          <div className="accuracy-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accuracyData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="72%"
                  outerRadius="92%"
                  paddingAngle={correctCount && missedAnswers.length ? 5 : 0}
                  stroke="none"
                  isAnimationActive={!reduceMotion}
                  animationDuration={500}
                >
                  <Cell fill="#e5ae3d" />
                  <Cell fill="#ee735c" />
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#202722', border: '1px solid #424b40', borderRadius: '10px', color: '#f5f0e5' }}
                  itemStyle={{ color: '#f5f0e5' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="accuracy-chart__center" aria-hidden="true">
              <strong>{correctCount}</strong>
              <span>RIGHT</span>
            </div>
          </div>
          <div className="chart-legend">
            <span><i className="legend-dot legend-dot--correct" /> Correct · {correctCount}</span>
            <span><i className="legend-dot legend-dot--missed" /> To learn · {missedAnswers.length}</span>
          </div>
        </article>

        <article className="chart-panel chart-panel--categories">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR TERRITORY</p>
              <h2>Category accuracy</h2>
            </div>
          </div>
          <div className="category-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryStats} layout="vertical" margin={{ top: 4, right: 22, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#303830" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} stroke="#92988d" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis type="category" dataKey="category" width={116} stroke="#d8d2c5" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  formatter={(value, _name, item) => [`${value}% · ${item.payload.correct}/${item.payload.total} right`, 'Accuracy']}
                  contentStyle={{ background: '#202722', border: '1px solid #424b40', borderRadius: '10px', color: '#f5f0e5' }}
                  itemStyle={{ color: '#f5f0e5' }}
                />
                <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} maxBarSize={16} isAnimationActive={!reduceMotion} animationDuration={550}>
                  {categoryStats.map((item, index) => (
                    <Cell key={item.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-caption">A little practice in each territory adds up.</p>
        </article>
      </div>

      <section className="answer-review" aria-labelledby="review-title">
        <div className="panel-heading answer-review__heading">
          <div>
            <p className="eyebrow">THE TAKEAWAY</p>
            <h2 id="review-title">{missedAnswers.length ? 'Let’s turn misses into wins.' : 'Nothing to review. You nailed it.'}</h2>
            <p className="review-intro">
              {missedAnswers.length
                ? 'See the right answer and the story behind it, then take another shot.'
                : 'Your next challenge is waiting whenever you are.'}
            </p>
          </div>
          {missedAnswers.length > 0 && (
            <button className="btn btn-primary retry-button" onClick={onRetryMissed}>
              Retry {missedAnswers.length} missed
            </button>
          )}
        </div>

        {missedAnswers.length > 0 && (
          <ol className="review-list">
            {missedAnswers.map((answer, index) => {
              const question = questionsById.get(answer.questionId);
              if (!question) return null;

              const correctOption = question.options.find((option) => option.isCorrect);
              const selectedOption = question.options.find((option) => option.id === answer.answerId);

              return (
                <li className="review-card" key={answer.questionId}>
                  <span className="review-card__number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="review-card__content">
                    <div className="review-card__meta">
                      <span>{question.category}</span>
                      <span>{question.difficulty}</span>
                    </div>
                    <h3>{question.text}</h3>
                    <p className="review-card__answer review-card__answer--missed">
                      <span>Your answer</span>
                      <strong>{selectedOption?.text || 'Time ran out'}</strong>
                    </p>
                    <p className="review-card__answer review-card__answer--correct">
                      <span>Right answer</span>
                      <strong>{correctOption?.text || 'Answer unavailable'}</strong>
                    </p>
                    {question.explanation && <p className="review-card__explanation">{question.explanation}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="results-footer">
        <p>Every play makes the next one stronger.</p>
        <button className="btn btn-primary" onClick={onPlayAgain}>Play another round <span aria-hidden="true">↗</span></button>
      </div>
    </MotionSection>
  );
}

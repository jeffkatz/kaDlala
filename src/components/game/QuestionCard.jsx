import { motion, useReducedMotion } from 'motion/react';
import propTypes from 'prop-types';

const MotionDiv = motion.div;
const MotionButton = motion.button;

export default function QuestionCard({ question, onAnswer, timeLeft, isAnswered }) {
    const { category, difficulty, points, text, options } = question;
    const reduceMotion = useReducedMotion();
    const correctOption = options.find((option) => option.isCorrect);

    return (
        <MotionDiv
            className="question-card"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
        >
            <div className="question-card__heading">
                <span className="category-tag">{category}</span>
                <span className={`difficulty-tag difficulty-tag--${difficulty.toLowerCase()}`}>{difficulty}</span>
                <span className="question-points">{points} base points</span>
            </div>

            <h1 className="question-title">{text}</h1>

            <div className="answer-grid" role="group" aria-label="Choose your answer">
                {options.map((option, index) => {
                    const isRightAnswer = option.isCorrect;
                    const answerClass = isAnswered
                        ? isRightAnswer
                            ? ' answer-option--correct'
                            : ' answer-option--muted'
                        : '';

                    return (
                        <MotionButton
                            key={option.id}
                            type="button"
                            className={`answer-option${answerClass}`}
                            onClick={() => onAnswer(option.id)}
                            disabled={isAnswered}
                            aria-pressed={isAnswered && isRightAnswer}
                            whileHover={isAnswered || reduceMotion ? undefined : { y: -2 }}
                            whileTap={isAnswered || reduceMotion ? undefined : { scale: 0.985 }}
                            transition={{ duration: 0.15 }}
                        >
                            <span className="answer-option__letter">{String.fromCharCode(65 + index)}</span>
                            <span className="answer-option__text">{option.text}</span>
                            {isAnswered && isRightAnswer && <span className="answer-option__check" aria-hidden="true">✓</span>}
                        </MotionButton>
                    );
                })}
            </div>

            <div className="question-card__footer">
                <span className="answer-hint">{isAnswered ? 'Answer logged in your field notes.' : 'Trust your first thought. The clock is running.'}</span>
                {isAnswered && (
                    <span className="answer-feedback" role="status">
                        {timeLeft === 0 ? 'Time — remember:' : 'Answer:'} <strong>{correctOption?.text}</strong>
                    </span>
                )}
            </div>
        </MotionDiv>
    );
}

QuestionCard.propTypes = {
    question: propTypes.shape({
        category: propTypes.string.isRequired,
        difficulty: propTypes.string.isRequired,
        points: propTypes.number.isRequired,
        text: propTypes.string.isRequired,
        options: propTypes.arrayOf(propTypes.shape({
            id: propTypes.string.isRequired,
            text: propTypes.string.isRequired,
            isCorrect: propTypes.bool
        })).isRequired
    }).isRequired,
    onAnswer: propTypes.func.isRequired,
    timeLeft: propTypes.number.isRequired,
    isAnswered: propTypes.bool.isRequired
};

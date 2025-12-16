import { createContext, useContext, useReducer } from 'react';

// --- Initial State ---
const initialState = {
    gameState: 'IDLE', // IDLE | PLAYING | FINISHED
    score: 0,
    currentQuestionIndex: 0,
    answers: [], // [{ questionId, answerId, isCorrect, timeTaken }]
    questions: [], // Loaded at start
};

// --- Actions ---
const GAME_ACTIONS = {
    START_GAME: 'START_GAME',
    SUBMIT_ANSWER: 'SUBMIT_ANSWER',
    NEXT_QUESTION: 'NEXT_QUESTION',
    FINISH_GAME: 'FINISH_GAME',
    RESTART: 'RESTART',
};

// --- Reducer ---
function gameReducer(state, action) {
    switch (action.type) {
        case GAME_ACTIONS.START_GAME:
            return {
                ...initialState,
                questions: action.payload, // Pass questions here
                gameState: 'PLAYING',
            };

        case GAME_ACTIONS.SUBMIT_ANSWER:
            // Payload: { questionId, answerId, isCorrect, timeTaken }
            // Calculate score delta
            const points = action.payload.isCorrect ? 100 : 0; // Simplified for now

            return {
                ...state,
                score: state.score + points,
                answers: [...state.answers, action.payload],
            };

        case GAME_ACTIONS.NEXT_QUESTION:
            const nextIndex = state.currentQuestionIndex + 1;
            const isFinished = nextIndex >= state.questions.length;

            return {
                ...state,
                currentQuestionIndex: isFinished ? state.currentQuestionIndex : nextIndex,
                gameState: isFinished ? 'FINISHED' : 'PLAYING',
            };

        case GAME_ACTIONS.RESTART:
            return initialState;

        default:
            return state;
    }
}

// --- Context ---
const GameContext = createContext(null);

export function GameProvider({ children }) {
    const [state, dispatch] = useReducer(gameReducer, initialState);

    const startGame = (questions) => {
        dispatch({ type: GAME_ACTIONS.START_GAME, payload: questions });
    };

    const submitAnswer = (answerData) => {
        dispatch({ type: GAME_ACTIONS.SUBMIT_ANSWER, payload: answerData });
    };

    const nextQuestion = () => {
        dispatch({ type: GAME_ACTIONS.NEXT_QUESTION });
    };

    const restartGame = () => {
        dispatch({ type: GAME_ACTIONS.RESTART });
    };

    return (
        <GameContext.Provider value={{
            state,
            startGame,
            submitAnswer,
            nextQuestion,
            restartGame
        }}>
            {children}
        </GameContext.Provider>
    );
}

// --- Hook ---
export function useGame() {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}

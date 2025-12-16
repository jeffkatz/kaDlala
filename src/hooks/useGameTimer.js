import { useState, useEffect, useRef } from 'react';

export default function useGameTimer(duration, onExpire, resetKey) {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isRunning, setIsRunning] = useState(true);
    const timerRef = useRef(null);

    useEffect(() => {
        // Reset timer when duration or key changes
        setTimeLeft(duration);
        setIsRunning(true);
    }, [duration, resetKey]);

    useEffect(() => {
        if (!isRunning || timeLeft <= 0) {
            if (timeLeft <= 0) {
                setIsRunning(false);
                onExpire();
            }
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0; // Will trigger onExpire in the next render cycle check or immediately
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [timeLeft, isRunning, onExpire]);

    const stopTimer = () => {
        setIsRunning(false);
        clearInterval(timerRef.current);
    };

    return { timeLeft, stopTimer };
}

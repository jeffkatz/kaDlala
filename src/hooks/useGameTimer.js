import { useState, useEffect, useRef } from 'react';

export default function useGameTimer(duration, onExpire) {
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isRunning, setIsRunning] = useState(true);
    const onExpireRef = useRef(onExpire);
    const hasExpiredRef = useRef(false);

    useEffect(() => {
        onExpireRef.current = onExpire;
    }, [onExpire]);

    useEffect(() => {
        if (!isRunning || timeLeft <= 0) return;

        const intervalId = setInterval(() => {
            if (timeLeft <= 1) {
                setTimeLeft(0);
                setIsRunning(false);
                if (!hasExpiredRef.current) {
                    hasExpiredRef.current = true;
                    onExpireRef.current();
                }
                return;
            }
            setTimeLeft((previousTime) => previousTime - 1);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isRunning, timeLeft]);

    const stopTimer = () => {
        setIsRunning(false);
    };

    return { timeLeft, stopTimer };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { isOnlineConfigured, supabase } from '../lib/supabase';

function getErrorMessage(error) {
  return error?.message || 'The online room request failed. Please try again.';
}

export default function useOnlineRoom() {
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refreshInProgress = useRef(false);

  useEffect(() => {
    if (!supabase) return undefined;

    let isMounted = true;
    const savedCode = localStorage.getItem('kadlala-active-room');
    if (!savedCode) return undefined;

    async function restoreRoom() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;
        if (!user) {
          localStorage.removeItem('kadlala-active-room');
          return;
        }

        const { data, error: requestError } = await supabase.rpc('get_quiz_room_state', {
          p_code: savedCode
        });
        if (requestError) throw requestError;
        if (isMounted) {
          setPlayerId(user.id);
          setRoom(data);
          setError('');
        }
      } catch (requestError) {
        localStorage.removeItem('kadlala-active-room');
        if (isMounted) setError(getErrorMessage(requestError));
      }
    }

    restoreRoom();
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshRoom = useCallback(async () => {
    if (!supabase || !room?.code || refreshInProgress.current) return;

    refreshInProgress.current = true;
    try {
      const { data, error: requestError } = await supabase.rpc('get_quiz_room_state', {
        p_code: room.code
      });
      if (requestError) throw requestError;
      setRoom(data);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      refreshInProgress.current = false;
    }
  }, [room?.code]);

  useEffect(() => {
    if (!supabase || !room?.id) return undefined;

    const channel = supabase
      .channel(`quiz-room-${room.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quiz_rooms',
        filter: `id=eq.${room.id}`
      }, refreshRoom)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quiz_room_players',
        filter: `room_id=eq.${room.id}`
      }, refreshRoom)
      .subscribe((status, subscriptionError) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError(subscriptionError?.message || 'Live updates disconnected. Reconnecting…');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, refreshRoom]);

  async function ensureSignedIn() {
    if (!supabase) throw new Error('Online play is not configured for this deployment.');

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) return sessionData.session.user.id;

    const { data, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) throw signInError;
    if (!data.user) throw new Error('Could not start an anonymous player session.');
    return data.user.id;
  }

  async function runRequest(request) {
    setLoading(true);
    setError('');
    try {
      const id = await ensureSignedIn();
      const result = await request(id);
      if (result.error) throw result.error;
      if (result.data) {
        setPlayerId(id);
        setRoom(result.data);
        try {
          localStorage.setItem('kadlala-active-room', result.data.code);
        } catch (storageError) {
          console.warn('Could not save the active room code.', storageError);
        }
      }
      return result.data;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function createRoom(name, settings, questions) {
    return runRequest(async () => {
      const { data: created, error: createError } = await supabase.rpc('create_quiz_room', {
        p_player_name: name.trim(),
        p_settings: settings,
        p_questions: questions
      });
      if (createError) return { error: createError };

      const { data, error: stateError } = await supabase.rpc('get_quiz_room_state', {
        p_code: created.code
      });
      return { data, error: stateError };
    });
  }

  async function joinRoom(code, name) {
    return runRequest(async () => {
      const { data: joined, error: joinError } = await supabase.rpc('join_quiz_room', {
        p_code: code.trim().toUpperCase(),
        p_player_name: name.trim()
      });
      if (joinError) return { error: joinError };

      const { data, error: stateError } = await supabase.rpc('get_quiz_room_state', {
        p_code: joined.code
      });
      return { data, error: stateError };
    });
  }

  async function startRoom() {
    return runRequest(async () => {
      const { error: startError } = await supabase.rpc('start_quiz_room', {
        p_code: room.code
      });
      if (startError) return { error: startError };
      const { data, error: stateError } = await supabase.rpc('get_quiz_room_state', {
        p_code: room.code
      });
      return { data, error: stateError };
    });
  }

  async function submitAnswer(questionIndex, optionId) {
    return runRequest(async () => {
      const { error: answerError } = await supabase.rpc('submit_quiz_room_answer', {
        p_code: room.code,
        p_question_index: questionIndex,
        p_option_id: optionId
      });
      if (answerError) return { error: answerError };
      const { data, error: stateError } = await supabase.rpc('get_quiz_room_state', {
        p_code: room.code
      });
      return { data, error: stateError };
    });
  }

  const advanceRoom = useCallback(async () => {
    if (!supabase || !room?.code || loading) return;
    const { error: advanceError } = await supabase.rpc('advance_quiz_room', {
      p_code: room.code
    });
    if (advanceError) {
      setError(getErrorMessage(advanceError));
      return;
    }
    await refreshRoom();
  }, [loading, refreshRoom, room?.code]);

  async function leaveRoom() {
    if (supabase && room?.code) {
      const { error: leaveError } = await supabase.rpc('leave_quiz_room', {
        p_code: room.code
      });
      if (leaveError) setError(getErrorMessage(leaveError));
    }
    setRoom(null);
    setPlayerId(null);
    localStorage.removeItem('kadlala-active-room');
  }

  return {
    room,
    playerId,
    loading,
    error,
    isOnlineConfigured,
    createRoom,
    joinRoom,
    startRoom,
    submitAnswer,
    advanceRoom,
    refreshRoom,
    leaveRoom
  };
}

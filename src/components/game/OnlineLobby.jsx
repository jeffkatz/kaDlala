import { useEffect, useRef, useState } from 'react';
import TimerClock from './TimerClock';
import useOnlineRoom from '../../hooks/useOnlineRoom';
import { createGameDeck } from '../../lib/createGameDeck';

function getRoomTimeLeft(questionEndsAt) {
  if (!questionEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(questionEndsAt).getTime() - Date.now()) / 1000));
}

function OnlineQuestion({ room, player, playerId, timeLeft, loading, error, onSubmit }) {
  const [answerMessage, setAnswerMessage] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const question = room.question;

  async function handleAnswer(optionId) {
    if (player?.answered || timeLeft <= 0) return;
    setSelectedAnswer(optionId);
    setAnswerMessage('Sending your answer…');
    const result = await onSubmit(room.questionIndex, optionId);
    if (result) setAnswerMessage('Locked in. Waiting for everyone else…');
  }

  return (
    <div className="online-game-card">
      <div className="game-board__top">
        <div>
          <p className="eyebrow">{question.category.toUpperCase()} · {question.difficulty.toUpperCase()}</p>
          <p className="round-count">Question <strong>{String(room.questionIndex + 1).padStart(2, '0')}</strong><span> / {String(room.questionCount).padStart(2, '0')}</span></p>
        </div>
        <TimerClock timeLeft={timeLeft} totalTime={question.timeLimit} />
      </div>
      <div
        className="round-progress"
        role="progressbar"
        aria-label="Round progress"
        aria-valuemin={0}
        aria-valuemax={room.questionCount}
        aria-valuenow={room.questionIndex + 1}
      >
        <span style={{ width: `${((room.questionIndex + 1) / room.questionCount) * 100}%` }} />
      </div>
      <h1 className="question-title">{question.text}</h1>
      <div className="answer-grid" role="group" aria-label="Choose your answer">
        {question.options.map((option, index) => (
          <button
            className={`answer-option${selectedAnswer === option.id ? ' answer-option--selected' : ''}`}
            key={option.id}
            type="button"
            disabled={loading || player?.answered || timeLeft === 0}
            aria-pressed={selectedAnswer === option.id}
            onClick={() => handleAnswer(option.id)}
          >
            <span className="answer-option__letter">{String.fromCharCode(65 + index)}</span>
            <span className="answer-option__text">{option.text}</span>
          </button>
        ))}
      </div>
      <p className="online-answer-status" role="status">
        {player?.answered
          ? answerMessage || 'Answer locked in. Waiting for the crew…'
          : error || answerMessage || `${room.players.filter((item) => item.answered).length} of ${room.players.length} players answered`}
      </p>
      <div className="live-scoreboard" aria-label="Live scoreboard">
        {room.players.map((item, index) => (
          <div className={item.id === playerId ? 'live-player live-player--you' : 'live-player'} key={item.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.name}</strong>
            <small>Score at finish</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnlineLobby({
  questions,
  questionCount,
  categoryPercentages,
  onBack
}) {
  const [name, setName] = useState(() => localStorage.getItem('kadlala-player-name') || '');
  const [joinCode, setJoinCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [copyMessage, setCopyMessage] = useState('');
  const advancingRef = useRef(false);
  const {
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
  } = useOnlineRoom();
  const currentQuestion = room?.question;
  const currentPlayer = room?.players.find((player) => player.id === playerId);
  const roomEnded = room?.status === 'finished';
  const roomId = room?.id;
  const roomStatus = room?.status;
  const questionEndsAt = room?.questionEndsAt;
  const roomPlayers = room?.players;
  const questionExpired = Boolean(questionEndsAt) && getRoomTimeLeft(questionEndsAt) === 0;

  useEffect(() => {
    if (!roomId) return undefined;

    refreshRoom();
    const refreshInterval = setInterval(refreshRoom, 2500);
    return () => clearInterval(refreshInterval);
  }, [roomId, refreshRoom]);

  useEffect(() => {
    if (roomStatus !== 'playing') return undefined;

    const updateTime = () => setTimeLeft(getRoomTimeLeft(questionEndsAt));
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, [roomStatus, questionEndsAt]);

  useEffect(() => {
    if (roomStatus !== 'playing' || !roomPlayers) return undefined;

    const shouldAdvance = (timeLeft === 0 && questionExpired)
      || roomPlayers.every((player) => player.answered);
    if (!shouldAdvance || advancingRef.current) return undefined;

    advancingRef.current = true;
    advanceRoom().finally(() => {
      advancingRef.current = false;
    });
    return undefined;
  }, [roomStatus, roomPlayers, questionExpired, timeLeft, advanceRoom]);

  async function handleCreate() {
    if (!name.trim()) return;
    localStorage.setItem('kadlala-player-name', name.trim());
    const deck = createGameDeck(questions, categoryPercentages, questionCount);
    await createRoom(name, { questionCount: deck.length, categoryPercentages }, deck);
  }

  async function handleJoin() {
    if (!name.trim() || !joinCode.trim()) return;
    localStorage.setItem('kadlala-player-name', name.trim());
    await joinRoom(joinCode, name);
  }

  async function handleLeave() {
    await leaveRoom();
  }

  function handleCopyCode() {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage(`Share room code ${room.code} with your friends.`);
      return;
    }

    navigator.clipboard.writeText(room.code).then(
      () => setCopyMessage('Room code copied. Send it to your friends.'),
      (copyError) => {
        console.error('Could not copy the room code.', copyError);
        setCopyMessage('Copy failed. Share the code shown above.');
      }
    );
  }

  if (!isOnlineConfigured) {
    return (
      <section className="online-page" aria-labelledby="online-title">
        <div className="online-not-configured">
          <p className="eyebrow">LIVE PLAY · UP TO 16 PEOPLE</p>
          <h1 id="online-title">Bring your crew together.</h1>
          <p>Live rooms need a Supabase project so players can meet, see the same clock, and compete from anywhere.</p>
          <ol>
            <li>Copy <code>.env.example</code> to <code>.env.local</code>.</li>
            <li>Add your project URL and anon key.</li>
            <li>Run the SQL files in <code>supabase/migrations/</code> in filename order and enable anonymous sign-ins.</li>
          </ol>
          <button type="button" className="btn btn-primary" onClick={onBack}>Back to game</button>
        </div>
      </section>
    );
  }

  if (room) {
    return (
      <section className="online-page" aria-labelledby="room-title">
        <div className="online-topline">
          <p className="eyebrow">{room.status === 'lobby' ? 'ROOM LOBBY' : room.status === 'playing' ? 'LIVE ROUND' : 'FINAL SCOREBOARD'}</p>
          <button type="button" className="settings-back" onClick={handleLeave}>Leave room</button>
        </div>

        {room.status === 'lobby' && (
          <div className="room-lobby">
            <div className="room-code-card">
              <span>YOUR ROOM CODE</span>
              <strong id="room-title">{room.code}</strong>
              <button type="button" onClick={handleCopyCode}>Copy invite code</button>
              {copyMessage && <span className="room-copy-status" role="status">{copyMessage}</span>}
            </div>
            <div className="room-players">
              <div className="settings-card__heading">
                <div><p className="eyebrow">THE CREW</p><h2>Players in the room</h2></div>
                <span className="weight-total">{room.players.length}<small> / 16</small></span>
              </div>
              <ol className="player-list">
                {room.players.map((player, index) => (
                  <li key={player.id}>
                    <span className="player-list__number">{String(index + 1).padStart(2, '0')}</span>
                    <strong>{player.name}{player.id === room.hostId && <small> HOST</small>}</strong>
                    {player.id === playerId && <span className="you-tag">YOU</span>}
                  </li>
                ))}
              </ol>
              {room.hostId === playerId ? (
                <button
                  type="button"
                  className="btn btn-primary room-start-button"
                  onClick={startRoom}
                  disabled={loading || room.players.length < 2}
                >
                  {room.players.length < 2 ? 'Waiting for a friend…' : 'Start the round'}
                </button>
              ) : (
                <p className="room-wait-note">The host will start when everyone is ready.</p>
              )}
            </div>
          </div>
        )}

        {room.status === 'playing' && currentQuestion && (
          <OnlineQuestion
            key={`${room.id}-${room.questionIndex}`}
            room={room}
            player={currentPlayer}
            playerId={playerId}
            timeLeft={timeLeft}
            loading={loading}
            error={error}
            onSubmit={submitAnswer}
          />
        )}

        {roomEnded && (
          <div className="room-finished">
            <p className="eyebrow">THE ROUND IS IN</p>
            <h1 id="room-title">The field notes.</h1>
            <ol className="player-list player-list--results">
              {room.players.map((player, index) => (
                <li className={player.id === playerId ? 'winner-row' : ''} key={player.id}>
                  <span className="player-list__number">{String(index + 1).padStart(2, '0')}</span>
                  <strong>{player.name}{index === 0 && <small> TOP SCORE</small>}</strong>
                  <span className="winner-score">{player.score.toLocaleString()} pts</span>
                </li>
              ))}
            </ol>
            {room.review?.map((question, index) => (
              <article className="review-card room-review-card" key={question.id}>
                <span className="review-card__number">{String(index + 1).padStart(2, '0')}</span>
                <div className="review-card__content">
                  <div className="review-card__meta"><span>{question.category}</span><span>{question.difficulty}</span></div>
                  <h3>{question.text}</h3>
                  <p className="review-card__answer review-card__answer--correct">
                    <span>Right answer</span>
                    <strong>{question.options.find((option) => option.id === question.correctOptionId)?.text}</strong>
                  </p>
                  <p className="review-card__explanation">{question.explanation}</p>
                </div>
              </article>
            ))}
            <button className="btn btn-primary" type="button" onClick={handleLeave}>Back to home</button>
          </div>
        )}

        {error && <p className="online-error" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="online-page" aria-labelledby="online-title">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">LIVE PLAY · UP TO 16 PEOPLE</p>
          <h1 id="online-title">Bring your crew together.</h1>
          <p>One room code. Same questions, same clock. Highest score takes the bragging rights.</p>
        </div>
        <button type="button" className="settings-back" onClick={onBack}>Back to game</button>
      </div>

      <div className="online-entry-grid">
        <section className="settings-card" aria-labelledby="create-room-title">
          <p className="eyebrow">HOST A GAME</p>
          <h2 id="create-room-title">Make a room</h2>
          <p className="settings-description">Choose your name and share the invite code with your friends.</p>
          <label className="settings-field">
            <span>Your player name</span>
            <input maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Thandi" />
          </label>
          <button className="btn btn-primary" type="button" disabled={loading || !name.trim()} onClick={handleCreate}>
            {loading ? 'Creating room…' : 'Create a room'}
          </button>
        </section>
        <section className="settings-card" aria-labelledby="join-room-title">
          <p className="eyebrow">JOIN YOUR FRIENDS</p>
          <h2 id="join-room-title">Got an invite code?</h2>
          <p className="settings-description">Enter the eight-character code shared by your host.</p>
          <label className="settings-field">
            <span>Room code</span>
            <input maxLength={8} autoCapitalize="characters" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="A1B2C3D4" />
          </label>
          <button className="btn btn-primary" type="button" disabled={loading || !name.trim() || joinCode.length !== 8} onClick={handleJoin}>
            {loading ? 'Joining room…' : 'Join the room'}
          </button>
        </section>
      </div>
      <p className="online-footnote">Your anonymous guest session is kept in this browser so you can reconnect to your game.</p>
      {error && <p className="online-error" role="alert">{error}</p>}
    </section>
  );
}

create table if not exists public.quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  question_count integer not null check (question_count between 1 and 15),
  category_percentages jsonb not null default '{}'::jsonb,
  current_question_index integer not null default 0,
  question_started_at timestamptz,
  question_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_room_players (
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  score integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  last_answered_question integer not null default -1,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.quiz_room_questions (
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  question_index integer not null,
  question_id text not null,
  category text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  points integer not null check (points > 0),
  text text not null,
  options jsonb not null,
  correct_option_id text not null,
  explanation text not null,
  time_limit integer not null check (time_limit between 5 and 60),
  primary key (room_id, question_index)
);

create index if not exists quiz_room_players_room_id_idx on public.quiz_room_players(room_id);

alter table public.quiz_rooms enable row level security;
alter table public.quiz_room_players enable row level security;
alter table public.quiz_room_questions enable row level security;

create or replace function public.is_quiz_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.quiz_room_players
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

drop policy if exists "room members can read room state" on public.quiz_rooms;
create policy "room members can read room state"
  on public.quiz_rooms for select to authenticated
  using (public.is_quiz_room_member(id));

drop policy if exists "room members can read scoreboard" on public.quiz_room_players;
create policy "room members can read scoreboard"
  on public.quiz_room_players for select to authenticated
  using (public.is_quiz_room_member(room_id));

revoke all on public.quiz_room_questions from anon, authenticated;
revoke insert, update, delete on public.quiz_rooms from anon, authenticated;
revoke insert, update, delete on public.quiz_room_players from anon, authenticated;
grant select on public.quiz_rooms, public.quiz_room_players to authenticated;

create or replace function public.create_quiz_room(
  p_player_name text,
  p_settings jsonb,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.quiz_rooms%rowtype;
  v_question jsonb;
  v_options jsonb;
  v_correct_option_id text;
  v_index integer := 0;
  v_code text;
begin
  if v_user_id is null then raise exception 'Sign in is required to create a room.'; end if;
  if char_length(trim(p_player_name)) not between 1 and 24 then raise exception 'Player name must be 1–24 characters.'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 15 then
    raise exception 'A room must have between 1 and 15 questions.';
  end if;
  if (p_settings->>'questionCount')::integer <> jsonb_array_length(p_questions) then
    raise exception 'The question count does not match the selected round length.';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.quiz_rooms where code = v_code);
  end loop;

  insert into public.quiz_rooms (code, host_user_id, question_count, category_percentages)
    values (v_code, v_user_id, jsonb_array_length(p_questions), coalesce(p_settings->'categoryPercentages', '{}'::jsonb))
    returning * into v_room;

  insert into public.quiz_room_players (room_id, user_id, display_name)
    values (v_room.id, v_user_id, trim(p_player_name));

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    if jsonb_typeof(v_question->'options') <> 'array'
      or jsonb_array_length(v_question->'options') <> 4
      or (select count(*) from jsonb_array_elements(v_question->'options') option where (option->>'isCorrect')::boolean) <> 1 then
      raise exception 'Question % must have four options and exactly one correct answer.', coalesce(v_question->>'id', v_index::text);
    end if;

    select jsonb_agg(option - 'isCorrect'), max(option->>'id') filter (where (option->>'isCorrect')::boolean)
      into v_options, v_correct_option_id
      from jsonb_array_elements(v_question->'options') option;

    insert into public.quiz_room_questions (
      room_id, question_index, question_id, category, difficulty, points, text,
      options, correct_option_id, explanation, time_limit
    )
    values (
      v_room.id, v_index, v_question->>'id', v_question->>'category', v_question->>'difficulty',
      (v_question->>'points')::integer, v_question->>'text', v_options, v_correct_option_id,
      v_question->>'explanation', (v_question->>'timeLimit')::integer
    );
    v_index := v_index + 1;
  end loop;

  return jsonb_build_object('code', v_room.code, 'roomId', v_room.id, 'status', v_room.status);
end;
$$;

create or replace function public.join_quiz_room(p_code text, p_player_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.quiz_rooms%rowtype;
  v_player_count integer;
begin
  if v_user_id is null then raise exception 'Sign in is required to join a room.'; end if;
  if char_length(trim(p_player_name)) not between 1 and 24 then raise exception 'Player name must be 1–24 characters.'; end if;

  select * into v_room from public.quiz_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'No room found with that code.'; end if;
  if v_room.status <> 'lobby' and not exists (
    select 1 from public.quiz_room_players where room_id = v_room.id and user_id = v_user_id
  ) then
    raise exception 'This room has already started; only existing players can reconnect.';
  end if;

  select count(*) into v_player_count from public.quiz_room_players where room_id = v_room.id;
  if v_player_count >= 16 and not exists (
    select 1 from public.quiz_room_players where room_id = v_room.id and user_id = v_user_id
  ) then
    raise exception 'This room is full (maximum 16 players).';
  end if;

  insert into public.quiz_room_players (room_id, user_id, display_name)
    values (v_room.id, v_user_id, trim(p_player_name))
    on conflict (room_id, user_id) do update set display_name = excluded.display_name;

  return jsonb_build_object('code', v_room.code, 'roomId', v_room.id, 'status', v_room.status);
end;
$$;

create or replace function public.get_quiz_room_state(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_room public.quiz_rooms%rowtype;
  v_question public.quiz_room_questions%rowtype;
  v_player public.quiz_room_players%rowtype;
  v_players jsonb;
  v_question_json jsonb;
  v_review jsonb;
begin
  select * into v_room from public.quiz_rooms where code = upper(trim(p_code));
  if not found then raise exception 'Room not found.'; end if;
  if not exists (select 1 from public.quiz_room_players where room_id = v_room.id and user_id = auth.uid()) then
    raise exception 'You are not a member of this room.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', user_id, 'name', display_name, 'score', score, 'streak', streak, 'bestStreak', best_streak,
    'answered', last_answered_question = v_room.current_question_index
  ) order by score desc, joined_at), '[]'::jsonb)
    into v_players
    from public.quiz_room_players where room_id = v_room.id;

  select * into v_player from public.quiz_room_players
    where room_id = v_room.id and user_id = auth.uid();

  select * into v_question from public.quiz_room_questions
    where room_id = v_room.id and question_index = v_room.current_question_index;

  if found then
    v_question_json := jsonb_build_object(
      'id', v_question.question_id, 'category', v_question.category, 'difficulty', v_question.difficulty,
      'points', v_question.points, 'text', v_question.text, 'options', v_question.options,
      'timeLimit', v_question.time_limit
    );
    if v_room.status = 'finished' then
      v_question_json := v_question_json || jsonb_build_object(
        'correctOptionId', v_question.correct_option_id, 'explanation', v_question.explanation
      );
    end if;
  end if;

  if v_room.status = 'finished' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', question_id, 'category', category, 'difficulty', difficulty, 'text', text,
      'options', options, 'correctOptionId', correct_option_id, 'explanation', explanation
    ) order by question_index), '[]'::jsonb)
      into v_review from public.quiz_room_questions where room_id = v_room.id;
  end if;

  return jsonb_build_object(
    'id', v_room.id, 'code', v_room.code, 'hostId', v_room.host_user_id,
    'status', v_room.status, 'questionCount', v_room.question_count,
    'questionIndex', v_room.current_question_index, 'questionStartedAt', v_room.question_started_at,
    'questionEndsAt', v_room.question_ends_at, 'categoryPercentages', v_room.category_percentages,
    'players', v_players, 'question', v_question_json, 'review', v_review,
    'playerId', v_player.user_id, 'hasAnswered', v_player.last_answered_question = v_room.current_question_index
  );
end;
$$;

create or replace function public.start_quiz_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_room public.quiz_rooms%rowtype;
  v_time_limit integer;
begin
  select * into v_room from public.quiz_rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.host_user_id <> auth.uid() then raise exception 'Only the room host can start the game.'; end if;
  if v_room.status <> 'lobby' then raise exception 'This room has already started.'; end if;

  select time_limit into v_time_limit from public.quiz_room_questions
    where room_id = v_room.id and question_index = 0;
  update public.quiz_rooms set status = 'playing', question_started_at = now(),
    question_ends_at = now() + make_interval(secs => v_time_limit)
    where id = v_room.id;
end;
$$;

create or replace function public.submit_quiz_room_answer(
  p_code text,
  p_question_index integer,
  p_option_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_room public.quiz_rooms%rowtype;
  v_player public.quiz_room_players%rowtype;
  v_question public.quiz_room_questions%rowtype;
  v_correct boolean;
  v_points integer := 0;
  v_time_taken integer;
  v_streak integer;
  v_streak_bonus integer := 0;
begin
  select * into v_room from public.quiz_rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'playing' then raise exception 'This room is not accepting answers.'; end if;
  if v_room.current_question_index <> p_question_index then raise exception 'That question has already ended.'; end if;
  if now() >= v_room.question_ends_at then raise exception 'Time has run out for this question.'; end if;

  select * into v_player from public.quiz_room_players
    where room_id = v_room.id and user_id = auth.uid() for update;
  if not found then raise exception 'You are not a member of this room.'; end if;
  if v_player.last_answered_question = p_question_index then raise exception 'You already answered this question.'; end if;

  select * into v_question from public.quiz_room_questions
    where room_id = v_room.id and question_index = p_question_index;
  if p_option_id is not null and not exists (
    select 1 from jsonb_array_elements(v_question.options) option where option->>'id' = p_option_id
  ) then raise exception 'That answer is not an option for this question.'; end if;

  v_correct := coalesce(p_option_id = v_question.correct_option_id, false);
  v_time_taken := greatest(0, floor(extract(epoch from (now() - v_room.question_started_at)))::integer);
  v_streak := case when v_correct then v_player.streak + 1 else 0 end;
  if v_correct then
    v_streak_bonus := case when v_streak >= 3 and v_streak % 3 = 0 then 50 else 0 end;
    v_points := v_question.points + ceil(greatest(0, extract(epoch from (v_room.question_ends_at - now()))) * 4)::integer + v_streak_bonus;
  end if;

  update public.quiz_room_players set
    score = score + v_points,
    streak = v_streak,
    best_streak = greatest(best_streak, v_streak),
    last_answered_question = p_question_index
    where room_id = v_room.id and user_id = auth.uid();

  return jsonb_build_object('correct', v_correct, 'points', v_points, 'streak', v_streak, 'timeTaken', v_time_taken);
end;
$$;

create or replace function public.advance_quiz_room(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_room public.quiz_rooms%rowtype;
  v_player_count integer;
  v_answered_count integer;
  v_next_index integer;
  v_time_limit integer;
begin
  select * into v_room from public.quiz_rooms where code = upper(trim(p_code)) for update;
  if not found or v_room.status <> 'playing' then return false; end if;
  if not exists (
    select 1 from public.quiz_room_players where room_id = v_room.id and user_id = auth.uid()
  ) then return false; end if;

  select count(*), count(*) filter (where last_answered_question = v_room.current_question_index)
    into v_player_count, v_answered_count
    from public.quiz_room_players where room_id = v_room.id;
  if now() < v_room.question_ends_at and v_answered_count < v_player_count then return false; end if;

  v_next_index := v_room.current_question_index + 1;
  if v_next_index >= v_room.question_count then
    update public.quiz_rooms set status = 'finished', current_question_index = v_room.question_count,
      question_started_at = null, question_ends_at = null where id = v_room.id;
    return true;
  end if;

  select time_limit into v_time_limit from public.quiz_room_questions
    where room_id = v_room.id and question_index = v_next_index;
  update public.quiz_rooms set current_question_index = v_next_index,
    question_started_at = now(), question_ends_at = now() + make_interval(secs => v_time_limit)
    where id = v_room.id;
  return true;
end;
$$;

create or replace function public.leave_quiz_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_room public.quiz_rooms%rowtype;
begin
  select * into v_room from public.quiz_rooms where code = upper(trim(p_code)) for update;
  if not found then return; end if;
  if v_room.status = 'lobby' and v_room.host_user_id = auth.uid() then
    delete from public.quiz_rooms where id = v_room.id;
    return;
  end if;
  delete from public.quiz_room_players where room_id = v_room.id and user_id = auth.uid();
end;
$$;

revoke all on function public.create_quiz_room(text, jsonb, jsonb) from public;
revoke all on function public.is_quiz_room_member(uuid) from public;
revoke all on function public.join_quiz_room(text, text) from public;
revoke all on function public.get_quiz_room_state(text) from public;
revoke all on function public.start_quiz_room(text) from public;
revoke all on function public.submit_quiz_room_answer(text, integer, text) from public;
revoke all on function public.advance_quiz_room(text) from public;
revoke all on function public.leave_quiz_room(text) from public;
grant execute on function public.create_quiz_room(text, jsonb, jsonb) to authenticated;
grant execute on function public.is_quiz_room_member(uuid) to authenticated;
grant execute on function public.join_quiz_room(text, text) to authenticated;
grant execute on function public.get_quiz_room_state(text) to authenticated;
grant execute on function public.start_quiz_room(text) to authenticated;
grant execute on function public.submit_quiz_room_answer(text, integer, text) to authenticated;
grant execute on function public.advance_quiz_room(text) to authenticated;
grant execute on function public.leave_quiz_room(text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.quiz_rooms;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.quiz_room_players;
exception when duplicate_object then null;
end;
$$;

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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', user_id, 'name', display_name,
      'answered', last_answered_question = v_room.current_question_index
    ) || case when v_room.status = 'finished' then jsonb_build_object(
      'score', score, 'streak', streak, 'bestStreak', best_streak
    ) else '{}'::jsonb end
    order by case when v_room.status = 'finished' then score end desc nulls last, joined_at
  ), '[]'::jsonb)
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

  return jsonb_build_object('accepted', true);
end;
$$;

revoke select on table public.quiz_room_players from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_room_players'
  ) then
    execute 'alter publication supabase_realtime drop table public.quiz_room_players';
  end if;
end;
$$;

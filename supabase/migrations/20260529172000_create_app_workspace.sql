create extension if not exists pgcrypto;

create table if not exists public.app_workspace (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  version integer not null default 1 check (version > 0),
  data jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_workspace enable row level security;

revoke all on public.app_workspace from anon;
revoke all on public.app_workspace from authenticated;

insert into public.app_workspace (slug, version, data)
values (
  'default',
  1,
  jsonb_build_object(
    'version', 2,
    'players', jsonb_build_array(
      jsonb_build_object('id', 'p-01', 'name', '陈浩宇', 'number', '18', 'throws', 'R', 'bats', 'R', 'positions', jsonb_build_array('P', '1B'), 'status', 'available'),
      jsonb_build_object('id', 'p-02', 'name', '林子昂', 'number', '2', 'throws', 'R', 'bats', 'L', 'positions', jsonb_build_array('C', '3B'), 'status', 'available'),
      jsonb_build_object('id', 'p-03', 'name', '王嘉诚', 'number', '7', 'throws', 'R', 'bats', 'S', 'positions', jsonb_build_array('SS', '2B'), 'status', 'available'),
      jsonb_build_object('id', 'p-04', 'name', '赵铭', 'number', '11', 'throws', 'L', 'bats', 'L', 'positions', jsonb_build_array('1B', 'RF'), 'status', 'available'),
      jsonb_build_object('id', 'p-05', 'name', '周亦凡', 'number', '23', 'throws', 'R', 'bats', 'R', 'positions', jsonb_build_array('CF', 'LF'), 'status', 'available'),
      jsonb_build_object('id', 'p-06', 'name', '许天泽', 'number', '5', 'throws', 'R', 'bats', 'R', 'positions', jsonb_build_array('3B', 'SS'), 'status', 'available'),
      jsonb_build_object('id', 'p-07', 'name', '黄景澄', 'number', '9', 'throws', 'L', 'bats', 'L', 'positions', jsonb_build_array('LF', 'CF'), 'status', 'available'),
      jsonb_build_object('id', 'p-08', 'name', '李沐阳', 'number', '16', 'throws', 'R', 'bats', 'R', 'positions', jsonb_build_array('RF', 'P'), 'status', 'available'),
      jsonb_build_object('id', 'p-09', 'name', '郑一诺', 'number', '33', 'throws', 'R', 'bats', 'S', 'positions', jsonb_build_array('2B', 'SS'), 'status', 'available'),
      jsonb_build_object('id', 'p-10', 'name', '孙柏川', 'number', '12', 'throws', 'R', 'bats', 'L', 'positions', jsonb_build_array('C', '1B'), 'status', 'rest'),
      jsonb_build_object('id', 'p-11', 'name', '唐睿', 'number', '27', 'throws', 'L', 'bats', 'L', 'positions', jsonb_build_array('P', 'CF'), 'status', 'available'),
      jsonb_build_object('id', 'p-12', 'name', '马启航', 'number', '44', 'throws', 'R', 'bats', 'R', 'positions', jsonb_build_array('3B', 'LF'), 'status', 'injured')
    ),
    'scenarios', jsonb_build_array(
      jsonb_build_object(
        'id', 'scenario-default',
        'name', '默认方案',
        'note', '常规先发方案',
        'assignments', jsonb_build_object(
          'defense', jsonb_build_object('P', null, 'C', null, '1B', null, '2B', null, '3B', null, 'SS', null, 'LF', null, 'CF', null, 'RF', null),
          'lineup', jsonb_build_array(null, null, null, null, null, null, null, null, null)
        ),
        'createdAt', timezone('utc', now())::text,
        'updatedAt', timezone('utc', now())::text
      )
    ),
    'activeScenarioId', 'scenario-default',
    'preferences', jsonb_build_object('helpDismissed', false)
  )
)
on conflict (slug) do nothing;

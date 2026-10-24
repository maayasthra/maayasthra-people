/* What this build is, and what changed in each release. Update CHANGELOG (newest first) and the version in package.json when you ship. */
export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.5.0';
export const BUILT = typeof __BUILD_DATE__ !== 'undefined' ? new Date(__BUILD_DATE__) : new Date();

export const CHANGELOG = [
  { version: '1.5.0', date: '24 Oct 2026', title: 'Project managers, task timers and hours', items: [
    'New Project manager role: runs the whole board, Team and Project hours, and assigns and removes tasks',
    'My Tasks now has To do, Doing and Completed, with a live timer on every task',
    'Project hours shows the time logged by each person, by week, month or all time',
    'Checking out stops your timers, and warns you first with a list of what is still running',
    'Board: drag columns to reorder them, hide the ones you do not need, and Retainer comes first',
    'Employees see only their own tasks',
    'Stricter safeguards: cards cannot be handed to others by employees, leave decisions cannot double-book, and check-out uses the server clock',
    'This About page'
  ] },
  { version: '1.4.0', date: '23 Oct 2026', title: 'Profiles, IDs and leave', items: [
    'New profile page and a simpler edit form, with square photo cropping',
    'Photos, names and roles now update for everyone straight away',
    'Employee IDs read M-<number>',
    'Admins can decide their own leave, and every decision shows who made it',
    'Leave types are Sick, Casual and Emergency',
    'Redesigned Requests page and leave form'
  ] },
  { version: '1.3.0', date: '23 Oct 2026', title: 'Kanban polish and a consistent look', items: [
    'New card drawer with a subtask checklist and comments',
    'Complete with one tick, and a New task row under every column',
    'One look for tabs, buttons and empty states across every page',
    'Org chart rebuilt, with every leader and team shown',
    'Rules enforced by the database itself: no overlapping leave, balances per year, notice periods and a safe last admin'
  ] },
  { version: '1.2.0', date: '22 Oct 2026', title: 'One shared database', items: [
    'Leave, holidays, attendance, tasks and announcements are now shared across the team and update live',
    'Check-in and check-out are timed by the server, and close at the end of the working day',
    'Staff can create their own account with their work email'
  ] },
  { version: '1.1.0', date: '21 Oct 2026', title: 'Sign-in and the staff directory', items: [
    'Real sign-in with email confirmation and password reset',
    'The staff directory lives in the database; phone numbers and emergency contacts are visible only to the person and admins',
    'Admin and Employee roles'
  ] },
  { version: '1.0.0', date: '20 Oct 2026', title: 'First release', items: [
    'People directory, org chart and team calendar',
    'Leave requests and approvals',
    'Check-in, check-out and working hours',
    'Maayasthra Task: a Kanban board for the studio',
    'Works on phones, tablets and computers'
  ] }
];

export const MODULES = [
  ['people', 'People', 'The directory, org chart and calendar for everyone at Maayasthra.'],
  ['leaves', 'Leave', 'Apply for Sick, Casual or Emergency leave and see who decided.'],
  ['clock', 'Attendance', 'Check in and out, see your hours and your team’s month at a glance.'],
  ['board', 'Tasks', 'The board, and My Tasks with a timer for every card.'],
  ['timer', 'Project hours', 'Time logged on tasks, added up for each person.'],
  ['megaphone', 'Announcements', 'Studio notices on everyone’s Home page.']
];

export const ROLES = [
  ['Employee', 'Your own profile, leave, hours and your own tasks.'],
  ['Project manager', 'Everything an employee has, plus the whole board, Team and Project hours. Assigns and removes tasks.'],
  ['Admin', 'Everything, including people, leave approvals and settings.']
];

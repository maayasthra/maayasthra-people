/* What this build is, and what changed in each release. Update CHANGELOG (newest first) and the version in package.json when you ship. */
export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.6.0';
export const BUILT = typeof __BUILD_DATE__ !== 'undefined' ? new Date(__BUILD_DATE__) : new Date();

export const CHANGELOG = [
  { version: '1.6.0', date: '26 Oct 2026', title: 'End-of-day reports', items: [
    'Checking out now asks for an end-of-day report: what you worked on, with hours, and subtasks under each project',
    'EOD reports replaces Project hours. Everyone sees their own days; admins and project managers see everyone, by day, week or month',
    'Task timing is gone from My Tasks and the card drawer. Doing now just marks what you are on, and resets when you check out',
    'Board columns are Pending Tasks, Retainer Tasks, then Priority Tasks. Only Retainer is coloured, and its cards have a soft blue tint',
    'The board uses more of the screen',
    'New announcements pop up with a chime during working hours, until you close them. If the page is in the background you also get a desktop alert',
    'Change password in the account menu; the People page is gone from the menu (use Org chart)',
    'The board takes a little less space',
    'Board: drag a department by its heading to reorder departments, or drag a column onto a department to move it in',
    'A separate Announcements page in the menu, with the acknowledgement tracker for admins',
    'Announcement alerts repeat every minute until you press Got it, and admins can see who has acknowledged each announcement',
    'A short sound when you check in and when you check out',
    'New Maayasthra logo and website icon',
    'You can now have several cards in Doing at once',
    'Admins: sort the board’s columns into departments by hand (Departments button on the board), each with its own name, colour and emoji. Anyone can close and open a whole department',
    'Admins: a new Members page with everyone’s access, last login and account date, an Invite Members button, and a sign-up link to share'
  ] },
  { version: '1.5.1', date: '26 Oct 2026', title: 'No automatic check-out', items: [
    'You now stay checked in until you check out yourself; nothing ends your day at the shift end',
    'Check-in is open at any hour',
    'Timers and times follow India time, wherever you are',
    'A timer left running overnight no longer adds extra hours',
    'Your role or access updates on screen as soon as an admin changes it'
  ] },
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
  ['board', 'Tasks', 'The board, and My Tasks with To do, Doing and Completed.'],
  ['eod', 'EOD reports', 'A short report when you check out. Only admins and project managers see the reports.'],
  ['megaphone', 'Announcements', 'Studio notices on everyone’s Home page.']
];

export const ROLES = [
  ['Employee', 'Your own profile, leave, hours and your own tasks.'],
  ['Project manager', 'Everything an employee has, plus the whole board, Team and everyone’s EOD reports. Assigns and removes tasks.'],
  ['Admin', 'Everything, including people, leave approvals and settings.']
];

import { downloadCSV } from './ui.jsx';
import { BY, activeEmps, balances, leaveTypes } from './data.js';

// One file with everything: every request, plus each person's balances after approvals.
export function downloadLeaveReport(leaves) {
  const types = leaveTypes().map(([t]) => t);
  const head = ['Employee', 'Employee ID', 'Department', 'Request type', 'From', 'To', 'Days', 'Status', 'Reason', ...types.map(t => t + ' left')];
  const rows = [];
  activeEmps().forEach(e => {
    const mine = leaves.filter(l => l.emp === e.n);
    const left = balances(mine).map(b => b.left);
    if (!mine.length) rows.push([e.name, e.empId, e.dept, '', '', '', '', '', '', ...left]);
    else mine.forEach(l => rows.push([e.name, e.empId, e.dept, l.type, l.from, l.to, l.days, l.state, l.reason, ...left]));
  });
  downloadCSV('maayasthra-leave-report.csv', [head, ...rows]);
}

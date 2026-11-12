const dtf = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dttf = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fmtDate = (d) => (d ? dtf.format(new Date(d)) : '—');
export const fmtDateTime = (d) => (d ? dttf.format(new Date(d)) : '—');
export const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function relTime(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  const abs = Math.abs(diff);
  const units = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [2592000, 'day'], [31536000, 'month']];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (let i = units.length - 1; i >= 0; i -= 1) {
    if (abs >= units[i][0]) return rtf.format(-Math.round(diff / units[i][0]), units[i][1]);
  }
  return 'just now';
}

export const daysLeft = (due) => Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);

export const ACTION_LABELS = {
  submitted: 'Grievance submitted',
  reviewed: 'Taken up for review by CMO',
  forwarded: 'Forwarded to department',
  reassigned: 'Reassigned to another department',
  investigation_started: 'Investigation started',
  progress_update: 'Progress update',
  atr_submitted: 'Action-taken report submitted',
  atr_returned: 'Report returned to department',
  resolved: 'Resolved',
  reopened: 'Reopened by citizen',
  escalated: 'Escalated',
  feedback: 'Citizen feedback received',
  remark: 'Update from officials',
  returned_to_cmo: 'Returned to CMO by department',
  updated: 'Details updated',
};

export const ROLE_LABELS = { citizen: 'Citizen', cmo_admin: 'CMO Administrator', dept_officer: 'Department Officer' };

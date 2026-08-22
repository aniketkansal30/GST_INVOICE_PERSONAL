export function getDateRange(preset, customFrom, customTo) {
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'this_week': {
      const d = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(d); monday.setDate(d.getDate() - diff);
      return { from: startOfDay(monday), to: endOfDay(now) };
    }
    case 'this_month':
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) };
    case 'this_year':
      return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) };
    case 'custom':
      if (!customFrom || !customTo) return { from: null, to: null };
      return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
    case 'all_time':
    default:
      return { from: null, to: null };
  }
}

export function filterByDateRange(items, dateField, preset, customFrom, customTo) {
  const { from, to } = getDateRange(preset, customFrom, customTo);
  if (!from || !to) return items; // all time — koi filter nahi
  return items.filter((item) => {
    const d = new Date(item[dateField]);
    return d >= from && d <= to;
  });
}
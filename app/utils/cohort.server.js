function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function computeCohortRetention(rows, monthsBack = 6) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const cohorts = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    cohorts.push({
      key: monthKey(date.getFullYear(), date.getMonth()),
      label: monthLabel(date.getFullYear(), date.getMonth()),
      year: date.getFullYear(),
      month: date.getMonth(),
      members: [],
    });
  }

  for (const row of rows) {
    if (!row.subscription_start_date) continue;
    const startDate = new Date(row.subscription_start_date);
    if (isNaN(startDate.getTime())) continue;
    const key = monthKey(startDate.getFullYear(), startDate.getMonth());
    const cohort = cohorts.find((c) => c.key === key);
    if (cohort) cohort.members.push(row);
  }

  for (const cohort of cohorts) {
    cohort.size = cohort.members.length;
    cohort.retention = [];

    for (let offset = 0; offset < monthsBack; offset++) {
      const thresholdDate = new Date(cohort.year, cohort.month + offset + 1, 1);

      if (thresholdDate > today) {
        cohort.retention.push({ offset, retained: null, rate: null });
        continue;
      }

      let retained = 0;
      for (const member of cohort.members) {
        if (!member.cancellation_date) {
          retained++;
          continue;
        }
        const cancelDate = new Date(member.cancellation_date);
        if (isNaN(cancelDate.getTime()) || cancelDate >= thresholdDate) {
          retained++;
        }
      }

      cohort.retention.push({
        offset,
        retained,
        rate: cohort.size > 0 ? (retained / cohort.size) * 100 : null,
      });
    }
  }

  const totalSubscribers = cohorts.reduce((sum, c) => sum + c.size, 0);
  const maxOffset = monthsBack;

  return {
    cohorts: cohorts.map((c) => ({
      key: c.key,
      label: c.label,
      size: c.size,
      retention: c.retention,
    })),
    monthsBack,
    maxOffset,
    totalSubscribers,
  };
}

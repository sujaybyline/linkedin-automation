const { addDays, format, isWeekend, startOfDay } = require("date-fns");

const DEFAULT_TIME = "09:00:00";
const DEFAULT_TZ = "America/New_York";

function nextWeekdaySlots(count, startDate = new Date()) {
  const slots = [];
  let cursor = startOfDay(startDate);

  while (slots.length < count) {
    if (!isWeekend(cursor)) {
      slots.push({
        date: format(cursor, "yyyy-MM-dd"),
        time: DEFAULT_TIME,
        timezone: DEFAULT_TZ,
      });
    }
    cursor = addDays(cursor, 1);
  }

  return slots;
}

function isPostDue(scheduledDate, scheduledTime, windowMinutes, now = new Date()) {
  try {
    const [y, m, d] = scheduledDate.split("-").map(Number);
    const [hh, mm] = scheduledTime.split(":").map(Number);
    const scheduled = new Date(y, m - 1, d, hh, mm, 0);
    const diffMs = now.getTime() - scheduled.getTime();
    return diffMs >= 0 && diffMs <= windowMinutes * 60 * 1000;
  } catch {
    return false;
  }
}

module.exports = { nextWeekdaySlots, isPostDue };

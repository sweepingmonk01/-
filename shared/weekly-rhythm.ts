// 运营层（game-topology 第 4 节最后一层）的最小可见产物：
// 本周 7 天节奏卡。
//
// 设计原则（明确反 LiveOps 反模式）：
// - 不做日推送，不做赛季，不做活动
// - 不做"连续登录奖励"或限时压力
// - 只做一件事：把"今天是 Day N / 本周已完成 X cycle"这一最小事实
//   安静地呈现给学生，对应 game-topology 第 9 节 "FOMO 过强 / 内容疲劳"
//   的反例
//
// 数据来源：interaction-resolved 快照（每条 = 一次完成的 cycle resolution）
// 时间窗：周一起算，到本周日结束。
// 跨年：date.toISOString().slice(0, 10) 已经稳定。

export type WeekDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WeeklyRhythmDay {
  dateISO: string; // YYYY-MM-DD
  dayKey: WeekDayKey;
  dayLabel: string; // 一/二/三/四/五/六/日
  completedCycles: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeeklyRhythm {
  // 周一起算的 7 天，最后一天是周日。
  days: WeeklyRhythmDay[];
  // 本周已完成 cycle 总数。
  weekTotal: number;
  // 默认目标：每天 1 cycle，一周 7。后续可在 profile 上覆盖。
  weekTarget: number;
  // 连续保持 ≥1 cycle 的天数，从今天往前数。今天 0 cycle 就是 0。
  streakDays: number;
}

const DAY_KEYS: WeekDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<WeekDayKey, string> = {
  mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六', sun: '日',
};

// 时区策略：v0 全部用 UTC 来桶日。
// resolvedAtIso.slice(0, 10) 也是 UTC 日期，保证桶 key 与显示一致。
// 后续要做 local-time 桶日时统一从这里重构，避免散落多处。
const toDateISO = (date: Date): string => date.toISOString().slice(0, 10);

// JS getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat。我们用周一起算。
const dayKeyFor = (date: Date): WeekDayKey => {
  const dow = date.getUTCDay();
  const monBased = dow === 0 ? 6 : dow - 1;
  return DAY_KEYS[monBased];
};

const startOfWeekMonday = (reference: Date): Date => {
  const dow = reference.getUTCDay();
  const offset = dow === 0 ? 6 : dow - 1;
  const monday = new Date(reference);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(reference.getUTCDate() - offset);
  return monday;
};

const addDays = (base: Date, days: number): Date => {
  const next = new Date(base);
  next.setUTCDate(base.getUTCDate() + days);
  return next;
};

export interface BuildWeeklyRhythmInput {
  // ISO 时间戳列表，每条代表一次完成的 cycle resolution。
  resolvedAtIsoList: string[];
  // 注入参考时间，便于测试和时区控制。
  referenceDate?: Date;
  weekTarget?: number;
}

export const buildWeeklyRhythm = ({
  resolvedAtIsoList,
  referenceDate = new Date(),
  weekTarget = 7,
}: BuildWeeklyRhythmInput): WeeklyRhythm => {
  const today = new Date(referenceDate);
  today.setUTCHours(0, 0, 0, 0);
  const todayISO = toDateISO(today);
  const monday = startOfWeekMonday(today);

  const buckets = new Map<string, number>();
  for (const iso of resolvedAtIsoList) {
    const dateISO = iso.slice(0, 10);
    buckets.set(dateISO, (buckets.get(dateISO) ?? 0) + 1);
  }

  const days: WeeklyRhythmDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(monday, offset);
    const dateISO = toDateISO(date);
    const dayKey = dayKeyFor(date);
    days.push({
      dateISO,
      dayKey,
      dayLabel: DAY_LABELS[dayKey],
      completedCycles: buckets.get(dateISO) ?? 0,
      isToday: dateISO === todayISO,
      isFuture: dateISO > todayISO,
    });
  }

  const weekTotal = days.reduce((acc, day) => acc + day.completedCycles, 0);

  // streakDays：从今天往前数，连续 ≥1 cycle 的天数。
  // 即便今天还没做也允许；规则：今天 0 cycle → streak 0；今天 ≥1 → 1，再往前数。
  let streakDays = 0;
  let cursor = new Date(today);
  while (true) {
    const cursorISO = toDateISO(cursor);
    const count = buckets.get(cursorISO) ?? 0;
    if (count <= 0) break;
    streakDays += 1;
    cursor = addDays(cursor, -1);
    // 只回看 60 天，避免边界异常。
    if (streakDays >= 60) break;
  }

  return { days, weekTotal, weekTarget, streakDays };
};

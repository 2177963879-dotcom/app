export type Badge = {
  id: string;
  title: string;
  desc: string;
  icon: string;
};

export const ALL_ACHIEVEMENTS: Badge[] = [
  // Special (12)
  { id: 'first_drink', title: '初饮者', desc: '记录第一杯水', icon: '💧' },
  { id: 'bucket', title: '水桶', desc: '单日饮水超过3000ml', icon: '🪣' },
  { id: 'ocean', title: '海洋', desc: '单日饮水超过4000ml', icon: '🌊' },
  { id: 'whale', title: '巨鲸', desc: '单日饮水超过5000ml', icon: '🐳' },
  { id: 'early_bird', title: '早起鸟', desc: '早上8点前喝水', icon: '🌅' },
  { id: 'night_owl', title: '夜猫子', desc: '晚上10点后喝水', icon: '🦉' },
  { id: 'noon_drink', title: '正午阳光', desc: '中午12点喝水', icon: '☀️' },
  { id: 'afternoon_tea', title: '下午茶', desc: '下午3点喝水', icon: '☕' },
  { id: 'love_520', title: '最爱萍萍', desc: '单次饮水520ml', icon: '💗' },
  { id: 'love_1314', title: '一生一世', desc: '单次饮水1314ml', icon: '💞' },
  { id: 'lucky_888', title: '发发发', desc: '单次饮水888ml', icon: '🎰' },
  { id: 'lucky_666', title: '溜溜溜', desc: '单次饮水666ml', icon: '🤙' },
  
  // Records count (15)
  ...[10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 5000, 10000].map(m => ({
    id: `records_${m}`, title: `记录达人 ${m}`, desc: `累计记录${m}次`, icon: '📝'
  })),

  // Total Volume (15)
  ...[5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000, 2000, 5000, 10000].map(m => ({
    id: `vol_${m}l`, title: `海量 ${m}L`, desc: `累计饮水${m}升`, icon: '🌊'
  })),

  // Goal Reached (20)
  ...[1, 3, 7, 14, 21, 30, 50, 100, 150, 200, 250, 300, 365, 400, 500, 600, 700, 800, 900, 1000].map(m => ({
    id: `goal_${m}`, title: `达标 ${m}天`, desc: `累计${m}天完成目标`, icon: '🎯'
  })),

  // Streaks (20)
  ...[3, 7, 14, 21, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 365, 500, 730, 1000].map(m => ({
    id: `streak_${m}`, title: `连击 ${m}天`, desc: `连续${m}天完成目标`, icon: '🔥'
  })),

  // Total Days (18)
  ...[1, 7, 14, 30, 50, 100, 150, 200, 250, 300, 365, 400, 500, 600, 700, 800, 900, 1000].map(m => ({
    id: `days_${m}`, title: `坚持 ${m}天`, desc: `累计打卡${m}天`, icon: '📅'
  }))
];

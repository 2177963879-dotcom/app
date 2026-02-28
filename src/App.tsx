import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Droplet, History as HistoryIcon, Settings as SettingsIcon, Plus, Trash2, GlassWater, Coffee, CupSoda, X, Bell, MessageSquare, Volume2, Trophy, BarChart2, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight, Share2, Loader2, RotateCcw, User, Camera, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ALL_ACHIEVEMENTS } from './achievements';
import { motion, AnimatePresence } from 'framer-motion';
import { toBlob } from 'html-to-image';
import { Lunar } from 'lunar-javascript';
import { useSwipeable } from 'react-swipeable';
import Cropper from 'react-easy-crop';

type WaterRecord = {
  id: string;
  amount: number;
  timestamp: number;
};

type DanmakuItem = {
  id: number;
  text: string;
  top: number;
};

type UserProfile = {
  avatar: string;
  nickname: string;
  birthDate: string;
  height: number;
  weight: number;
  gender: 'male' | 'female' | 'other' | '';
  region: string;
  phone: string;
};

const CircularProgress = ({ progress, goal }: { progress: number, goal: number }) => {
  const percentage = Math.min((progress / goal) * 100, 100);
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center py-8">
      <svg className="transform -rotate-90 w-64 h-64 relative z-10">
        <circle
          cx="128"
          cy="128"
          r={radius}
          stroke="currentColor"
          strokeWidth="20"
          fill="transparent"
          className="text-[var(--theme-primary-bg)]"
        />
        <circle
          cx="128"
          cy="128"
          r={radius}
          stroke="currentColor"
          strokeWidth="20"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-[var(--theme-primary)] transition-all duration-1000 ease-out"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center z-20">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold text-slate-800 tracking-tight">{progress}</span>
          <span className="text-xl text-slate-500 font-medium">ml</span>
        </div>
        <span className="text-sm text-slate-400 mt-1 font-medium">目标 {goal} ml</span>
      </div>
    </div>
  );
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('waterDarkMode') === 'true');
  const [goal, setGoal] = useState(() => Number(localStorage.getItem('waterGoal')) || 2000);
  const [records, setRecords] = useState<WaterRecord[]>(() => JSON.parse(localStorage.getItem('waterRecords') || '[]'));
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'achievements' | 'profile'>('home');
  const [historyView, setHistoryView] = useState<'list' | 'stats' | 'calendar'>('list');
  const [statsRange, setStatsRange] = useState<'hourly' | 'daily' | 'monthly'>('daily');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [reminderEnabled, setReminderEnabled] = useState(() => localStorage.getItem('waterReminderEnabled') === 'true');
  const [vibrateEnabled, setVibrateEnabled] = useState(() => localStorage.getItem('waterVibrateEnabled') !== 'false');
  const [reminderInterval, setReminderInterval] = useState<string | number>(() => localStorage.getItem('waterReminderInterval') || 60);
  const [reminderDuration, setReminderDuration] = useState<string | number>(() => localStorage.getItem('waterReminderDuration') || 5);
  const [reminderStartTime, setReminderStartTime] = useState(() => localStorage.getItem('waterReminderStartTime') || '08:00');
  const [reminderEndTime, setReminderEndTime] = useState(() => localStorage.getItem('waterReminderEndTime') || '20:00');
  const [stopOnGoal, setStopOnGoal] = useState(() => localStorage.getItem('waterStopOnGoal') !== 'false');
  const [notificationText, setNotificationText] = useState(() => localStorage.getItem('waterNotificationText') || '该喝水啦！补充水分，保持活力！');
  const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('waterThemeColor') || '#3b82f6');
  const [customRingtone, setCustomRingtone] = useState<string | null>(() => localStorage.getItem('waterCustomRingtone') || null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('waterProfile');
    return saved ? JSON.parse(saved) : {
      avatar: '',
      nickname: '新建用户名',
      birthDate: '2000-01-01',
      height: 160,
      weight: 50,
      gender: '',
      region: '',
      phone: ''
    };
  });
  const [expandedSections, setExpandedSections] = useState({
    profile: true,
    reminder: false,
    theme: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    try {
      const canvas = document.createElement('canvas');
      const image = new Image();
      image.src = cropImageSrc;
      await new Promise(resolve => { image.onload = resolve; });
      
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      
      const base64Image = canvas.toDataURL('image/jpeg');
      setProfile(p => ({ ...p, avatar: base64Image }));
      setCropImageSrc(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const unlocked = localStorage.getItem('waterAppUnlocked');
    if (unlocked === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('waterDarkMode', isDarkMode.toString());
    localStorage.setItem('waterGoal', goal.toString());
    localStorage.setItem('waterRecords', JSON.stringify(records));
    localStorage.setItem('waterReminderEnabled', reminderEnabled.toString());
    localStorage.setItem('waterVibrateEnabled', vibrateEnabled.toString());
    localStorage.setItem('waterReminderInterval', reminderInterval.toString());
    localStorage.setItem('waterReminderDuration', reminderDuration.toString());
    localStorage.setItem('waterReminderStartTime', reminderStartTime);
    localStorage.setItem('waterReminderEndTime', reminderEndTime);
    localStorage.setItem('waterStopOnGoal', stopOnGoal.toString());
    localStorage.setItem('waterNotificationText', notificationText);
    localStorage.setItem('waterThemeColor', themeColor);
    localStorage.setItem('waterProfile', JSON.stringify(profile));
    if (customRingtone) {
      try {
        localStorage.setItem('waterCustomRingtone', customRingtone);
      } catch (e) {
        console.error("Failed to save ringtone to localStorage", e);
      }
    } else {
      localStorage.removeItem('waterCustomRingtone');
    }
  }, [isDarkMode, goal, records, reminderEnabled, vibrateEnabled, reminderInterval, reminderDuration, reminderStartTime, reminderEndTime, stopOnGoal, notificationText, themeColor, customRingtone, profile]);

  const todayRecords = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return records.filter(r => r.timestamp >= startOfToday.getTime()).sort((a, b) => b.timestamp - a.timestamp);
  }, [records]);

  const todayProgress = todayRecords.reduce((sum, r) => sum + r.amount, 0);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, WaterRecord[]> = {};
    [...records].sort((a, b) => b.timestamp - a.timestamp).forEach(record => {
      const date = new Date(record.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(record);
    });
    return groups;
  }, [records]);

  const statsData = useMemo(() => {
    if (statsRange === 'hourly') {
      const data = Array.from({ length: 24 }, (_, i) => ({ name: `${i}时`, amount: 0 }));
      todayRecords.forEach(r => {
        const hour = new Date(r.timestamp).getHours();
        data[hour].amount += r.amount;
      });
      return data;
    } else if (statsRange === 'daily') {
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d);
        nextD.setDate(nextD.getDate() + 1);
        
        const dayTotal = records
          .filter(r => r.timestamp >= d.getTime() && r.timestamp < nextD.getTime())
          .reduce((sum, r) => sum + r.amount, 0);
          
        data.push({ name: format(d, 'MM/dd'), amount: dayTotal });
      }
      return data;
    } else {
      const data = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const start = startOfMonth(d);
        const end = endOfMonth(d);
        
        const monthTotal = records
          .filter(r => r.timestamp >= start.getTime() && r.timestamp <= end.getTime())
          .reduce((sum, r) => sum + r.amount, 0);
          
        data.push({ name: format(d, 'M月'), amount: monthTotal });
      }
      return data;
    }
  }, [records, statsRange, todayRecords]);

  const calendarRecords = useMemo(() => {
    const start = new Date(calendarDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    
    return records
      .filter(r => r.timestamp >= start.getTime() && r.timestamp < end.getTime())
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [records, calendarDate]);

  const { xp, level, currentLevelXp, nextLevelXp } = useMemo(() => {
    let totalXp = 0;
    const dailyTotals: Record<string, number> = {};
    
    records.forEach(record => {
      const date = new Date(record.timestamp).toLocaleDateString();
      if (!dailyTotals[date]) dailyTotals[date] = 0;
      
      const spaceLeft = 2000 - dailyTotals[date];
      if (spaceLeft > 0) {
        const xpGained = Math.min(record.amount, spaceLeft);
        dailyTotals[date] += xpGained;
        totalXp += xpGained;
      }
    });

    let lvl = 1;
    while (totalXp >= 1000 * lvl * (lvl + 1)) {
      lvl++;
    }
    
    const prevLevelTotalXp = 1000 * (lvl - 1) * lvl;
    const nextLevelTotalXp = 1000 * lvl * (lvl + 1);
    
    return {
      xp: totalXp,
      level: lvl,
      currentLevelXp: totalXp - prevLevelTotalXp,
      nextLevelXp: nextLevelTotalXp - prevLevelTotalXp
    };
  }, [records]);

  const achievements = useMemo(() => {
    const unlocked = [];
    
    const totalRecords = records.length;
    const totalVolume = records.reduce((sum, r) => sum + r.amount, 0);
    
    if (totalRecords >= 1) unlocked.push('first_drink');
    [10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 5000, 10000].forEach(m => {
      if (totalRecords >= m) unlocked.push(`records_${m}`);
    });

    [5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000, 2000, 5000, 10000].forEach(m => {
      if (totalVolume >= m * 1000) unlocked.push(`vol_${m}l`);
    });
    
    const dailyTotals: Record<string, number> = {};
    records.forEach(r => {
      const date = new Date(r.timestamp).toLocaleDateString();
      dailyTotals[date] = (dailyTotals[date] || 0) + r.amount;
    });
    
    const daysReachedGoal = Object.values(dailyTotals).filter(total => total >= goal).length;
    [1, 3, 7, 14, 21, 30, 50, 100, 150, 200, 250, 300, 365, 400, 500, 600, 700, 800, 900, 1000].forEach(m => {
      if (daysReachedGoal >= m) unlocked.push(`goal_${m}`);
    });
    
    let currentStreak = 0;
    let maxStreak = 0;
    const sortedDates = Object.keys(dailyTotals).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    let lastDate: Date | null = null;
    sortedDates.forEach(dateStr => {
      if (dailyTotals[dateStr] >= goal) {
        const date = new Date(dateStr);
        if (!lastDate) {
          currentStreak = 1;
        } else {
          const diffDays = Math.floor((date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
          } else if (diffDays > 1) {
            currentStreak = 1;
          }
        }
        maxStreak = Math.max(maxStreak, currentStreak);
        lastDate = date;
      }
    });
    
    [3, 7, 14, 21, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 365, 500, 730, 1000].forEach(m => {
      if (maxStreak >= m) unlocked.push(`streak_${m}`);
    });

    const totalDays = Object.keys(dailyTotals).length;
    [1, 7, 14, 30, 50, 100, 150, 200, 250, 300, 365, 400, 500, 600, 700, 800, 900, 1000].forEach(m => {
      if (totalDays >= m) unlocked.push(`days_${m}`);
    });
    
    if (Object.values(dailyTotals).some(total => total >= 3000)) unlocked.push('bucket');
    if (Object.values(dailyTotals).some(total => total >= 4000)) unlocked.push('ocean');
    if (Object.values(dailyTotals).some(total => total >= 5000)) unlocked.push('whale');

    if (records.some(r => new Date(r.timestamp).getHours() < 8)) unlocked.push('early_bird');
    if (records.some(r => new Date(r.timestamp).getHours() >= 22)) unlocked.push('night_owl');
    if (records.some(r => new Date(r.timestamp).getHours() === 12)) unlocked.push('noon_drink');
    if (records.some(r => new Date(r.timestamp).getHours() === 15)) unlocked.push('afternoon_tea');
    
    if (records.some(r => r.amount === 520)) unlocked.push('love_520');
    if (records.some(r => r.amount === 1314)) unlocked.push('love_1314');
    if (records.some(r => r.amount === 888)) unlocked.push('lucky_888');
    if (records.some(r => r.amount === 666)) unlocked.push('lucky_666');
    
    return unlocked;
  }, [records, goal]);

  const addWater = (amount: number) => {
    const newRecord: WaterRecord = {
      id: Date.now().toString(),
      amount,
      timestamp: Date.now(),
    };
    setRecords(prev => [...prev, newRecord]);
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const resetToday = () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    setRecords(prev => prev.filter(r => r.timestamp < todayStart.getTime()));
  };

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('button, a, input[type="submit"], .clickable');
      if (target && vibrateEnabled && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    };
    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [vibrateEnabled]);

  const onTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      if (vibrateEnabled && 'vibrate' in navigator) navigator.vibrate([50, 50, 50]);
      setShowShareMenu(true);
    }, 600);
  };

  const onTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleShare = async () => {
    setShowShareMenu(false);
    setIsGeneratingPoster(true);
    try {
      const element = document.getElementById('share-poster');
      if (!element) return;
      
      const blob = await toBlob(element, { 
        pixelRatio: 3,
        backgroundColor: 'transparent',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      if (!blob) throw new Error('Failed to generate image');

      const file = new File([blob], 'water-share.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: '我的饮水打卡',
          text: '快来和我一起健康喝水吧！',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `water-share-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        alert('海报已保存到相册！');
      }
    } catch (e) {
      console.error('Share failed', e);
      alert('生成海报失败，请重试');
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  const playNotificationSound = () => {
    const durationSec = Number(reminderDuration) || 5;
    
    if (customRingtone) {
      try {
        const audio = new Audio(customRingtone);
        audio.loop = true;
        audio.play().catch(e => console.error("Custom audio play failed", e));
        setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
        }, durationSec * 1000);
        return;
      } catch (e) {
        console.error("Custom audio setup failed", e);
      }
    }

    try {
      if ('speechSynthesis' in window) {
        const text = "喝水了，".repeat(Math.max(1, Math.ceil(durationSec / 2)));
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const triggerNotification = () => {
    playNotificationSound();
    
    const durationSec = Number(reminderDuration) || 5;
    
    if (vibrateEnabled && 'vibrate' in navigator) {
      const pattern = [];
      for (let i = 0; i < durationSec; i++) {
        pattern.push(500, 500);
      }
      navigator.vibrate(pattern);
    }
    
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const pattern = [];
        for (let i = 0; i < durationSec; i++) {
          pattern.push(500, 500);
        }
        new Notification('喝水提醒', {
          body: notificationText || '该喝水啦！',
          icon: '/favicon.ico',
          vibrate: vibrateEnabled ? pattern : undefined,
          requireInteraction: true
        } as any);
      } catch (e) {
        console.error('Notification failed', e);
      }
    }

    const newDanmaku = {
      id: Date.now(),
      text: notificationText || '该喝水啦！',
      top: 80 + Math.random() * 150
    };
    setDanmakus(prev => [...prev, newDanmaku]);
    
    setTimeout(() => {
      setDanmakus(prev => prev.filter(d => d.id !== newDanmaku.id));
    }, 8000);
  };

  const handleDanmakuCheckIn = (id: number) => {
    addWater(150);
    setDanmakus(prev => prev.filter(d => d.id !== id));
    
    const messages = ["太棒了！继续保持！", "水分充足，活力满满！", "做得好！", "健康生活每一天！"];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    
    const cheerDanmaku = {
      id: Date.now() + 1,
      text: `🎉 ${randomMsg}`,
      top: 80 + Math.random() * 150
    };
    setDanmakus(prev => [...prev, cheerDanmaku]);
    setTimeout(() => {
      setDanmakus(prev => prev.filter(d => d.id !== cheerDanmaku.id));
    }, 8000);
  };

  useEffect(() => {
    const intervalValue = Number(reminderInterval);
    if (!reminderEnabled || intervalValue <= 0) return;
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const intervalMs = intervalValue * 60 * 1000;
    // Ensure minimum interval is 5 seconds
    const safeIntervalMs = Math.max(intervalMs, 5000);

    const intervalId = setInterval(() => {
      // Check if goal is reached and stopOnGoal is enabled
      if (stopOnGoal && todayProgress >= goal) {
        return;
      }

      // Check time range
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
      
      if (currentTimeStr >= reminderStartTime && currentTimeStr <= reminderEndTime) {
        triggerNotification();
      }
    }, safeIntervalMs);
    
    return () => clearInterval(intervalId);
  }, [reminderEnabled, reminderInterval, reminderStartTime, reminderEndTime, stopOnGoal, todayProgress, goal, notificationText]);

  const quickOptions = [
    { amount: 150, icon: <GlassWater size={24} />, label: '一杯水' },
    { amount: 250, icon: <CupSoda size={24} />, label: '一瓶水' },
    { amount: 350, icon: <Coffee size={24} />, label: '马克杯' },
    { amount: 500, icon: <Droplet size={24} />, label: '大滤水壶' },
  ];

  const TABS = ['home', 'history', 'achievements', 'profile'] as const;
  
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const idx = TABS.indexOf(activeTab);
      if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1]);
    },
    onSwipedRight: () => {
      const idx = TABS.indexOf(activeTab);
      if (idx > 0) setActiveTab(TABS[idx - 1]);
    },
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  return (
    <div className={`min-h-dvh flex items-center justify-center sm:p-4 font-sans selection:bg-[var(--theme-primary-light)] ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-200 text-slate-900'}`}>
      <style>{`
        :root {
          --theme-primary: ${themeColor};
          --theme-primary-light: ${themeColor}33;
          --theme-primary-bg: ${themeColor}1A;
          --theme-primary-text: ${themeColor};
        }
      `}</style>
      <div 
        {...swipeHandlers}
        className={`w-full h-dvh sm:min-h-0 sm:max-w-[400px] sm:h-[85vh] sm:max-h-[850px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden relative flex flex-col sm:border-[8px] sm:border-slate-800 transition-colors duration-300 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
      >
        
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 bg-slate-50">
            <div className="w-20 h-20 bg-[var(--theme-primary-light)] rounded-full flex items-center justify-center text-[var(--theme-primary)] mb-8 shadow-sm">
              <Droplet size={40} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">喝水提醒Le版</h1>
            <p className="text-slate-500 mb-8 text-center">请输入专属密钥以继续使用</p>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const input = new FormData(e.currentTarget).get('authKey');
                if (input === '520LP') {
                  localStorage.setItem('waterAppUnlocked', 'true');
                  setIsAuthenticated(true);
                } else {
                  const el = document.getElementById('auth-error');
                  if (el) {
                    el.classList.remove('hidden');
                    setTimeout(() => el.classList.add('hidden'), 2000);
                  }
                }
              }} 
              className="w-full max-w-xs space-y-4"
            >
              <div>
                <input
                  name="authKey"
                  type="password"
                  placeholder="输入密钥"
                  className="w-full text-center text-lg font-bold bg-white border border-slate-200 focus:ring-4 focus:ring-[var(--theme-primary-light)] rounded-2xl p-4 outline-none transition-all shadow-sm"
                />
                <p id="auth-error" className="hidden text-red-500 text-sm text-center mt-2 font-medium animate-pulse">密钥错误，请重试</p>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-[var(--theme-primary)] text-white rounded-2xl font-bold text-lg hover:opacity-90 active:opacity-80 transition-all shadow-lg"
              >
                进入应用
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Content Area */}
            <AnimatePresence mode="wait">
            {activeTab === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`flex-1 overflow-y-auto pb-32 no-scrollbar ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
          >
            <div className={`px-6 pt-[calc(env(safe-area-inset-top,24px)+24px)] pb-4 flex justify-between items-center sticky top-0 z-10 ${isDarkMode ? 'bg-slate-800/90 text-slate-100' : 'bg-slate-50/90 text-slate-800'} backdrop-blur-md`}>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  今日饮水
                  <button 
                    onClick={resetToday}
                    className={`p-1.5 rounded-full transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}
                    title="重置今日饮水量"
                  >
                    <RotateCcw size={16} />
                  </button>
                </h1>
                <p className={`text-sm mt-1 flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {todayProgress >= goal ? '太棒了！已完成今日目标 🎉' : '记得多喝水哦'}
                  {todayProgress < goal && <Droplet size={14} className="text-[var(--theme-primary)]" />}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-colors ${isDarkMode ? 'bg-slate-700 text-yellow-400' : 'bg-white text-slate-600'}`}
                >
                  {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                </button>
                <button 
                  className="w-12 h-12 bg-[var(--theme-primary-light)] rounded-full flex items-center justify-center text-[var(--theme-primary)] shadow-sm cursor-pointer relative"
                  onClick={() => setShowGoalModal(true)}
                >
                  <Droplet size={24} className={todayProgress >= goal ? "fill-[var(--theme-primary)]" : ""} />
                </button>
              </div>
            </div>

            <CircularProgress progress={todayProgress} goal={goal} />

            <div className="px-6 mt-4 mb-2">
              <h2 className="text-lg font-semibold text-slate-800">快捷记录</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4 px-6">
              {quickOptions.map(opt => (
                <button 
                  key={opt.amount}
                  onClick={() => addWater(opt.amount)}
                  className="flex items-center gap-3 p-4 bg-white rounded-3xl shadow-sm border border-slate-100 active:bg-[var(--theme-primary-bg)] active:border-[var(--theme-primary-light)] transition-all hover:shadow-md"
                >
                  <div className="text-[var(--theme-primary)] bg-[var(--theme-primary-bg)] p-2 rounded-2xl">{opt.icon}</div>
                  <div className="flex flex-col items-start">
                    <span className="text-base font-bold text-slate-800">{opt.amount} ml</span>
                    <span className="text-xs text-slate-500 font-medium">{opt.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-y-auto bg-slate-50 no-scrollbar"
          >
            <div className="px-6 pt-[calc(env(safe-area-inset-top,24px)+24px)] pb-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-10 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">饮水记录</h1>
                {records.length > 0 && (
                  <button 
                    onClick={() => {
                      if (confirmClear) {
                        setRecords([]);
                        setConfirmClear(false);
                      } else {
                        setConfirmClear(true);
                        setTimeout(() => setConfirmClear(false), 3000);
                      }
                    }}
                    className={`p-2 rounded-full transition-colors ${confirmClear ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500'}`}
                    title={confirmClear ? "再次点击确认清除" : "清除所有记录"}
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
              
              <div className="flex p-1 bg-slate-200 rounded-xl">
                <button 
                  onClick={() => setHistoryView('list')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${historyView === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                  <List size={16} /> 列表
                </button>
                <button 
                  onClick={() => setHistoryView('stats')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${historyView === 'stats' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                  <BarChart2 size={16} /> 统计
                </button>
                <button 
                  onClick={() => setHistoryView('calendar')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${historyView === 'calendar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                >
                  <CalendarIcon size={16} /> 日历
                </button>
              </div>
            </div>
            
            <div className="px-6 pb-32 space-y-6">
              {historyView === 'list' && (
                Object.entries(groupedRecords).length === 0 ? (
                  <div className="text-center text-slate-400 mt-32">
                    <HistoryIcon size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-medium">暂无饮水记录</p>
                  </div>
                ) : (
                  Object.entries(groupedRecords).map(([date, dayRecords]: [string, WaterRecord[]]) => (
                    <div key={date}>
                      <h3 className="text-sm font-bold text-slate-400 mb-3 sticky top-36 bg-slate-50/90 py-2 backdrop-blur-sm z-10">{date}</h3>
                      <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 space-y-1">
                        {dayRecords.map(record => (
                          <div key={record.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[var(--theme-primary-bg)] rounded-full flex items-center justify-center text-[var(--theme-primary)]">
                                <Droplet size={20} className={record.amount >= 500 ? 'fill-[var(--theme-primary)]' : ''} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 text-lg">{record.amount} ml</p>
                                <p className="text-xs text-slate-400 font-medium">
                                  {new Date(record.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => deleteRecord(record.id)}
                              className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )
              )}

              {historyView === 'stats' && (
                <div className="space-y-6">
                  <div className="flex justify-center gap-2">
                    {['hourly', 'daily', 'monthly'].map(range => (
                      <button
                        key={range}
                        onClick={() => setStatsRange(range as any)}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${statsRange === range ? 'bg-[var(--theme-primary)] text-white' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {range === 'hourly' ? '今日' : range === 'daily' ? '近7天' : '近6月'}
                      </button>
                    ))}
                  </div>
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsData}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                        <Tooltip 
                          cursor={{ fill: 'var(--theme-primary-bg)' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="amount" fill="var(--theme-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {historyView === 'calendar' && (
                <div className="space-y-6">
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                      <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className="p-2 text-slate-400 hover:text-slate-800">
                        <ChevronLeft size={20} />
                      </button>
                      <span className="font-bold text-slate-800">{format(calendarDate, 'yyyy年 M月')}</span>
                      <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="p-2 text-slate-400 hover:text-slate-800">
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                        <div key={day} className="text-xs font-bold text-slate-400 py-1">{day}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {eachDayOfInterval({
                        start: startOfWeek(startOfMonth(calendarDate)),
                        end: endOfWeek(endOfMonth(calendarDate))
                      }).map((day, i) => {
                        const isCurrentMonth = isSameMonth(day, calendarDate);
                        const isSelected = isSameDay(day, calendarDate);
                        const isTodayDate = isToday(day);
                        
                        // Check if there are records for this day
                        const dayStart = new Date(day);
                        dayStart.setHours(0, 0, 0, 0);
                        const dayEnd = new Date(dayStart);
                        dayEnd.setDate(dayEnd.getDate() + 1);
                        const hasRecords = records.some(r => r.timestamp >= dayStart.getTime() && r.timestamp < dayEnd.getTime());

                        return (
                          <button
                            key={i}
                            onClick={() => setCalendarDate(day)}
                            className={`
                              aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all relative
                              ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700 font-medium'}
                              ${isSelected ? 'bg-[var(--theme-primary)] text-white font-bold shadow-md' : 'hover:bg-slate-100'}
                              ${isTodayDate && !isSelected ? 'border border-[var(--theme-primary)] text-[var(--theme-primary)]' : ''}
                            `}
                          >
                            <span>{format(day, 'd')}</span>
                            {hasRecords && (
                              <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-[var(--theme-primary)]'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-400 mb-3">{format(calendarDate, 'M月d日')} 记录</h3>
                    {calendarRecords.length === 0 ? (
                      <div className="text-center text-slate-400 mt-8">
                        <p className="font-medium text-sm">暂无饮水记录</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 space-y-1">
                        {calendarRecords.map(record => (
                          <div key={record.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[var(--theme-primary-bg)] rounded-full flex items-center justify-center text-[var(--theme-primary)]">
                                <Droplet size={20} className={record.amount >= 500 ? 'fill-[var(--theme-primary)]' : ''} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 text-lg">{record.amount} ml</p>
                                <p className="text-xs text-slate-400 font-medium">
                                  {new Date(record.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => deleteRecord(record.id)}
                              className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'achievements' && (
          <motion.div 
            key="achievements"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-y-auto bg-slate-50 no-scrollbar"
          >
            <div className="px-6 pt-[calc(env(safe-area-inset-top,24px)+24px)] pb-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
              <h1 className="text-2xl font-bold text-slate-800">成就与等级</h1>
            </div>
            
            <div className="px-6 pb-32 space-y-6 mt-2">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[var(--theme-primary-light)] to-transparent opacity-50"></div>
                <div className="w-24 h-24 bg-white rounded-full shadow-md flex items-center justify-center border-4 border-[var(--theme-primary-light)] z-10 mb-4">
                  <Trophy size={40} className="text-[var(--theme-primary)]" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-1">Lv.{level}</h2>
                <p className="text-sm font-medium text-slate-500 mb-6">总经验值: {xp} XP</p>
                
                <div className="w-full space-y-2 z-10">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Lv.{level}</span>
                    <span>Lv.{level + 1}</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--theme-primary)] transition-all duration-1000 ease-out rounded-full"
                      style={{ width: `${Math.min((currentLevelXp / nextLevelXp) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-slate-400 font-medium mt-2">
                    距离下一级还需 {nextLevelXp - currentLevelXp} XP
                  </p>
                  <p className="text-xs text-center text-slate-400 mt-2">
                    * 每日喝水最多可获得 2000 XP
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 px-2">我的徽章 ({achievements.length}/{ALL_ACHIEVEMENTS.length})</h3>
                <div className="grid grid-cols-2 gap-4">
                  {ALL_ACHIEVEMENTS.map(badge => {
                    const isUnlocked = achievements.includes(badge.id);
                    return (
                      <div 
                        key={badge.id} 
                        className={`p-4 rounded-3xl border ${isUnlocked ? 'bg-white border-[var(--theme-primary-light)] shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60 grayscale'}`}
                      >
                        <div className="text-3xl mb-2">{badge.icon}</div>
                        <h4 className={`font-bold text-sm ${isUnlocked ? 'text-slate-800' : 'text-slate-500'}`}>{badge.title}</h4>
                        <p className="text-xs text-slate-400 mt-1">{badge.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex-1 overflow-y-auto bg-slate-50 no-scrollbar"
          >
            <div className="px-6 pt-[calc(env(safe-area-inset-top,24px)+24px)] pb-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-10">
              <h1 className="text-2xl font-bold text-slate-800">我的</h1>
            </div>
            
            <div className="px-6 pb-32 space-y-6 mt-2">
              {/* Profile Section */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex flex-col items-center mb-6">
                  <label className="relative cursor-pointer group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 border-4 border-[var(--theme-primary-light)] shadow-md">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <User size={40} />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera size={24} className="text-white" />
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setCropImageSrc(event.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                        // Reset input so the same file can be selected again
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <input 
                    type="text" 
                    value={profile.nickname}
                    onChange={(e) => setProfile(p => ({ ...p, nickname: e.target.value }))}
                    className="mt-4 text-xl font-bold text-slate-800 text-center bg-transparent border-b border-transparent hover:border-slate-200 focus:border-[var(--theme-primary)] outline-none transition-colors w-32"
                    placeholder="输入昵称"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                    <span className="text-slate-600 font-medium">出生年月</span>
                    <input 
                      type="date" 
                      value={profile.birthDate}
                      onChange={(e) => setProfile(p => ({ ...p, birthDate: e.target.value }))}
                      className="text-right text-sm font-bold text-[var(--theme-primary)] bg-transparent outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                    <span className="text-slate-600 font-medium">身高 (cm)</span>
                    <input 
                      type="number" 
                      value={profile.height}
                      onChange={(e) => setProfile(p => ({ ...p, height: Number(e.target.value) }))}
                      className="w-20 text-right text-sm font-bold text-[var(--theme-primary)] bg-transparent outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                    <span className="text-slate-600 font-medium">体重 (kg)</span>
                    <input 
                      type="number" 
                      value={profile.weight}
                      onChange={(e) => setProfile(p => ({ ...p, weight: Number(e.target.value) }))}
                      className="w-20 text-right text-sm font-bold text-[var(--theme-primary)] bg-transparent outline-none"
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500 font-medium">BMI 指数</span>
                      <span className="text-sm font-bold text-slate-800">
                        {profile.height > 0 ? (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1) : '--'}
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        // Recommend water intake based on weight: 35ml per kg
                        const recommended = Math.round((profile.weight * 35) / 100) * 100;
                        setGoal(recommended);
                        alert(`已根据您的体重推荐每日饮水量：${recommended}ml`);
                      }}
                      className="w-full py-3 bg-[var(--theme-primary-bg)] text-[var(--theme-primary)] rounded-xl font-bold text-sm hover:bg-[var(--theme-primary-light)] transition-colors"
                    >
                      根据身体数据推荐饮水量
                    </button>
                  </div>
                </div>
              </div>

              {/* Settings Section */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-[var(--theme-primary-light)] rounded-full flex items-center justify-center text-[var(--theme-primary)]">
                    <SettingsIcon size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">饮水目标</h3>
                </div>
                
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                  <span className="text-slate-600 font-medium">每日目标 (ml)</span>
                  <input 
                    type="number" 
                    value={goal}
                    onChange={(e) => setGoal(Number(e.target.value) || 2000)}
                    className="w-24 text-right text-xl font-bold text-[var(--theme-primary)] bg-white border border-slate-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-[var(--theme-primary-light)] focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                      <Bell size={20} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">喝水提醒</h3>
                  </div>
                  <button 
                    onClick={() => setReminderEnabled(!reminderEnabled)}
                    className={`w-14 h-8 rounded-full transition-colors relative flex items-center px-1 ${reminderEnabled ? 'bg-[var(--theme-primary)]' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${reminderEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                
                {reminderEnabled && (
                  <div className="space-y-4 animate-slide-up border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                      <span className="text-slate-600 font-medium">提醒间隔 (分钟)</span>
                      <input 
                        type="number" 
                        value={reminderInterval}
                        onChange={(e) => setReminderInterval(e.target.value)}
                        min="0"
                        step="any"
                        className="w-20 text-right text-lg font-bold text-indigo-600 bg-white border border-slate-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-400 transition-all shadow-sm"
                      />
                    </div>
                    <p className="text-xs text-slate-400 px-2 mt-1">支持小数，例如输入 0.083 即为 5 秒。可输入 0 暂停提醒。</p>

                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                      <span className="text-slate-600 font-medium">提醒持续时间 (秒)</span>
                      <input 
                        type="number" 
                        value={reminderDuration}
                        onChange={(e) => setReminderDuration(e.target.value)}
                        min="1"
                        max="60"
                        className="w-20 text-right text-lg font-bold text-indigo-600 bg-white border border-slate-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-400 transition-all shadow-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                      <span className="text-slate-600 font-medium">提醒时间段</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="time" 
                          value={reminderStartTime}
                          onChange={(e) => setReminderStartTime(e.target.value)}
                          className="w-24 text-center text-sm font-bold text-indigo-600 bg-white border border-slate-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-400 transition-all shadow-sm"
                        />
                        <span className="text-slate-400">-</span>
                        <input 
                          type="time" 
                          value={reminderEndTime}
                          onChange={(e) => setReminderEndTime(e.target.value)}
                          className="w-24 text-center text-sm font-bold text-indigo-600 bg-white border border-slate-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-400 transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                      <span className="text-slate-600 font-medium">完成目标后停止提醒</span>
                      <button 
                        onClick={() => setStopOnGoal(!stopOnGoal)}
                        className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${stopOnGoal ? 'bg-indigo-500' : 'bg-slate-300'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${stopOnGoal ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                      <span className="text-slate-600 font-medium">震动提醒</span>
                      <button 
                        onClick={() => setVibrateEnabled(!vibrateEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${vibrateEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${vibrateEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                      <span className="text-slate-600 font-medium flex items-center gap-2">
                        <MessageSquare size={16} />
                        弹幕通知内容
                      </span>
                      <input 
                        type="text" 
                        value={notificationText}
                        onChange={(e) => setNotificationText(e.target.value)}
                        placeholder="输入提醒内容..."
                        className="w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-400 transition-all shadow-sm"
                      />
                    </div>

                    <button 
                      onClick={() => {
                        if ('Notification' in window) {
                          Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                              alert('系统通知权限已开启！');
                            } else {
                              alert('通知权限被拒绝，请在浏览器设置中手动开启。');
                            }
                          });
                        } else {
                          alert('您的浏览器不支持系统通知。');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 p-3 text-emerald-600 bg-emerald-50 rounded-2xl active:bg-emerald-100 transition-colors font-bold mb-2"
                    >
                      <Bell size={20} />
                      开启后台/系统通知权限
                    </button>

                    <button 
                      onClick={triggerNotification}
                      className="w-full flex items-center justify-center gap-2 p-3 text-indigo-600 bg-indigo-50 rounded-2xl active:bg-indigo-100 transition-colors font-bold"
                    >
                      <Volume2 size={20} />
                      测试提醒效果
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-[var(--theme-primary-light)] rounded-full flex items-center justify-center text-[var(--theme-primary)]">
                    <SettingsIcon size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">个性化设置</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                    <span className="text-slate-600 font-medium">主题颜色</span>
                    <div className="flex gap-2">
                      {['#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#f59e0b'].map(color => (
                        <button
                          key={color}
                          onClick={() => setThemeColor(color)}
                          className={`w-8 h-8 rounded-full shadow-sm transition-transform ${themeColor === color ? 'scale-110 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                    <span className="text-slate-600 font-medium flex items-center justify-between">
                      自定义铃声
                      {customRingtone && (
                        <button 
                          onClick={() => setCustomRingtone(null)}
                          className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded-lg"
                        >
                          恢复默认
                        </button>
                      )}
                    </span>
                    <label className="flex items-center justify-center w-full p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <span className="text-sm text-slate-500 font-medium">
                        {customRingtone ? '已设置自定义铃声 (点击更换)' : '点击上传音频文件 (MP3/WAV)'}
                      </span>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              alert('文件过大，请选择 2MB 以下的音频文件');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setCustomRingtone(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="text-center mt-12 opacity-60">
                <Droplet size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-500">喝水提醒小助手</p>
                <p className="text-xs text-slate-400 mt-1">v1.0.0 · Material Design 3</p>
                <p className="text-xs text-[var(--theme-primary)] font-bold mt-2">最爱💗小萍萍</p>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Danmaku Container */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[100]">
          {danmakus.map(d => (
            <div 
              key={d.id}
              className="absolute whitespace-nowrap text-white font-bold px-5 py-2.5 rounded-full shadow-lg animate-danmaku flex items-center gap-3 pointer-events-auto"
              style={{ top: `${d.top}px`, backgroundColor: themeColor }}
            >
              <Bell size={16} className="animate-bounce" />
              <span>{d.text}</span>
              {!d.text.startsWith('🎉') && (
                <button 
                  onClick={() => handleDanmakuCheckIn(d.id)}
                  className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-bold transition-colors"
                >
                  打卡
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 pb-safe z-50">
          <div className="h-20 flex items-center justify-around px-2">
            <NavItem icon={<Droplet />} label="主页" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
            <NavItem icon={<HistoryIcon />} label="历史" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
            <NavItem icon={<Trophy />} label="成就" active={activeTab === 'achievements'} onClick={() => setActiveTab('achievements')} />
            <NavItem icon={<User />} label="我的" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          </div>
        </div>

        {/* Goal Setting Modal */}
        <AnimatePresence>
          {showGoalModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
              onClick={() => setShowGoalModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl ${isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800'}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Droplet className="text-[var(--theme-primary)]" />
                    设置饮水目标
                  </h3>
                  <button onClick={() => setShowGoalModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 opacity-80">每日目标 (ml)</label>
                    <input 
                      type="number" 
                      value={goal}
                      onChange={(e) => setGoal(Number(e.target.value) || 2000)}
                      className={`w-full text-center text-3xl font-bold text-[var(--theme-primary)] border-2 rounded-2xl p-4 outline-none focus:border-[var(--theme-primary)] transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                    />
                  </div>
                  
                  <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium opacity-80">根据体重推荐</span>
                      <span className="text-sm font-bold">
                        {profile.weight > 0 ? Math.round((profile.weight * 35) / 100) * 100 : '--'} ml
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        if (profile.weight > 0) {
                          setGoal(Math.round((profile.weight * 35) / 100) * 100);
                        } else {
                          alert('请先在"我的"页面设置体重');
                        }
                      }}
                      className="w-full py-2 bg-[var(--theme-primary-bg)] text-[var(--theme-primary)] rounded-xl font-bold text-sm hover:opacity-80 transition-opacity"
                    >
                      使用推荐值
                    </button>
                  </div>

                  <button 
                    onClick={() => setShowGoalModal(false)}
                    className="w-full py-4 bg-[var(--theme-primary)] text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[var(--theme-primary-light)]"
                  >
                    保存设置
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Avatar Cropper Modal */}
        <AnimatePresence>
          {cropImageSrc && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black flex flex-col"
            >
              <div className="relative flex-1">
                <Cropper
                  image={cropImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="bg-black p-6 pb-safe flex justify-between items-center text-white">
                <button 
                  onClick={() => setCropImageSrc(null)}
                  className="px-6 py-2 rounded-full font-bold hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={onCropComplete}
                  className="px-6 py-2 bg-[var(--theme-primary)] rounded-full font-bold hover:opacity-90 transition-opacity"
                >
                  确定
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Poster Element */}
        <div className="fixed left-[-9999px] top-[-9999px]">
          <div 
            id="share-poster" 
            className="w-[375px] h-[667px] relative overflow-hidden flex flex-col justify-between p-8"
            style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}
          >
            {/* Background Patterns */}
            <div className="absolute -top-20 -right-20 opacity-10">
              <Droplet size={300} className="fill-white" />
            </div>
            <div className="absolute -bottom-20 -left-20 opacity-10 transform rotate-45">
              <Droplet size={250} className="fill-white" />
            </div>
            
            {/* Header: Lunar Date & Yi */}
            <div className="z-10 text-white">
              <div className="text-3xl font-black tracking-wider mb-2">
                {new Date().getDate()}
                <span className="text-lg font-medium ml-1">/ {new Date().getMonth() + 1}月</span>
              </div>
              <div className="text-sm opacity-90 font-medium">
                农历 {Lunar.fromDate(new Date()).getMonthInChinese()}月{Lunar.fromDate(new Date()).getDayInChinese()}
              </div>
              <div className="mt-2 inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold">
                宜：{Lunar.fromDate(new Date()).getDayYi().slice(0, 3).join(' ')}
              </div>
            </div>

            {/* Center: Water Status */}
            <div className="z-10 flex flex-col items-center justify-center flex-1 my-8">
              <div className="w-48 h-48 rounded-full border-8 border-white/20 flex flex-col items-center justify-center backdrop-blur-sm bg-white/10 shadow-2xl relative">
                <Droplet size={40} className="text-white opacity-80 absolute top-6" />
                <div className="text-5xl font-black text-white mt-4">{todayProgress}</div>
                <div className="text-sm text-white/80 font-medium mt-1">/ {goal} ml</div>
              </div>
              <p className="mt-8 text-lg font-bold text-white tracking-widest text-center px-4 leading-relaxed">
                "水是生命之源，<br/>今天也要元气满满！"
              </p>
            </div>

            {/* Footer */}
            <div className="z-10 flex justify-between items-end text-white border-t border-white/20 pt-6">
              <div>
                <div className="text-sm font-bold opacity-90">{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-xs opacity-70 mt-1">喝水提醒小助手 · 记录健康生活</div>
              </div>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-12">
                <Droplet size={24} style={{ color: themeColor }} className="fill-current" />
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactElement, label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center w-20 h-full gap-1.5 relative group">
    <div className={`flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300 ${active ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] scale-110' : 'text-slate-500 group-hover:bg-slate-100'}`}>
      {React.cloneElement(icon, { size: 20, className: active ? 'fill-[var(--theme-primary-text)]' : '' })}
    </div>
    <span className={`text-[11px] font-bold transition-colors ${active ? 'text-[var(--theme-primary-text)]' : 'text-slate-500'}`}>{label}</span>
  </button>
);

import { Settings } from './State.js';

/** All player-facing text. Arabic is rendered by the browser (correct shaping + RTL). */
export const STRINGS = {
  // menu
  'title': { en: 'THE LAST SNOW', ar: 'الثلج الأخير' },
  'subtitle': { en: 'الثلج الأخير', ar: 'THE LAST SNOW' },
  'menu.new': { en: 'New Game', ar: 'لعبة جديدة' },
  'menu.continue': { en: 'Continue', ar: 'متابعة' },
  'menu.lang': { en: 'العربية', ar: 'English' },
  'menu.quality': { en: 'Graphics', ar: 'الرسوميات' },
  'q.auto': { en: 'Auto', ar: 'تلقائي' },
  'q.low': { en: 'Low', ar: 'منخفضة' },
  'q.medium': { en: 'Medium', ar: 'متوسطة' },
  'q.high': { en: 'High', ar: 'عالية' },
  'menu.demo': { en: 'Prototype build · Chapter 1: The Last Train', ar: 'نسخة تجريبية · الفصل الأول: القطار الأخير' },
  'menu.tap': { en: 'Tap to begin', ar: 'المس للبدء' },
  'pause.title': { en: 'Paused', ar: 'إيقاف مؤقت' },
  'pause.resume': { en: 'Resume', ar: 'استئناف' },
  'pause.menu': { en: 'Main Menu', ar: 'القائمة الرئيسية' },
  'pause.fps': { en: 'Frame rate', ar: 'معدل الإطارات' },
  'rotate': { en: 'Rotate your phone to landscape', ar: 'أدِر الهاتف إلى الوضع الأفقي' },
  'loading': { en: 'Loading…', ar: 'جارٍ التحميل…' },
  'saved': { en: 'Saved', ar: 'تم الحفظ' },

  // buttons / prompts
  'btn.jump': { en: 'Jump', ar: 'قفز' },
  'btn.act': { en: 'Use', ar: 'تفاعل' },
  'btn.crouch': { en: 'Crouch', ar: 'انحناء' },
  'btn.light': { en: 'Light', ar: 'مصباح' },
  'p.open': { en: 'Open', ar: 'افتح' },
  'p.look': { en: 'Look', ar: 'انظر' },
  'p.grab': { en: 'Grab', ar: 'امسك' },
  'p.release': { en: 'Let go', ar: 'اترك' },
  'p.take': { en: 'Take', ar: 'خذ' },
  'p.drop': { en: 'Drop', ar: 'أفلِت' },
  'p.insert': { en: 'Insert', ar: 'ضع' },
  'p.start': { en: 'Start', ar: 'شغّل' },
  'p.pull': { en: 'Pull', ar: 'اسحب' },
  'p.lift': { en: 'Lift', ar: 'ارفع' },
  'p.read': { en: 'Read', ar: 'اقرأ' },
  'p.try': { en: 'Try', ar: 'جرّب' },

  // intro
  'intro.date': { en: 'December 24, 2005 — 11:47 PM', ar: '24 ديسمبر 2005 — الساعة 11:47 مساءً' },
  'intro.where': { en: '…Where am I?', ar: '…أين أنا؟' },
  'intro.empty': { en: 'All the seats are empty.', ar: 'كل المقاعد فارغة.' },
  'intro.remember': { en: 'How did I get on this train? I can’t remember anything…', ar: 'كيف صعدتُ إلى هذا القطار؟ لا أتذكر شيئًا…' },
  'intro.pocket': { en: 'Something in my pocket…', ar: 'هناك شيء في جيبي…' },
  'photo.back': { en: '“You promised you’d come back before the snow melts.”', ar: '«وعدتني أنك سترجع قبل أن يذوب الثلج.»' },
  'photo.name': { en: 'Adam & Elias', ar: 'آدم وإلياس' },
  'photo.tap': { en: 'Tap to turn over', ar: 'المس لقلب الصورة' },
  'photo.who': { en: 'Elias… Who is Elias?', ar: 'إلياس… من هو إلياس؟' },
  'intro.announce': { en: '“Last stop… Norville.”', ar: '«المحطة الأخيرة… نورفيل.»' },
  'speaker.pa': { en: 'Speakers', ar: 'مكبرات الصوت' },
  'speaker.adam': { en: 'Adam', ar: 'آدم' },
  'speaker.child': { en: 'A child’s voice', ar: 'صوت طفل' },

  // objectives
  'obj.leave': { en: 'Leave the train', ar: 'اخرج من القطار' },
  'obj.exit': { en: 'Find a way out of the station', ar: 'ابحث عن طريق للخروج من المحطة' },
  'obj.battery': { en: 'Find a battery for the generator', ar: 'ابحث عن بطارية للمولد' },
  'obj.generator': { en: 'Bring the battery to the generator', ar: 'أحضر البطارية إلى المولد' },
  'obj.panel': { en: 'Reach the control panel', ar: 'اصعد إلى لوحة التحكم' },
  'obj.voice': { en: 'Follow the voice', ar: 'اتبع الصوت' },

  // station
  'st.clock': { en: '11:59. The clock has stopped.', ar: '11:59. الساعة متوقفة.' },
  'st.gate': { en: 'Locked. An electric lock… no power.', ar: 'مقفل. قفل كهربائي… ولا توجد كهرباء.' },
  'st.door': { en: 'The station doors are boarded shut.', ar: 'أبواب المحطة مغلقة بألواح خشبية.' },
  'st.gen_nobat': { en: 'A generator. The battery slot is empty.', ar: 'مولد كهربائي. مكان البطارية فارغ.' },
  'st.gen_ready': { en: 'The battery fits. Now start it.', ar: 'البطارية مناسبة. الآن شغّله.' },
  'st.gen_on': { en: 'It’s running.', ar: 'إنه يعمل.' },
  'st.panel_high': { en: 'The control panel is too high to reach.', ar: 'لوحة التحكم عالية جدًا.' },
  'st.panel_nopower': { en: 'Dead. No power.', ar: 'لا تعمل. لا توجد كهرباء.' },
  'st.panel_on': { en: 'The lights…', ar: 'الأضواء…' },
  'st.tarp': { en: 'There’s something under the tarp.', ar: 'هناك شيء تحت الغطاء.' },
  'st.battery': { en: 'A battery. Heavy, but it might still hold a charge.', ar: 'بطارية. ثقيلة، لكن ربما ما زال فيها شحن.' },
  'st.notice': { en: 'Timetable: “Last train — 24.12.1998 — 23:47.” Seven years ago…', ar: 'جدول المواعيد: «آخر قطار — 24.12.1998 — 23:47». قبل سبع سنوات…' },
  'st.memory': { en: '“Adam! Wait for me!”', ar: '«آدم! انتظرني!»' },
  'st.memory2': { en: 'That voice… I know that voice.', ar: 'هذا الصوت… أعرف هذا الصوت.' },
  'st.cold': { en: 'So cold… I need to keep moving.', ar: 'البرد شديد… يجب أن أستمر بالحركة.' },
  'st.chalk': { en: 'Chalk marks… someone left a trail.', ar: 'علامات طباشير… أحدهم ترك أثرًا.' },
  'st.call': { en: 'Adam…', ar: 'آدم…' },
  'st.who': { en: 'Who’s there?!', ar: 'من هناك؟!' },
  'st.gate_open': { en: 'The gate is open.', ar: 'البوابة مفتوحة.' },
  'end.title': { en: 'End of the first playable scene', ar: 'نهاية المشهد الأول القابل للعب' },
  'end.next': { en: 'Next: the mountain road and the lit house', ar: 'القادم: الطريق الجبلي والمنزل المضيء' },
  'end.menu': { en: 'Back to menu', ar: 'العودة للقائمة' },
};

let lang = Settings.get().lang;
const listeners = [];

export function t(key) {
  const e = STRINGS[key];
  if (!e) return key;
  return e[lang] || e.en;
}

export function getLang() { return lang; }

export function setLang(l) {
  lang = l;
  Settings.set('lang', l);
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  for (const fn of listeners) fn(l);
}

export function onLang(fn) { listeners.push(fn); }

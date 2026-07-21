export type Lang = 'cn' | 'en';

const translations = {
  'nav.philosophy': { cn: '教育理念', en: 'Philosophy' },
  'nav.how': { cn: '如何运作', en: 'How It Works' },
  'nav.forWhom': { cn: '谁适合', en: 'For Whom' },
  'nav.joinWaitlist': { cn: '加入等候名单', en: 'Join Waitlist' },

  'hero.badge': { cn: '公益驱动 / 开源 / 全球可达', en: 'Public-Benefit / Open Source / Global Access' },
  'hero.h1.line1': { cn: '用更少的时间', en: 'Less Time,' },
  'hero.h1.line2': { cn: '获得更深的理解', en: 'Deeper Understanding' },
  'hero.desc': {
    cn: 'AIU 是一所公益在线学校。我们不做题海战术——',
    en: 'AIU is a public-benefit online school. We don\'t rely on endless drilling—',
  },
  'hero.descBold': { cn: 'AI Active 认知引擎', en: 'AI Active Cognitive Engine' },
  'hero.descEnd': {
    cn: '实时感知每个学生的思维状态，精准干预最卡住的那一个点，让学习时间缩短一半、理解深度翻倍。',
    en: 'perceives each student\'s cognitive state in real time, precisely intervening at the exact sticking point—cutting study time in half while doubling depth of understanding.',
  },
  'hero.ctaPrimary': { cn: '免费加入 AIU', en: 'Join AIU for Free' },
  'hero.ctaSecondary': { cn: '了解运作方式', en: 'See How It Works' },
  'hero.stat1.value': { cn: '50%', en: '50%' },
  'hero.stat1.label': { cn: '学习时间节省', en: 'Study Time Saved' },
  'hero.stat2.value': { cn: '2x', en: '2x' },
  'hero.stat2.label': { cn: '理解深度提升', en: 'Comprehension Boost' },
  'hero.stat3.value': { cn: '0', en: '0' },
  'hero.stat3.label': { cn: '费用 / 永久免费', en: 'Cost / Free Forever' },

  'phil.tag': { cn: '教育理念', en: 'Education Philosophy' },
  'phil.title': { cn: '我们相信的四件事', en: 'Four Things We Believe' },
  'phil.desc': {
    cn: 'AIU 不是"AI + 题库"。它是一套完整的认知科学方法论，用技术把"因材施教"从理想变成每一次交互的现实。',
    en: 'AIU isn\'t "AI + question bank." It\'s a complete cognitive science methodology that uses technology to turn personalized education from an ideal into reality with every interaction.',
  },
  'phil.p1.title': { cn: '认知优先，不是内容优先', en: 'Cognition First, Not Content First' },
  'phil.p1.desc': {
    cn: '传统教育先选内容再看学生。AIU 先感知学生的认知状态——时间压力、信噪比、情绪——再决定教什么、用什么方式教。',
    en: 'Traditional education picks content first, then looks at the student. AIU first perceives the student\'s cognitive state—time pressure, signal-to-noise ratio, emotional state—then decides what to teach and how.',
  },
  'phil.p2.title': { cn: '御风而行：时间是最稀缺的资源', en: 'Riding the Wind: Time Is the Scarcest Resource' },
  'phil.p2.desc': {
    cn: '我们不追求"做更多题"，而是追求"用最少的时间修复最关键的漏洞"。AI Active 引擎会自动脱水作业、跳过已掌握的部分。',
    en: 'We don\'t pursue "do more problems." We pursue "fix the most critical gaps in the least time." The AI Active engine automatically trims busywork and skips mastered content.',
  },
  'phil.p3.title': { cn: '精准干预，一次只解决一个痛点', en: 'Precise Intervention: One Pain Point at a Time' },
  'phil.p3.desc': {
    cn: '每次学习交互都只聚焦一个知识漏洞。不做大锅饭式的"综合复习"——就像医生每次看诊只解决主诉。',
    en: 'Every learning interaction focuses on one knowledge gap. No blanket "comprehensive reviews"—just like a doctor addresses the chief complaint each visit.',
  },
  'phil.p4.title': { cn: '公益架构：知识不应有门槛', en: 'Public-Benefit Architecture: Knowledge Should Have No Barriers' },
  'phil.p4.desc': {
    cn: 'AIU 参照可汗学院模式公益运营。核心引擎开源，任何人可以免费使用。我们相信教育公平不是口号，而是技术架构的选择。',
    en: 'AIU operates as a public benefit following the Khan Academy model. The core engine is open-source and free for everyone. We believe education equity is not a slogan—it\'s an architectural choice.',
  },

  'how.tag': { cn: '如何运作', en: 'How It Works' },
  'how.title': { cn: '五步闭环，从错题到掌握', en: 'Five-Step Loop: From Mistakes to Mastery' },
  'how.desc': {
    cn: '不是"AI 出题 → 学生做题"的线性流水线，而是一个感知→干预→验证的认知闭环。',
    en: 'Not a linear "AI assigns → student answers" pipeline, but a perception → intervention → verification cognitive loop.',
  },
  'how.s1.title': { cn: '拍错上传', en: 'Snap & Upload' },
  'how.s1.subtitle': { cn: '一键抓取痛点', en: 'Capture the Pain Point' },
  'how.s1.desc': {
    cn: '学生拍下最卡住的一道题，AI 立即识别错因、知识漏洞和认知模式。不用翻书、不用归类——一张照片就够了。',
    en: 'Students photograph their toughest problem. AI instantly identifies the error cause, knowledge gaps, and cognitive patterns. No textbook flipping or sorting—one photo is all it takes.',
  },
  'how.s2.title': { cn: 'AI Active 认知感知', en: 'AI Active Cognitive Sensing' },
  'how.s2.subtitle': { cn: '三轴实时监测', en: 'Three-Axis Real-Time Monitoring' },
  'how.s2.desc': {
    cn: '认知引擎同步评估三个维度——时间压力、信噪比、情绪状态。这不是做完题才看分数，而是做题过程中就在感知。',
    en: 'The cognitive engine simultaneously evaluates three dimensions—time pressure, signal-to-noise ratio, and emotional state. Not grading after completion, but sensing during the process.',
  },
  'how.s3.title': { cn: '精准干预', en: 'Precise Intervention' },
  'how.s3.subtitle': { cn: '只修最关键的漏洞', en: 'Fix Only the Critical Gap' },
  'how.s3.desc': {
    cn: 'Mobius 调度器根据认知状态选择最优策略：先讲规则？先降压？先练类似题？每一步都有数据驱动的理由。',
    en: 'The Mobius scheduler selects the optimal strategy based on cognitive state: teach the rule first? Reduce pressure first? Practice similar problems? Every step is data-driven.',
  },
  'how.s4.title': { cn: '效果闭环', en: 'Outcome Verification' },
  'how.s4.subtitle': { cn: 'effectScore 量化每次干预', en: 'effectScore Quantifies Each Intervention' },
  'how.s4.desc': {
    cn: '每次交互结束后，系统量化干预效果——不只看对错，还看认知状态的变化。无效的策略会被自动淘汰。',
    en: 'After each interaction, the system quantifies intervention effectiveness—not just right or wrong, but changes in cognitive state. Ineffective strategies are automatically retired.',
  },
  'how.s5.title': { cn: '知识图谱进化', en: 'Knowledge Graph Evolution' },
  'how.s5.subtitle': { cn: '从错题长出知识网络', en: 'Growing a Knowledge Network from Mistakes' },
  'how.s5.desc': {
    cn: '所有错题自动编织成知识图谱。高频节点、关联漏洞、修复路径——一目了然。学得越多，地图越完整。',
    en: 'All mistakes are automatically woven into a knowledge graph. Frequent nodes, linked gaps, repair paths—all visible at a glance. The more you learn, the more complete the map.',
  },

  'whom.tag': { cn: '谁适合', en: 'For Whom' },
  'whom.title': { cn: 'AIU 适合谁？', en: 'Who Is AIU For?' },
  'whom.p1.who': { cn: '中小学生', en: 'K-12 Students' },
  'whom.p1.pain': {
    cn: '"每天作业做到 11 点，成绩却不见起色"',
    en: '"Homework until 11 PM every day, but grades don\'t improve"',
  },
  'whom.p1.gain': {
    cn: 'AI 自动脱水作业、跳过已会的部分，把省下的时间用在真正卡住的知识点上。',
    en: 'AI automatically trims busywork and skips mastered content, focusing saved time on the knowledge points that truly matter.',
  },
  'whom.p2.who': { cn: '家长和教师', en: 'Parents & Teachers' },
  'whom.p2.pain': {
    cn: '"不知道孩子到底卡在哪，只能靠刷题碰运气"',
    en: '"No idea where the child is stuck—just hoping more practice helps"',
  },
  'whom.p2.gain': {
    cn: '认知仪表盘实时可见：哪个知识点是真漏洞、情绪状态如何、这周节奏是否健康。',
    en: 'A real-time cognitive dashboard shows: which knowledge gaps are real, emotional state, and whether this week\'s pace is healthy.',
  },
  'whom.p3.who': { cn: '教育研究者和开发者', en: 'Researchers & Developers' },
  'whom.p3.pain': {
    cn: '"想做个性化教学，但没有开放的认知建模框架"',
    en: '"Want to personalize teaching, but no open cognitive modeling framework exists"',
  },
  'whom.p3.gain': {
    cn: '完整的 AI Active 认知引擎开源，从状态向量到策略调度到效果闭环，可以直接用于研究或二次开发。',
    en: 'The complete AI Active cognitive engine is open-source—from state vectors to strategy scheduling to outcome loops—ready for research or further development.',
  },

  'cta.title': { cn: '加入 AIU 等候名单', en: 'Join the AIU Waitlist' },
  'cta.desc': {
    cn: '我们正在邀请第一批学生和教师参与内测。留下邮箱，开放后第一时间通知你——完全免费，永远免费。',
    en: 'We\'re inviting the first cohort of students and teachers to beta. Leave your email and we\'ll notify you when it opens—completely free, forever free.',
  },
  'cta.placeholder': { cn: 'your@email.com', en: 'your@email.com' },
  'cta.button': { cn: '加入', en: 'Join' },
  'cta.success.title': { cn: '已加入等候名单', en: 'You\'re on the Waitlist' },
  'cta.success.desc': {
    cn: '开放后我们会通过邮件通知你。感谢你对教育公平的支持。',
    en: 'We\'ll notify you by email when it opens. Thank you for supporting education equity.',
  },
  'cta.privacy': {
    cn: '不发垃圾邮件 / 不共享数据 / 随时退出',
    en: 'No spam / No data sharing / Unsubscribe anytime',
  },

  'footer.brand': { cn: 'AIU — AI University', en: 'AIU — AI University' },
  'footer.madeWith': { cn: '为教育公平而生', en: 'Made for Education Equity' },
  'footer.nav.philosophy': { cn: '理念', en: 'Philosophy' },
  'footer.nav.how': { cn: '运作', en: 'How' },
  'footer.nav.join': { cn: '加入', en: 'Join' },
} as const;

export type TranslationKey = keyof typeof translations;

export default translations;

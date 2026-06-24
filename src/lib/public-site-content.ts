export type TrainingInfo = {
  schedule: string;
  location: string;
  whatToBring: string[];
  whatWeProvide: string[];
  note: string;
};

export type ContactChannel = {
  type: "wechat-group" | "email" | "social";
  label: string;
  value: string;
  href?: string;
  qrImage?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type TeamHistory = {
  foundedYear: number | null;
  story: string;
  awards: string[];
};

export type PublicSiteContent = {
  navigation: Array<{ label: string; href: string }>;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  steps: Array<{ number: string; title: string; detail: string }>;
  values: Array<{ title: string; detail: string }>;
  training: TrainingInfo;
  contacts: ContactChannel[];
  faq: FaqItem[];
  history: TeamHistory;
};

export const PUBLIC_SITE_CONTENT: PublicSiteContent = {
  navigation: [
    { label: "认识球队", href: "#about" },
    { label: "训练日常", href: "#training" },
    { label: "球队历史", href: "#history" },
    { label: "常见问题", href: "#faq" },
    { label: "加入我们", href: "#join" },
  ],
  hero: {
    eyebrow: "HITSZ BASEBALL · 2026 秋季招新",
    title: "新生开球",
    subtitle: "下一球，等你上场",
  },
  steps: [
    { number: "01", title: "来看看", detail: "到场了解棒球与球队" },
    { number: "02", title: "跟练一次", detail: "体验训练节奏和伙伴" },
    { number: "03", title: "正式入队", detail: "成为我们的一员" },
  ],
  values: [
    { title: "零基础友好", detail: "从传接球、挥棒和跑垒开始，队友会陪你建立完整基础。" },
    { title: "认真训练", detail: "在课业之外保持稳定训练，用每一次重复换来场上的判断。" },
    { title: "一起上场", detail: "这里有不同年级、专业和经历的人，但我们共享同一个主场。" },
  ],
  training: {
    schedule: "每周二、周五 18:30–21:00（以群内通知为准）",
    location: "大学城体育中心棒球场",
    whatToBring: ["运动服", "运动鞋", "饮用水"],
    whatWeProvide: ["球棒", "手套", "棒球"],
    note: "雨天会提前在微信群通知是否改室内训练。第一次来不用买装备，先体验再决定。",
  },
  contacts: [
    {
      type: "wechat-group",
      label: "棒球队微信群",
      value: "扫码入群",
      qrImage: "/team/wechat-group-qr.jpg",
    },
    {
      type: "email",
      label: "球队邮箱",
      value: "hitsz.baseball@example.com",
      href: "mailto:hitsz.baseball@example.com",
    },
    {
      type: "social",
      label: "官方公众号",
      value: "HITSZ Baseball",
      href: "https://mp.weixin.qq.com",
    },
  ],
  faq: [
    {
      question: "零基础真的可以加入吗？",
      answer: "完全可以。我们从传接球、握棒、挥棒和跑垒开始教，每次训练都有老队员带新同学。",
    },
    {
      question: "需要买装备吗？",
      answer: "第一次来不用买。球队提供球棒、手套和训练用球。确定长期加入后，再根据自己的守位慢慢添置。",
    },
    {
      question: "训练频率和强度如何？",
      answer: "常规训练每周两次，每次约两个半小时。强度会兼顾新手和老队员，训练前会分组进行。",
    },
    {
      question: "如何平衡课业和训练？",
      answer: "训练安排在晚上和周末，期末周会酌情减量。学业优先，训练自愿，但建议尽量保持节奏。",
    },
    {
      question: "女生可以加入吗？",
      answer: "当然可以。球队欢迎所有对棒球感兴趣的同学，训练和比赛都会根据情况分组。",
    },
    {
      question: "加入后一定要参加比赛吗？",
      answer: "不强制。你可以先以跟练为主，等想上场了再报名比赛。比赛机会由教练和经理统一安排。",
    },
    {
      question: "怎么联系你们？",
      answer: "可以扫码进入微信群围观，也可以发邮件到球队邮箱。招新季群里会同步最新训练安排。",
    },
  ],
  history: {
    foundedYear: 2015,
    story: "哈工大（深圳）棒球队从一群热爱棒球的在校生起步，在深圳的校园和城际赛事中逐渐成长。这里没有专业背景门槛，只有认真对待每一次传接球的伙伴。",
    awards: [
      "深圳市大学生棒球联赛 季军",
      "大学城体育文化节 优秀团队",
      "多次校际友谊赛 最佳精神风貌奖",
    ],
  },
};

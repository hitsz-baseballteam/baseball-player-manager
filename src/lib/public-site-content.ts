export type PublicSiteContent = {
  navigation: Array<{ label: string; href: string }>;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  steps: Array<{ number: string; title: string; detail: string }>;
  values: Array<{ title: string; detail: string }>;
  training: Array<{ label: string; value: string }>;
  contact: {
    manager: string;
    wechat: string;
  };
};

export const PUBLIC_SITE_CONTENT: PublicSiteContent = {
  navigation: [
    { label: "认识球队", href: "#about" },
    { label: "训练日常", href: "#training" },
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
  training: [
    { label: "招新对象", value: "HITSZ 全体在校学生" },
    { label: "经验要求", value: "零基础也欢迎" },
    { label: "参与方式", value: "联系经理预约跟练" },
  ],
  contact: {
    manager: "球队经理——陶YF",
    wechat: "t90507002fyt",
  },
};

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
    englishTitle: string;
    slogan: string;
    summary: string;
  };
  intro: {
    title: string;
    body: string[];
    tags: string[];
  };
  stats: Array<{
    label: string;
    value: string;
    detail: string;
    tone: "clay" | "green" | "gold";
  }>;
  timeline: Array<{
    date: string;
    title: string;
    summary: string;
    isFuture?: boolean;
  }>;
  firstMatch: {
    eyebrow: string;
    title: string;
    body: string[];
    games: Array<{
      label: string;
      opponent: string;
      result: string;
      note: string;
    }>;
  };
  trainingSteps: Array<{
    number: string;
    name: string;
    detail: string;
  }>;
  culture: Array<{
    title: string;
    detail: string;
  }>;
  members: Array<{
    number: string;
    name: string;
    role: string;
    note: string;
    tone: "captain" | "vice" | "manager" | "active" | "open";
  }>;
  gallery: Array<{
    id: string;
    category: "match" | "training" | "group" | "detail";
    categoryLabel: string;
    title: string;
    date: string;
    src: string;
    alt: string;
    wide?: boolean;
    tall?: boolean;
  }>;
  training: TrainingInfo;
  contacts: ContactChannel[];
  faq: FaqItem[];
  history: TeamHistory;
};

export const PUBLIC_SITE_CONTENT: PublicSiteContent = {
  navigation: [
    { label: "认识球队", href: "#about" },
    { label: "队史", href: "#history" },
    { label: "首战", href: "#match" },
    { label: "训练", href: "#training" },
    { label: "成员", href: "#members" },
    { label: "相册", href: "#gallery" },
    { label: "加入我们", href: "#join" },
  ],
  hero: {
    eyebrow: "OFFICIAL HOME · 2026 SEASON",
    title: "哈工深小熊猫棒球队",
    englishTitle: "HITSZ Red Pandas Baseball Team",
    slogan: "从零起步，向省赛进发。",
    summary:
      "成立于 2026 年春天的高校校园棒球队。我们在训练中积累，在比赛中成长，也在每一次传球、挥棒和围圈中记录属于哈工深的棒球故事。",
  },
  intro: {
    title: "一支从 2026 年春天出发的校园棒球队。",
    body: [
      "哈工深小熊猫棒球队成立于 2026 年 4 月，是一支由哈尔滨工业大学（深圳）学生组成的校园棒球队。球队希望通过棒球训练、校际交流和赛事参与，为同学们提供一个充实生活、锻炼身体、建立团队连接的运动空间。",
      "作为一支新队伍，我们珍惜每一次训练，也认真记录每一次比赛。球队目前拥有 20+ 名成员，并以团结奋进的姿态，向省级赛事舞台迈进。",
    ],
    tags: ["校园球队", "团结奋进", "向省赛进发", "新手友好"],
  },
  stats: [
    {
      label: "成立",
      value: "2026.04",
      detail: "球队正式组建，第一批成员与背号系统落笔。",
      tone: "clay",
    },
    {
      label: "现役成员",
      value: "20+",
      detail: "以大一为主，覆盖研一至博五，也有毕业学长回到训练场。",
      tone: "green",
    },
    {
      label: "首次正式出征",
      value: "2026.05.30",
      detail: "首届得物王牌棒球赛，广州，对阵深大与南科大。",
      tone: "gold",
    },
    {
      label: "固定训练",
      value: "3 次/周",
      detail: "周五傍晚 + 周末上午，在哈工深足球场积累基础。",
      tone: "green",
    },
  ],
  timeline: [
    {
      date: "2026.04",
      title: "球队成立",
      summary: "哈工深小熊猫棒球队正式组建，第一批成员确定，队服与背号系统建立。",
    },
    {
      date: "2026.05",
      title: "系统训练",
      summary: "队员开始固定训练，积累传接球、击球、跑垒与守备基础。",
    },
    {
      date: "2026.05.30",
      title: "首次正式出征",
      summary: "首届得物王牌棒球赛，广州。对阵深圳大学与南方科技大学。",
    },
    {
      date: "未来",
      title: "冲击省赛",
      summary: "在校际交流与日常训练中积累经验，争取闯进省级赛事并取得名次。",
      isFuture: true,
    },
  ],
  firstMatch: {
    eyebrow: "FIRST MATCH · 2026.05.30",
    title: "得物王牌棒球赛，第一次站上竞技赛场。",
    body: [
      "2026 年 5 月 30 日，广东十支高校棒球队集结广州，首届得物王牌棒球赛正式拉开帷幕。哈工深小熊猫棒球队参加首日两场小组赛，分别对阵深圳大学和南方科技大学。",
      "这是球队成立后的首次正式出征。队员们带着平日训练的积淀站上竞技赛场，完成了社团第一次对外亮相。虽然最终惜败，但这支成立不久的新队伍展现了团结、专注和不轻言放弃的精神。",
    ],
    games: [
      {
        label: "GAME 01",
        opponent: "深圳大学",
        result: "惜败",
        note: "首次亮相",
      },
      {
        label: "GAME 02",
        opponent: "南方科技大学",
        result: "惜败",
        note: "团结风采",
      },
    ],
  },
  trainingSteps: [
    { number: "01", name: "拉伸", detail: "动态热身 + 肩袖激活" },
    { number: "02", name: "传球热身", detail: "两人一组传接球" },
    { number: "03", name: "守备", detail: "地滚 / 高飞 / 垒间" },
    { number: "04", name: "打击", detail: "T 座 / 抛打 / 投打" },
    { number: "05", name: "队内赛", detail: "红白分组实战" },
    { number: "06", name: "复盘", detail: "训练问题与改进" },
  ],
  culture: [
    { title: "训练后聚餐", detail: "把训练场上的默契延伸到日常生活，增强队伍凝聚力。" },
    { title: "毕业合影", detail: "记录每一届队员与球队共同成长的阶段性节点。" },
    { title: "背号传承", detail: "现役队员拥有专属背号，毕业队员背号可被保留并写入球队记录。" },
    { title: "高校交流", detail: "持续与深圳大学、南方科技大学等高校球队以及社会球队交流比赛。" },
    { title: "训后复盘", detail: "通过讨论总结配合、守备、打击和跑垒问题，让训练沉淀为进步。" },
  ],
  members: [
    { number: "1", name: "贾云博", role: "首任队长", note: "球队发起人之一，负责训练与比赛组织。", tone: "captain" },
    { number: "7", name: "丁舒杰", role: "副队长", note: "协助训练安排与赛事协调。", tone: "vice" },
    { number: "10", name: "陶怡帆", role: "经理", note: "负责后勤、招新与对外联络。", tone: "manager" },
    { number: "3", name: "现役队员", role: "20+ 成员", note: "号码墙持续记录球队成长。", tone: "active" },
    { number: "11", name: "现役队员", role: "新生力量", note: "从基础动作开始，逐步进入实战。", tone: "active" },
    { number: "+", name: "更多队员", role: "正在加入", note: "下一件队服，等待新的背号。", tone: "open" },
  ],
  gallery: [
    {
      id: "huddle",
      category: "match",
      categoryLabel: "首次出征",
      title: "赛前围圈",
      date: "2026.05.30",
      src: "/team/team-huddle.jpg",
      alt: "哈工深小熊猫棒球队赛前围圈",
      tall: true,
    },
    {
      id: "tournament",
      category: "match",
      categoryLabel: "比赛",
      title: "赛事合影",
      date: "2026.05.30",
      src: "/team/team-tournament.jpg",
      alt: "哈工深小熊猫棒球队赛事合影",
    },
    {
      id: "lineup",
      category: "group",
      categoryLabel: "合影",
      title: "场边列队",
      date: "2026.05",
      src: "/team/team-lineup-field.jpg",
      alt: "球队在棒球场边列队",
    },
    {
      id: "dugout",
      category: "detail",
      categoryLabel: "队服细节",
      title: "准备上场",
      date: "2026",
      src: "/team/team-dugout.jpg",
      alt: "队员准备进入球场",
    },
    {
      id: "campus",
      category: "group",
      categoryLabel: "全队合影",
      title: "校园合影",
      date: "2026.04",
      src: "/team/team-campus.jpg",
      alt: "球队校园合影",
      wide: true,
    },
    {
      id: "fence",
      category: "training",
      categoryLabel: "训练",
      title: "球场边线",
      date: "2026",
      src: "/team/team-fence.jpg",
      alt: "球队训练场边的球场围栏",
    },
  ],
  training: {
    schedule: "每周五 16:00–18:00；周六、周日 8:30–12:00",
    location: "哈工深足球场",
    whatToBring: ["运动服", "运动鞋", "饮用水"],
    whatWeProvide: ["球棒", "手套", "棒球"],
    note: "第一次来不用买装备。球队由老队员带训，对新手友好，提供一对一指导，让零基础队员也能循序渐进地融入训练。",
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
      value: "HITSZ Red Pandas",
      href: "https://mp.weixin.qq.com",
    },
  ],
  faq: [
    {
      question: "零基础真的可以加入吗？",
      answer: "完全可以。训练从传接球、握棒、挥棒、跑垒和规则理解开始，老队员会带新同学逐步进入节奏。",
    },
    {
      question: "第一次训练需要准备什么？",
      answer: "穿方便运动的衣服和运动鞋，带足饮用水即可。球棒、手套和训练用球由球队提供。",
    },
    {
      question: "训练频率和强度如何？",
      answer: "常规训练每周三次，包含热身、传接球、守备、打击、队内赛和复盘。强度会兼顾新手和老队员。",
    },
    {
      question: "女生可以加入吗？",
      answer: "可以。球队欢迎所有对棒球感兴趣的同学，也欢迎摄影、运营、后勤和经理方向的伙伴。",
    },
    {
      question: "加入后一定要参加比赛吗？",
      answer: "不强制。你可以先以体验训练和跟练为主，熟悉球队后再报名参加比赛或后勤工作。",
    },
    {
      question: "如何联系球队？",
      answer: "可以扫码进入微信群了解训练安排，也可以通过球队邮箱联系。首页不会展示个人手机号或个人微信号。",
    },
  ],
  history: {
    foundedYear: 2026,
    story:
      "哈工深小熊猫棒球队成立于 2026 年 4 月，从第一批成员、第一件队服、第一次围圈开始记录队史。球队仍然年轻，但每一次训练、比赛和合影都正在成为这段历史的第一页。",
    awards: [
      "2026.04 哈工深小熊猫棒球队正式组建",
      "2026.05 建立固定训练节奏与背号系统",
      "2026.05.30 首次参加得物王牌棒球赛",
    ],
  },
};

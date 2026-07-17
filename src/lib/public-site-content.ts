import type { PublicHomeMember } from "@/lib/workspace/types";

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
	members: PublicHomeMember[];
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
		slogan: "手套、球棒，还有红土场上的风。来和我们一起打棒球吧！",
		summary:
			"哈工深小熊猫棒球队，一群热爱棒球的业余选手聚集在这里。没有高门槛，只有挥棒和奔跑时的快乐。只要你想动起来，这里总有你的位置。",
	},
	intro: {
		title: "从零开始，我们在这里建起了一支棒球队。",
		body: [
			"2026年春天，几个喜欢棒球的同学一拍即合，在工深拉起了一支队伍。我们从零开始，练习传球、接球、挥棒，如今已经是一个拥有30多位队员的小家庭了。",
			"虽然大家都是业余爱好者，但每次训练和比赛我们都非常认真。不管是接球失误的尴尬，还是打出安打的狂喜，都是我们青春最真实的写照。如果可以，我们还想去省赛的赛场上瞧一瞧。",
		],
		tags: ["零基础友好", "训后聚餐", "红土青春", "业余选手大本营"],
	},
	stats: [
		{
			label: "成立",
			value: "2026.04",
			detail: "定下了小熊猫的名字，也分好了大家的背号。",
			tone: "clay",
		},
		{
			label: "现役成员",
			value: "30",
			detail: "每个人都有自己专属的背号卡片。",
			tone: "green",
		},
		{
			label: "首次正式出征",
			value: "2026.05.30",
			detail: "大巴车上的歌声 and 满身的汗水。",
			tone: "gold",
		},
		{
			label: "固定训练",
			value: "3 次/周",
			detail: "周五傍晚和周末，操场见！练完一起去吃饭。",
			tone: "green",
		},
	],
	timeline: [
		{
			date: "2026.04",
			title: "球队成立",
			summary:
				"哈工深小熊猫棒球队正式组建，第一批成员确定，队服与背号系统建立。",
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
			title: "想去更远的地方",
			summary: "想和深大、南科大他们多打几场交流赛。如果可以，还想去省赛的红土场上挥一次棒。",
			isFuture: true,
		},
	],
	firstMatch: {
		eyebrow: "FIRST MATCH · 2026.05.30",
		title: "第一场比赛：没赢，但我们打得很痛快！",
		body: [
			"2026年5月30日，我们坐上了去广州的大巴。那是我们第一次以‘哈工深小熊猫’的名字站上正式比赛的赛场，对手是深圳大学和南方科技大学。",
			"说实话，上场前大家手心都在冒汗。虽然两场都惜败了，但当我们在本垒前紧紧围成一圈喊出‘熊猫加油’的时候，我们知道，我们真正成为了一支队伍。",
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
		{
			title: "训练后聚餐",
			detail: "把训练场上的默契延伸到日常生活，增强队伍凝聚力。",
		},
		{ title: "毕业合影", detail: "记录每一届队员与球队共同成长的阶段性节点。" },
		{
			title: "背号传承",
			detail: "现役队员拥有专属背号，毕业队员背号可被保留并写入球队记录。",
		},
		{
			title: "高校交流",
			detail: "持续与深圳大学、南方科技大学等高校球队以及社会球队交流比赛。",
		},
		{
			title: "训后复盘",
			detail: "通过讨论总结配合、守备、打击和跑垒问题，让训练沉淀为进步。",
		},
	],
	members: [
		{
			number: "81",
			name: "范张晨",
			nickname: "FAN",
			role: "队员",
			note: "Nickname · FAN",
			tone: "active",
		},
		{
			number: "27",
			name: "林承业",
			nickname: "AYE",
			role: "队员",
			note: "Nickname · AYE",
			tone: "active",
		},
		{
			number: "32",
			name: "王薪源",
			nickname: "YUAN",
			role: "队员",
			note: "Nickname · YUAN",
			tone: "active",
		},
		{
			number: "2",
			name: "鲍亦青",
			nickname: "BOB",
			role: "队员",
			note: "Nickname · BOB",
			tone: "active",
		},
		{
			number: "6",
			name: "陈家辉",
			nickname: "Frank",
			role: "队员",
			note: "Nickname · Frank",
			tone: "active",
		},
		{
			number: "42",
			name: "程思远",
			nickname: "Arcsin",
			role: "队员",
			note: "Nickname · Arcsin",
			tone: "active",
		},
		{
			number: "88",
			name: "赵伯豪",
			nickname: "ZHAO",
			role: "队员",
			note: "Nickname · ZHAO",
			tone: "active",
		},
		{
			number: "7",
			name: "陈菲娅",
			nickname: "BanBan",
			role: "队员",
			note: "Nickname · BanBan",
			tone: "active",
		},
		{
			number: "15",
			name: "李雨杭",
			nickname: "Apostle",
			role: "队员",
			note: "Nickname · Apostle",
			tone: "active",
		},
		{
			number: "44",
			name: "姚智宇",
			nickname: "HuaLIN",
			role: "队员",
			note: "Nickname · HuaLIN",
			tone: "active",
		},
		{
			number: "91",
			name: "周轩",
			nickname: "Jiang",
			role: "队员",
			note: "Nickname · Jiang",
			tone: "active",
		},
		{
			number: "8",
			name: "刘渝川",
			nickname: "LYC",
			role: "队员",
			note: "Nickname · LYC",
			tone: "active",
		},
		{
			number: "3",
			name: "王婵",
			nickname: "Chan",
			role: "队员",
			note: "Nickname · Chan",
			tone: "active",
		},
		{
			number: "24",
			name: "王哲鹏",
			nickname: "Jim",
			role: "队员",
			note: "Nickname · Jim",
			tone: "active",
		},
		{
			number: "11",
			name: "向子鑫",
			nickname: "Zachary",
			role: "队员",
			note: "Nickname · Zachary",
			tone: "active",
		},
		{
			number: "59",
			name: "陶怡帆",
			nickname: "MIZUKI",
			role: "队员",
			note: "Nickname · MIZUKI",
			tone: "active",
		},
		{
			number: "10",
			name: "贾云博",
			nickname: "Safridi",
			role: "队员",
			note: "Nickname · Safridi",
			tone: "active",
		},
		{
			number: "31",
			name: "丁舒杰",
			nickname: "D.SHUJIE",
			role: "队员",
			note: "Nickname · D.SHUJIE",
			tone: "active",
		},
		{
			number: "13",
			name: "朱兆磊",
			nickname: "ZZL",
			role: "队员",
			note: "Nickname · ZZL",
			tone: "active",
		},
		{
			number: "26",
			name: "Jonathan Fenly",
			nickname: "Autumn",
			role: "队员",
			note: "Nickname · Autumn",
			tone: "active",
		},
		{
			number: "45",
			name: "常悦",
			nickname: "Chang Yue",
			role: "队员",
			note: "Nickname · Chang Yue",
			tone: "active",
		},
		{
			number: "77",
			name: "周承臻",
			nickname: "S",
			role: "队员",
			note: "Nickname · S",
			tone: "active",
		},
		{
			number: "75",
			name: "王翰林",
			nickname: "Tiamo",
			role: "队员",
			note: "Nickname · Tiamo",
			tone: "active",
		},
		{
			number: "66",
			name: "郑海冰",
			nickname: "ZHB",
			role: "队员",
			note: "Nickname · ZHB",
			tone: "active",
		},
		{
			number: "22",
			name: "韦语丝",
			nickname: "CLAW",
			role: "队员",
			note: "Nickname · CLAW",
			tone: "active",
		},
		{
			number: "33",
			name: "jorge",
			nickname: "holuhe",
			role: "队员",
			note: "Nickname · holuhe",
			tone: "active",
		},
		{
			number: "30",
			name: "陈靖韡",
			nickname: "Venokos",
			role: "队员",
			note: "Nickname · Venokos",
			tone: "active",
		},
		{
			number: "99",
			name: "Thabang Mathaba",
			nickname: "高兴",
			role: "队员",
			note: "Nickname · 高兴",
			tone: "active",
		},
		{
			number: "12",
			name: "徐玙航",
			nickname: "YUAN",
			role: "队员",
			note: "Nickname · YUAN",
			tone: "active",
		},
		{
			number: "9",
			name: "Loki",
			nickname: "LOKI",
			role: "队员",
			note: "Nickname · LOKI",
			tone: "active",
		},
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
			value: "hi@hitsz-baseball.online",
			href: "mailto:hi@hitsz-baseball.online",
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
			question: "我从没摸过棒球，真的能来吗？",
			answer:
				"太可以了！我们绝大多数人也是大一或研一才第一次戴上手套。我们会手把手教你传球、挥棒，从最基础的玩起，很快就能上手。",
		},
		{
			question: "第一次去需要自备装备吗？",
			answer:
				"什么都不用买！穿件方便运动的衣服和运动鞋，带瓶水直接来就行。手套和球棒球队多得是，随便用。",
		},
		{
			question: "训练频率和强度如何？",
			answer:
				"常规训练每周三次，包含热身、传接球、守备、打击、队内赛和复盘。强度会兼顾新手和老队员。",
		},
		{
			question: "女生也可以打棒球吗？",
			answer:
				"当然！我们队里有很多女队员，棒球不仅要力量，更讲求技巧和配合。除了上场打球，也超级欢迎来当经理、后勤、做摄影或者运营公众号！",
		},
		{
			question: "加入后必须打比赛吗？",
			answer:
				"完全自愿。如果你只是想强身健体或者周末找个地方运动，来跟练就行。想体验竞技赛场的话，随时欢迎报名跟我们一起出征！",
		},
		{
			question: "如何联系球队？",
			answer:
				"可以扫码进入微信群了解训练安排，也可以通过球队邮箱联系。首页不会展示个人手机号或个人微信号。",
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

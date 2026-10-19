var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/public-export-entry.ts
var public_export_entry_exports = {};
__export(public_export_entry_exports, {
  renderPublicDossier: () => renderPublicDossier
});
module.exports = __toCommonJS(public_export_entry_exports);

// src/data/atlasRemediation.json
var atlasRemediation_default = {
  version: "atlas-review-2026-10-19-v1",
  reviewedAt: "2026-10-19",
  publicSafe: true,
  entities: [
    {
      id: "ENT-9050001",
      kind: "person",
      canonicalName: "Chris Walti",
      displayName: "Chris Walti",
      aliases: [],
      externalIds: {
        url: "https://mytra.ai/company/"
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050002",
      kind: "company",
      canonicalName: "UMA",
      displayName: "UMA",
      aliases: [
        "Universal Mechanical Assistant"
      ],
      externalIds: {
        url: "https://uma.bot/",
        description: "AI and robotics company developing general-purpose mobile and humanoid robots.",
        discoveryDescription: "AI and robotics company developing general-purpose mobile and humanoid robots.",
        discoverySourceUrls: [
          "https://uma.bot/"
        ]
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050003",
      kind: "person",
      canonicalName: "Shuo Yang (Mondo Robotics)",
      displayName: "Shuo Yang (Mondo Robotics)",
      aliases: [
        "Shuo Yang"
      ],
      externalIds: {
        url: "https://www.linkedin.com/in/shuo-yang-28414660",
        description: "Mondo Tech cofounder and former Tesla Optimus team member, identified by his first-person announcement.",
        discoveryDescription: "Mondo Tech cofounder and former Tesla Optimus engineer developing compact consumer robots.",
        discoverySourceUrls: [
          "https://www.linkedin.com/feed/update/urn:li:activity:7315116402867113984/"
        ]
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050004",
      kind: "company",
      canonicalName: "Mondo Tech",
      displayName: "Mondo Tech",
      aliases: [
        "Mondo Robotics",
        "\u5999\u52A8\u79D1\u6280"
      ],
      externalIds: {
        url: "https://www.linkedin.com/in/shuo-yang-28414660",
        description: "Consumer robotics company announced by former Tesla Optimus engineer Shuo Yang.",
        discoveryDescription: "Consumer robotics company developing compact robots for everyday use, announced by former Tesla Optimus engineer Shuo Yang.",
        discoverySourceUrls: [
          "https://www.linkedin.com/feed/update/urn:li:activity:7315116402867113984/"
        ]
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050005",
      kind: "company",
      canonicalName: "Proception",
      displayName: "Proception",
      aliases: [
        "Proception Inc"
      ],
      externalIds: {
        url: "https://www.proception.ai/",
        description: "Robotic hands and motion capture gloves for dexterous manipulation.",
        discoveryDescription: "Robotic hands and motion capture gloves for dexterous manipulation.",
        discoverySourceUrls: [
          "https://www.ycombinator.com/companies/proception-inc"
        ]
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050006",
      kind: "person",
      canonicalName: "Jay Li",
      displayName: "Jay Li",
      aliases: [],
      externalIds: {
        url: "https://www.ycombinator.com/companies/proception-inc"
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050007",
      kind: "person",
      canonicalName: "Jack Xu",
      displayName: "Jack Xu",
      aliases: [],
      externalIds: {
        url: "https://www.ycombinator.com/companies/proception-inc"
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-900162",
      kind: "person",
      canonicalName: "Zhou Xian",
      displayName: "Zhou Xian",
      aliases: [],
      externalIds: {
        url: "https://www.genesis.ai/"
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-900163",
      kind: "person",
      canonicalName: "Theophile Gervet",
      displayName: "Theophile Gervet",
      aliases: [
        "Th\xE9ophile Gervet"
      ],
      externalIds: {
        url: "https://www.genesis.ai/"
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050010",
      kind: "model",
      canonicalName: "GENE-26.5",
      displayName: "GENE-26.5",
      aliases: [],
      externalIds: {
        url: "https://www.genesis.ai/",
        description: "Genesis AI robot foundation model announced May 6, 2026."
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050011",
      kind: "model",
      canonicalName: "Mind Robotics industrial foundation models",
      displayName: "Mind Robotics industrial foundation models",
      aliases: [],
      externalIds: {
        url: "https://www.mindrobotics.com/",
        description: "Company-described industrial robot models trained with production video and manipulation data."
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-900100",
      kind: "paper",
      subtype: "Robotics & control",
      canonicalName: "RT-1: Robotics Transformer for Real-World Control at Scale",
      displayName: "RT-1: Robotics Transformer for Real-World Control at Scale",
      aliases: [
        "RT-1",
        "RT1",
        "Robotics Transformer 1"
      ],
      externalIds: {
        url: "https://arxiv.org/abs/2212.06817",
        arxiv: "2212.06817",
        publicationDate: "2022-12-13",
        publicationYear: "2022",
        description: "Transformer robot control trained on diverse real-world tasks; evaluated generalization depends on data scale and diversity.",
        atlasCapabilityIds: [
          "models",
          "control"
        ],
        sourceUrls: [
          "https://arxiv.org/abs/2212.06817"
        ]
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-900104",
      kind: "paper",
      subtype: "Robotics & control",
      canonicalName: "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control",
      displayName: "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control",
      aliases: [
        "RT-2",
        "RT2",
        "Robotics Transformer 2"
      ],
      externalIds: {
        url: "https://arxiv.org/abs/2307.15818",
        arxiv: "2307.15818",
        publicationDate: "2023-07-28",
        publicationYear: "2023",
        description: "Co-fine-tunes vision-language models on robot trajectories and web tasks, representing robot actions as tokens; reports evaluation of semantic generalization.",
        atlasCapabilityIds: [
          "models",
          "control"
        ],
        sourceUrls: [
          "https://arxiv.org/abs/2307.15818"
        ]
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9040003",
      kind: "paper",
      subtype: "Robotics & control",
      canonicalName: "\u03C00: A Vision-Language-Action Flow Model for General Robot Control",
      displayName: "\u03C00: A Vision-Language-Action Flow Model for General Robot Control",
      aliases: [
        "pi0",
        "pi-zero",
        "\u03C00",
        "\u03C0_0",
        "Physical Intelligence pi0"
      ],
      externalIds: {
        url: "https://arxiv.org/abs/2410.24164",
        arxiv: "2410.24164",
        publicationDate: "2024-10-31",
        publicationYear: "2024",
        description: "Combines a pretrained vision-language model with flow matching for general robot control across multiple platforms and dexterous tasks.",
        atlasCapabilityIds: [
          "models",
          "control"
        ],
        sourceUrls: [
          "https://arxiv.org/abs/2410.24164"
        ]
      },
      visibility: "public",
      lifecycleStatus: "active"
    },
    {
      id: "ENT-9050030",
      typedId: "company:apple",
      kind: "company",
      canonicalName: "Apple",
      displayName: "Apple",
      aliases: [
        "Apple Inc."
      ],
      externalIds: {
        website: "https://www.apple.com/"
      },
      lifecycleStatus: "active",
      visibility: "public"
    }
  ],
  entityUpdates: [
    {
      id: "ENT-0288",
      canonicalName: "Tesla",
      aliases: [
        "Tesla Inc.",
        "Tesla Motors"
      ],
      externalIds: {
        canonicalDomain: "tesla.com",
        url: "https://www.tesla.com/AI"
      }
    },
    {
      id: "ENT-0289",
      canonicalName: "Tesla Optimus",
      aliases: [
        "Optimus",
        "TeslaBot",
        "Tesla Bot"
      ],
      externalIds: {
        canonicalDomain: "tesla.com",
        parentEntity: "ENT-0288"
      }
    },
    {
      id: "ENT-0285",
      canonicalName: "NVIDIA",
      aliases: [
        "Nvidia",
        "NVIDIA Corporation"
      ],
      externalIds: {
        canonicalDomain: "nvidia.com",
        url: "https://www.nvidia.com/"
      }
    },
    {
      id: "ENT-0029",
      canonicalName: "R\xE9mi Cad\xE8ne",
      aliases: [
        "R\xE9mi Cadene",
        "Remi Cadene"
      ],
      externalIds: {
        url: "https://remicadene.com/"
      }
    }
  ],
  evidence: [
    {
      id: "AR-EVD-PI-FOUNDERS",
      url: "https://www.redpoint.com/companies/physical-intelligence/",
      publisher: "Redpoint Ventures",
      tier: "official",
      locator: "Portfolio entry explicitly lists Karol Hausman, Adnan Esmail, Chelsea Finn, Lachy Groom, Brian Ichter, Sergey Levine and Quan Vuong as founders. The page records first partnership in 2024; it does not date every individual appointment.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-TESLA-AI",
      url: "https://www.tesla.com/AI",
      publisher: "Tesla",
      tier: "official",
      locator: "Tesla AI page presents Optimus, its humanoid robotics program, alongside the company's autonomy work.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-NVIDIA-RESEARCH",
      url: "https://research.nvidia.com/",
      publisher: "NVIDIA",
      tier: "official",
      locator: "NVIDIA Research identifies itself as the company's research organization.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-NVIDIA-GEAR",
      url: "https://research.nvidia.com/labs/gear/",
      publisher: "NVIDIA",
      tier: "official",
      locator: "GEAR is NVIDIA's Generalist Embodied Agent Research group; corporate lab membership is distinct from the parent company.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-STERLING-AURORA",
      url: "https://aurora.tech/author/sterling-anderson",
      publisher: "Aurora",
      tier: "official",
      locator: "Anderson's company biography identifies him as Aurora cofounder and says he led Model X development and the teams delivering Tesla Autopilot before cofounding Aurora.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-WALTI-MYTRA",
      url: "https://mytra.ai/company/",
      publisher: "Mytra",
      tier: "official",
      locator: "The company page says Mytra was founded in 2022 and describes CEO Chris Walti's 7.5 years at Tesla, including leading material flow, mobile robotics and the TeslaBot program.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-WALTI-COFOUNDER",
      url: "https://mytra.ai/news/mytra-announces-expansion-and-new-headquarters-with-brisbane-california-campus",
      publisher: "Mytra",
      tier: "official",
      locator: "June 26, 2025 company announcement explicitly calls Chris Walti CEO and cofounder of Mytra.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-ESMAIL-TESLA",
      url: "https://blog.anduril.com/the-heartful-engineer-adnan-esmail-d94044fb5778",
      publisher: "Anduril Industries",
      tier: "official",
      locator: "November 17, 2020 employer profile says Esmail had worked four years at Tesla developing sustainability and self-driving technologies before joining Anduril.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-CADENE-UMA",
      url: "https://uma.bot/",
      publisher: "UMA",
      tier: "official",
      locator: "UMA's Founders section names R\xE9mi Cadene as CEO and founder; his biography describes Tesla Autopilot, building Optimus AI and creating LeRobot at Hugging Face.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-CADENE-PROFILE",
      url: "https://remicadene.com/",
      publisher: "R\xE9mi Cadene",
      tier: "primary",
      locator: "First-person profile identifies Cadene as UMA cofounder and CEO and describes Tesla Autopilot, initial Optimus neural networks and LeRobot as previous work.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-SHUO-MONDO",
      url: "https://www.linkedin.com/feed/update/urn:li:activity:7315116402867113984/",
      publisher: "Shuo Yang",
      tier: "primary",
      locator: "First-person announcement says he left the Tesla Optimus team to cofound Mondo Tech with Soren. This identity is keyed to this specific profile and is not joined to the three Shuo Yang research records.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-PROCEPTION-YC",
      url: "https://www.ycombinator.com/companies/proception-inc",
      publisher: "Y Combinator",
      tier: "official",
      locator: "YC lists Jay Li and Jack Xu as active founders of Proception, founded 2024. Jack Xu's individual biography explicitly says former Tesla engineer; this page does not establish Jay Li's personal employment dates.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-IDENTITY-PATHAK",
      url: "https://www.cs.cmu.edu/~dpathak/",
      publisher: "Carnegie Mellon University",
      tier: "official",
      locator: "Official Pathak biography identifies Skild AI cofounder, Berkeley PhD and Abbeel postdoc; it agrees with the explicitly keyed RLL alumni roster record and legacy founder record.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-IDENTITY-PINTO",
      url: "https://www.lerrelpinto.com/",
      publisher: "Lerrel Pinto",
      tier: "primary",
      locator: "First-person researcher profile and publication history provide the CMU and Berkeley RLL author continuity for the specific roster record; ARI attribution is separately sourced in the existing graph.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-IDENTITY-SHAH",
      url: "https://people.eecs.berkeley.edu/~shah",
      publisher: "UC Berkeley / Dhruv Shah",
      tier: "official",
      locator: "Berkeley institutional profile URL redirects to dhruvshah.me, which identifies a Berkeley PhD advised by Sergey Levine, Gemini Robotics and Princeton PRISM. This resolves the specific Berkeley roster and bibliographic records.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-IDENTITY-DARRELL",
      url: "https://people.eecs.berkeley.edu/~trevor/",
      publisher: "UC Berkeley",
      tier: "official",
      locator: "Institutional biography identifies Berkeley professor Trevor Darrell and links his publication record; official Berkeley dissertation evidence in the existing graph identifies the same professor as Pathak's adviser.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-DYNA-FOUNDERS",
      url: "https://www.prnewswire.com/news-releases/dyna-robotics-raises-23-5-million-to-commercialize-embodied-ai-with-low-cost-robots-302410263.html",
      publisher: "Dyna Robotics",
      tier: "official",
      locator: "March 25, 2025 issuer release names founders Lindon Gao, York Yang and Jason Ma; Ma is a former DeepMind research scientist. Announces a $23.5m seed and embodied robot foundation models.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-DYNA-SERIES-A",
      url: "https://www.prnewswire.com/news-releases/dyna-robotics-raises-120-million-to-advance-robotic-foundation-models-on-the-path-to-physical-artificial-general-intelligence-302556817.html",
      publisher: "Dyna Robotics",
      tier: "official",
      locator: "September 15, 2025 issuer release announces a closed $120m Series A and repeats the three founder names and Jason Ma's prior DeepMind research role.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-GENESIS-LAUNCH",
      url: "https://presse.bpifrance.fr/genesis-ai-annonce-une-levee-de-105m-pour-developper-un-modele-de-fondation-universel-de-robotique-et-une-plateforme-horizontale-pour-lia-appliquee-a-la-robotique/?lang=fra",
      publisher: "Bpifrance",
      tier: "official",
      locator: "July 3, 2025 investor release, carrying a June 30 company announcement, names Zhou Xian and Th\xE9ophile Gervet as cofounders and announces $105m funding for universal robotics foundation models and simulation.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-GENESIS-MODEL",
      url: "https://www.prnewswire.com/news-releases/genesis-ai-unveils-gene-26-5--the-first-ai-brain-to-enable-robots-with-human-level-physical-manipulation-capabilities-302763638.html",
      publisher: "Genesis AI",
      tier: "official",
      locator: "May 6, 2026 issuer release introduces GENE-26.5 and identifies Zhou Xian and Th\xE9ophile Gervet as cofounders. Model capability and simulation claims remain issuer claims.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-ANDY-GENERALIST",
      url: "https://andyzeng.github.io/",
      publisher: "Andy Zeng",
      tier: "primary",
      locator: "First-person profile identifies Zeng as Generalist cofounder and describes his previous Google DeepMind research-scientist role; it lists GEN-0, GEN-1 and GEN-1.5 as recent work.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-GENERALIST-FUNDING",
      url: "https://www.fenwick.com/insights/experience/fenwick-represents-generalist-ai-in-400m-funding",
      publisher: "Fenwick",
      tier: "official",
      locator: "June 4, 2026 transaction counsel announcement confirms representing Generalist in $400m financing at a $2bn valuation; this is a dated round, not a lifetime funding total.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-MIND-FOUNDER",
      url: "https://www.accel.com/news/mind-robotics-bringing-ai-to-the-physical-world",
      publisher: "Accel",
      tier: "official",
      locator: "Investor announcement calls RJ Scaringe the founder of Mind Robotics and describes training foundation models using the Rivian manufacturing partnership.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-MIND-FOUNDATION",
      url: "https://www.mindrobotics.com/",
      publisher: "Mind Robotics",
      tier: "official",
      locator: "The company describes foundation models trained on industrial video, spatial reasoning, object dynamics and tool manipulation, with Rivian as its first manufacturing partner.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-PAPER-2212.06817",
      url: "https://arxiv.org/abs/2212.06817",
      publisher: "arXiv / paper authors",
      tier: "primary",
      locator: "Primary manuscript title, ordered author byline, first-submission date and abstract. Transformer robot control trained on diverse real-world tasks; evaluated generalization depends on data scale and diversity.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-PAPER-2307.15818",
      url: "https://arxiv.org/abs/2307.15818",
      publisher: "arXiv / paper authors",
      tier: "primary",
      locator: "Primary manuscript title, ordered author byline, first-submission date and abstract. Co-fine-tunes vision-language models on robot trajectories and web tasks, representing robot actions as tokens; reports evaluation of semantic generalization.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-PAPER-2410.24164",
      url: "https://arxiv.org/abs/2410.24164",
      publisher: "arXiv / paper authors",
      tier: "primary",
      locator: "Primary manuscript title, ordered author byline, first-submission date and abstract. Combines a pretrained vision-language model with flow matching for general robot control across multiple platforms and dexterous tasks.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-FIGURE-SERIES-C",
      url: "https://www.intelcapital.com/figure-exceeds-1b-in-series-c-funding-at-39b-post-money-valuation/",
      publisher: "Intel Capital",
      tier: "official",
      locator: "September 16, 2025 issuer release hosted by investor Intel Capital: Figure announced over $1bn in committed Series C capital at a $39bn post-money valuation, led by Parkway Venture Capital. Committed capital is not represented as closed proceeds.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-MYTRA-SERIES-C",
      url: "https://mytra.ai/news/mytra-raises-120m-series-c",
      publisher: "Mytra",
      tier: "official",
      locator: "January 15, 2026 issuer release announces closure of a $120m Series C led by Avenir Growth. The round is distinct from lifetime funding and no valuation is disclosed.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-NVIDIA-ENT-1008",
      url: "https://www.nvidia.com/en-us/ai/cosmos/",
      publisher: "NVIDIA",
      tier: "official",
      locator: "Official NVIDIA product page identifies NVIDIA Cosmos as part of the company's platform portfolio; this is not a separate operating company identity.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-NVIDIA-ENT-1009",
      url: "https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/",
      publisher: "NVIDIA",
      tier: "official",
      locator: "Official NVIDIA product page identifies NVIDIA Jetson as part of the company's platform portfolio; this is not a separate operating company identity.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-NVIDIA-ENT-1010",
      url: "https://www.nvidia.com/en-us/omniverse/",
      publisher: "NVIDIA",
      tier: "official",
      locator: "Official NVIDIA product page identifies NVIDIA Omniverse as part of the company's platform portfolio; this is not a separate operating company identity.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-NVIDIA-ENT-1011",
      url: "https://www.nvidia.com/en-us/industries/robotics/",
      publisher: "NVIDIA",
      tier: "official",
      locator: "Official NVIDIA product page identifies NVIDIA Physical AI Platform as part of the company's platform portfolio; this is not a separate operating company identity.",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-CHENG-APPLE",
      url: "https://cheng-chi.github.io/assets/files/cv.pdf",
      publisher: "Cheng Chi official CV",
      tier: "primary",
      locator: "Industry Experience: Apple Inc, May 2019 to August 2019, Engineering Intern, Camera Architecture Team",
      retrievedAt: "2026-10-19",
      stance: "supports"
    },
    {
      id: "AR-EVD-SUNDAY-FOUNDERS",
      url: "https://www.sunday.ai/company",
      publisher: "Sunday Robotics",
      tier: "official",
      locator: "Team: Cheng Chi, co-founder and CTO",
      retrievedAt: "2026-10-19",
      stance: "supports"
    }
  ],
  relationships: [
    {
      id: "AR-REL-PI-FOUNDER-ENT-0031",
      subjectId: "ENT-0031",
      predicate: "founded",
      objectId: "ENT-0233",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-PI-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Founder title is explicitly listed by Physical Intelligence investor Redpoint; this corrects the older team-member-only classification. The reviewed roster source does not date the founding event."
    },
    {
      id: "AR-REL-PI-FOUNDER-ENT-0558",
      subjectId: "ENT-0558",
      predicate: "founded",
      objectId: "ENT-0233",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-PI-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Founder title is explicitly listed by Physical Intelligence investor Redpoint; this corrects the older team-member-only classification. The reviewed roster source does not date the founding event."
    },
    {
      id: "AR-REL-PI-FOUNDER-ENT-0559",
      subjectId: "ENT-0559",
      predicate: "founded",
      objectId: "ENT-0233",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-PI-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Founder title is explicitly listed by Physical Intelligence investor Redpoint; this corrects the older team-member-only classification. The reviewed roster source does not date the founding event."
    },
    {
      id: "AR-REL-PI-FOUNDER-ENT-0560",
      subjectId: "ENT-0560",
      predicate: "founded",
      objectId: "ENT-0233",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-PI-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Founder title is explicitly listed by Physical Intelligence investor Redpoint; this corrects the older team-member-only classification. The reviewed roster source does not date the founding event."
    },
    {
      id: "AR-REL-PI-FOUNDER-ENT-0561",
      subjectId: "ENT-0561",
      predicate: "founded",
      objectId: "ENT-0233",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-PI-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Founder title is explicitly listed by Physical Intelligence investor Redpoint; this corrects the older team-member-only classification. The reviewed roster source does not date the founding event."
    },
    {
      id: "AR-REL-OPTIMUS-PARENT",
      subjectId: "ENT-0289",
      predicate: "part_of",
      objectId: "ENT-0288",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-TESLA-AI"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Optimus is Tesla's robotics program, retained as a separate unit and rolled up to Tesla."
    },
    {
      id: "AR-REL-TESLA-DRIVING-PARENT",
      subjectId: "ENT-1166",
      predicate: "part_of",
      objectId: "ENT-0288",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-TESLA-AI"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Tesla Autonomous Driving is a Tesla program; no separate operating company is implied."
    },
    {
      id: "AR-REL-NVIDIA-PARENT-ENT-0311",
      subjectId: "ENT-0311",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-RESEARCH"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Corporate research or robotics unit rolled up to NVIDIA; identity is retained."
    },
    {
      id: "AR-REL-NVIDIA-PARENT-ENT-0336",
      subjectId: "ENT-0336",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-RESEARCH"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Corporate research or robotics unit rolled up to NVIDIA; identity is retained."
    },
    {
      id: "AR-REL-NVIDIA-PARENT-ENT-1012",
      subjectId: "ENT-1012",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-RESEARCH"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Corporate research or robotics unit rolled up to NVIDIA; identity is retained."
    },
    {
      id: "AR-REL-GEAR-PARENT-ENT-2052",
      subjectId: "ENT-2052",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-GEAR"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "NVIDIA research unit rolled up to NVIDIA; no employment dates are inferred."
    },
    {
      id: "AR-REL-GEAR-PARENT-ENT-0111",
      subjectId: "ENT-0111",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-GEAR"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "NVIDIA research unit rolled up to NVIDIA; no employment dates are inferred."
    },
    {
      id: "AR-REL-STERLING-TESLA",
      subjectId: "ENT-2093",
      predicate: "employed_by",
      objectId: "ENT-0288",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-STERLING-AURORA"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Aurora explicitly describes these Tesla roles as preceding Aurora. Employment start and end dates are not supplied.",
      roleObservation: {
        role: "Model X and Autopilot leader",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "Aurora explicitly states that Anderson led Tesla Model X and then Autopilot before cofounding Aurora. The source proves this order without supplying employment dates.",
        startYear: null,
        endYear: null,
        beforeFoundingCompanyIds: [
          "ENT-0701"
        ]
      }
    },
    {
      id: "AR-REL-WALTI-TESLA",
      subjectId: "ENT-9050001",
      predicate: "employed_by",
      objectId: "ENT-0288",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-WALTI-MYTRA"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Mytra reports 7.5 years at Tesla before Mytra; exact employment dates are not published in this source.",
      roleObservation: {
        role: "Mobile robotics and TeslaBot program lead",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "Mytra reports 7.5 years at Tesla before Mytra; exact employment dates are not published in this source.",
        startYear: null,
        endYear: null
      }
    },
    {
      id: "AR-REL-WALTI-MYTRA",
      subjectId: "ENT-9050001",
      predicate: "founded",
      objectId: "ENT-0245",
      layer: "company",
      temporal: {
        startYear: 2022,
        endYear: null,
        precision: "exact_start"
      },
      evidenceIds: [
        "AR-EVD-WALTI-MYTRA",
        "AR-EVD-WALTI-COFOUNDER"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Mytra's company history dates formation to 2022 and its announcement identifies Walti as cofounder."
    },
    {
      id: "AR-REL-ESMAIL-TESLA",
      subjectId: "ENT-0558",
      predicate: "employed_by",
      objectId: "ENT-0288",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-ESMAIL-TESLA"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Anduril's 2020 biography establishes the prior Tesla tenure; individual employment dates remain unknown.",
      roleObservation: {
        role: "Engineering, sustainability and self-driving technologies",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "Anduril's 2020 biography establishes the prior Tesla tenure; individual employment dates remain unknown.",
        startYear: null,
        endYear: null
      }
    },
    {
      id: "AR-REL-CADENE-TESLA",
      subjectId: "ENT-0029",
      predicate: "employed_by",
      objectId: "ENT-0288",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-CADENE-UMA",
        "AR-EVD-CADENE-PROFILE"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Cadene's first-person profile and UMA founder biography identify his Tesla work as prior experience. Exact dates are unknown.",
      roleObservation: {
        role: "Autopilot and Optimus AI researcher",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "Cadene's first-person profile and UMA founder biography identify his Tesla work as prior experience. Exact dates are unknown.",
        startYear: null,
        endYear: null
      }
    },
    {
      id: "AR-REL-CADENE-UMA",
      subjectId: "ENT-0029",
      predicate: "founded",
      objectId: "ENT-9050002",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-CADENE-UMA",
        "AR-EVD-CADENE-PROFILE"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "UMA and Cadene's profile explicitly establish cofounder status. The company formation date remains undated in these primary pages."
    },
    {
      id: "AR-REL-SHUO-TESLA",
      subjectId: "ENT-9050003",
      predicate: "employed_by",
      objectId: "ENT-0289",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-SHUO-MONDO"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "His announcement explicitly places departure from Tesla Optimus before Mondo formation; employment dates remain unknown.",
      roleObservation: {
        role: "Optimus team member",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "His announcement explicitly places departure from Tesla Optimus before Mondo formation; employment dates remain unknown.",
        startYear: null,
        endYear: null
      }
    },
    {
      id: "AR-REL-SHUO-MONDO",
      subjectId: "ENT-9050003",
      predicate: "founded",
      objectId: "ENT-9050004",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-SHUO-MONDO"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "First-person cofounder statement. Publication timing is not used as an inferred incorporation date."
    },
    {
      id: "AR-REL-PROCEPTION-FOUNDER-ENT-9050006",
      subjectId: "ENT-9050006",
      predicate: "founded",
      objectId: "ENT-9050005",
      layer: "company",
      temporal: {
        startYear: 2024,
        endYear: null,
        precision: "exact_start"
      },
      evidenceIds: [
        "AR-EVD-PROCEPTION-YC"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "YC founder profile and company formation year; not a claim that the full formation date is known."
    },
    {
      id: "AR-REL-PROCEPTION-FOUNDER-ENT-9050007",
      subjectId: "ENT-9050007",
      predicate: "founded",
      objectId: "ENT-9050005",
      layer: "company",
      temporal: {
        startYear: 2024,
        endYear: null,
        precision: "exact_start"
      },
      evidenceIds: [
        "AR-EVD-PROCEPTION-YC"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "YC founder profile and company formation year; not a claim that the full formation date is known."
    },
    {
      id: "AR-REL-JACK-TESLA",
      subjectId: "ENT-9050007",
      predicate: "employed_by",
      objectId: "ENT-0288",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-PROCEPTION-YC"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "YC's individual founder biography explicitly identifies Jack Xu as an ex-Tesla engineer. Dates are unknown.",
      roleObservation: {
        role: "Engineer",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "YC's individual founder biography explicitly identifies Jack Xu as an ex-Tesla engineer. Dates are unknown.",
        startYear: null,
        endYear: null
      }
    },
    {
      id: "AR-REL-DYNA-FOUNDER-ENT-0550",
      subjectId: "ENT-0550",
      predicate: "founded",
      objectId: "ENT-0230",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-DYNA-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Explicit issuer cofounder roster; formation date is not independently inferred."
    },
    {
      id: "AR-REL-DYNA-FOUNDER-ENT-0551",
      subjectId: "ENT-0551",
      predicate: "founded",
      objectId: "ENT-0230",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-DYNA-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Explicit issuer cofounder roster; formation date is not independently inferred."
    },
    {
      id: "AR-REL-DYNA-FOUNDER-ENT-0552",
      subjectId: "ENT-0552",
      predicate: "founded",
      objectId: "ENT-0230",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-DYNA-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Explicit issuer cofounder roster; formation date is not independently inferred."
    },
    {
      id: "AR-REL-JASON-DEEPMIND",
      subjectId: "ENT-0551",
      predicate: "employed_by",
      objectId: "ENT-0312",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-DYNA-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Dyna explicitly describes Jason Ma as a former DeepMind research scientist.",
      roleObservation: {
        role: "Research scientist",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "Dyna explicitly describes Jason Ma as a former DeepMind research scientist.",
        startYear: null,
        endYear: null
      }
    },
    {
      id: "AR-REL-GENESIS-FOUNDER-ENT-900162",
      subjectId: "ENT-900162",
      predicate: "founded",
      objectId: "ENT-0853",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-GENESIS-LAUNCH"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Explicit first-party investor cofounder statement; incorporation date remains unknown."
    },
    {
      id: "AR-REL-GENESIS-FOUNDER-ENT-900163",
      subjectId: "ENT-900163",
      predicate: "founded",
      objectId: "ENT-0853",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-GENESIS-LAUNCH"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Explicit first-party investor cofounder statement; incorporation date remains unknown."
    },
    {
      id: "AR-REL-GENESIS-RESEARCH",
      subjectId: "ENT-9050010",
      predicate: "released_by",
      objectId: "ENT-0853",
      layer: "company",
      temporal: {
        startYear: 2026,
        endYear: null,
        precision: "exact_start",
        startDate: "2026-05-06"
      },
      evidenceIds: [
        "AR-EVD-GENESIS-MODEL"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Company-announced robot foundation model; performance claims are not independently verified."
    },
    {
      id: "AR-REL-ANDY-GENERALIST",
      subjectId: "ENT-0555",
      predicate: "founded",
      objectId: "ENT-0231",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-ANDY-GENERALIST"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Zeng's first-person cofounder statement. This curated subset does not claim to be Generalist's full founding roster."
    },
    {
      id: "AR-REL-ANDY-DEEPMIND",
      subjectId: "ENT-0555",
      predicate: "employed_by",
      objectId: "ENT-0312",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-ANDY-GENERALIST"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Zeng describes Google DeepMind research-scientist work as preceding Generalist; exact dates are not supplied.",
      roleObservation: {
        role: "Research scientist",
        observedAsOf: "2026-10-19",
        timing: "former",
        statement: "Zeng describes Google DeepMind research-scientist work as preceding Generalist; exact dates are not supplied.",
        startYear: null,
        endYear: null
      }
    },
    {
      id: "AR-REL-RJ-MIND",
      subjectId: "ENT-0582",
      predicate: "founded",
      objectId: "ENT-0244",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-MIND-FOUNDER"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Explicit investor founder attribution; company formation date is not inferred."
    },
    {
      id: "AR-REL-MIND-RESEARCH",
      subjectId: "ENT-9050011",
      predicate: "released_by",
      objectId: "ENT-0244",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-MIND-FOUNDATION"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Company describes its industrial foundation-model program. Dates, commercial availability and independent reliability remain unverified."
    },
    {
      id: "AR-REL-NVIDIA-PRODUCT-PARENT-ENT-1008",
      subjectId: "ENT-1008",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-ENT-1008"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Retain the separately keyed platform record while rolling its company affiliation up to NVIDIA."
    },
    {
      id: "AR-REL-NVIDIA-PRODUCT-PARENT-ENT-1009",
      subjectId: "ENT-1009",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-ENT-1009"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Retain the separately keyed platform record while rolling its company affiliation up to NVIDIA."
    },
    {
      id: "AR-REL-NVIDIA-PRODUCT-PARENT-ENT-1010",
      subjectId: "ENT-1010",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-ENT-1010"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Retain the separately keyed platform record while rolling its company affiliation up to NVIDIA."
    },
    {
      id: "AR-REL-NVIDIA-PRODUCT-PARENT-ENT-1011",
      subjectId: "ENT-1011",
      predicate: "part_of",
      objectId: "ENT-0285",
      layer: "institutional",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-NVIDIA-ENT-1011"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      collectionIds: [],
      note: "Retain the separately keyed platform record while rolling its company affiliation up to NVIDIA."
    },
    {
      id: "AR-REL-CHENG-APPLE",
      subjectId: "ENT-0518",
      predicate: "employed_by",
      objectId: "ENT-9050030",
      layer: "institutional",
      temporal: {
        startYear: 2019,
        endYear: 2019,
        startMonth: "2019-05",
        endMonth: "2019-08",
        precision: "exact_range"
      },
      evidenceIds: [
        "AR-EVD-CHENG-APPLE"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Verified fact",
      revision: 1,
      note: "Engineering internship at Apple Camera Architecture. Official CV gives May to August 2019; not a permanent role."
    },
    {
      id: "AR-REL-CHENG-SUNDAY",
      subjectId: "ENT-0518",
      predicate: "founded",
      objectId: "ENT-0216",
      layer: "company",
      temporal: {
        startYear: null,
        endYear: null,
        precision: "undated"
      },
      evidenceIds: [
        "AR-EVD-SUNDAY-FOUNDERS"
      ],
      status: "published",
      derived: false,
      conclusionLabel: "Company-reported claim",
      revision: 1,
      note: "Sunday identifies Cheng Chi as co-founder and CTO. This page does not establish exact formation or departure dates."
    }
  ],
  redirects: [
    {
      fromId: "ENT-5220",
      toId: "ENT-0008",
      canonicalName: "Deepak Pathak",
      fromTypedId: "PER-2614",
      reviewedAt: "2026-10-19",
      evidenceIds: [
        "AR-EVD-IDENTITY-PATHAK"
      ],
      basis: "RLL alumni profile, Berkeley doctoral/postdoctoral history and Skild founder biography"
    },
    {
      fromId: "ENT-5221",
      toId: "ENT-0010",
      canonicalName: "Lerrel Pinto",
      fromTypedId: "PER-2615",
      reviewedAt: "2026-10-19",
      evidenceIds: [
        "AR-EVD-IDENTITY-PINTO"
      ],
      basis: "CMU-linked RLL alumni record and researcher publication continuity"
    },
    {
      fromId: "ENT-4656",
      toId: "ENT-0036",
      canonicalName: "Dhruv Shah",
      fromTypedId: "PER-2397",
      reviewedAt: "2026-10-19",
      evidenceIds: [
        "AR-EVD-IDENTITY-SHAH"
      ],
      basis: "RAIL roster, Berkeley institutional profile redirect and Levine doctoral biography"
    },
    {
      fromId: "ENT-4781",
      toId: "ENT-0036",
      canonicalName: "Dhruv Shah",
      fromTypedId: "PER-2521",
      reviewedAt: "2026-10-19",
      evidenceIds: [
        "AR-EVD-IDENTITY-SHAH"
      ],
      basis: "Institutional profile URL redirects to canonical first-person profile"
    },
    {
      fromId: "ENT-2099",
      toId: "ENT-3226",
      canonicalName: "Trevor Darrell",
      fromTypedId: "PER-0650",
      reviewedAt: "2026-10-19",
      evidenceIds: [
        "AR-EVD-IDENTITY-DARRELL"
      ],
      basis: "Official Berkeley professor profile, publication identity and dissertation adviser record"
    }
  ],
  facts: [
    {
      id: "AR-FACT-GENESIS-105",
      entityId: "ENT-0853",
      metric: "Tracked disclosed financing",
      factType: "tracked_disclosed_financing",
      displayValue: "$105M round",
      numericValue: 105e6,
      currency: "USD",
      periodLabel: "Single announced financing round",
      disclosureStatus: "disclosed",
      coverageOutcome: "publisher_selection",
      asOf: "2025-06-30",
      evidenceIds: [
        "AR-EVD-GENESIS-LAUNCH"
      ],
      conclusionLabel: "Company-reported claim",
      revision: 1,
      status: "published"
    },
    {
      id: "AR-FACT-DYNA-120",
      entityId: "ENT-0230",
      metric: "Tracked disclosed financing",
      factType: "tracked_disclosed_financing",
      displayValue: "$120M round",
      numericValue: 12e7,
      currency: "USD",
      periodLabel: "Single announced financing round",
      disclosureStatus: "disclosed",
      coverageOutcome: "publisher_selection",
      asOf: "2025-09-15",
      evidenceIds: [
        "AR-EVD-DYNA-SERIES-A"
      ],
      conclusionLabel: "Company-reported claim",
      revision: 1,
      status: "published"
    },
    {
      id: "AR-FACT-GENERALIST-400",
      entityId: "ENT-0231",
      metric: "Tracked disclosed financing",
      factType: "tracked_disclosed_financing",
      displayValue: "$400M round",
      numericValue: 4e8,
      currency: "USD",
      periodLabel: "Single announced financing round",
      disclosureStatus: "disclosed",
      coverageOutcome: "publisher_selection",
      asOf: "2026-06-04",
      evidenceIds: [
        "AR-EVD-GENERALIST-FUNDING"
      ],
      conclusionLabel: "Company-reported claim",
      revision: 1,
      status: "published"
    },
    {
      id: "AR-FACT-FIGURE-COMMITTED",
      entityId: "ENT-0214",
      metric: "Announced financing round",
      factType: "tracked_disclosed_financing",
      displayValue: ">$1B committed Series C",
      numericValue: null,
      currency: "USD",
      periodLabel: "Series C; committed capital above disclosed lower bound",
      disclosureStatus: "qualified",
      coverageOutcome: "publisher_selection",
      asOf: "2025-09-16",
      evidenceIds: [
        "AR-EVD-FIGURE-SERIES-C"
      ],
      conclusionLabel: "Company-reported claim",
      revision: 1,
      status: "published"
    },
    {
      id: "AR-FACT-FIGURE-VALUATION",
      entityId: "ENT-0214",
      metric: "valuation",
      factType: "valuation",
      displayValue: "$39B post-money",
      numericValue: 39e9,
      currency: "USD",
      periodLabel: "Series C",
      disclosureStatus: "disclosed",
      coverageOutcome: "publisher_selection",
      asOf: "2025-09-16",
      evidenceIds: [
        "AR-EVD-FIGURE-SERIES-C"
      ],
      conclusionLabel: "Company-reported claim",
      revision: 1,
      status: "published"
    },
    {
      id: "AR-FACT-MYTRA-CLOSED",
      entityId: "ENT-0245",
      metric: "Closed financing round",
      factType: "tracked_disclosed_financing",
      displayValue: "$120M closed Series C",
      numericValue: 12e7,
      currency: "USD",
      periodLabel: "Series C",
      disclosureStatus: "disclosed",
      coverageOutcome: "publisher_selection",
      asOf: "2026-01-15",
      evidenceIds: [
        "AR-EVD-MYTRA-SERIES-C"
      ],
      conclusionLabel: "Company-reported claim",
      revision: 1,
      status: "published",
      financingStatus: "closed"
    }
  ],
  gaps: [
    "Employment start and end dates remain unknown where the cited sources only state prior experience; no exact dates are inferred from tenure lengths.",
    "The 244 duplicate-name groups in the report have not been globally merged. Only the explicit, reviewed identity pairs in this pack are joined.",
    "Ashish Kumar to Intelligent Machines remains outside this primary-source backfill: the report cites a paywalled news story and no primary founder announcement was verified.",
    "Only Jack Xu has individual Tesla employment confirmed by the reviewed Y Combinator profile. Jay Li remains a verified Proception cofounder with prior Tesla employment unbackfilled in this pack.",
    "World-model capability profiles describe publisher-reported research and products; they do not establish reliable robot deployments.",
    "Market sizing, comparable-company valuation analysis and supply-chain research remain separate coverage gaps."
  ],
  authorMentions: [
    {
      id: "AR-MENTION-2212.06817-1",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Anthony Brohan",
      authorOrder: 1,
      isFirstAuthor: true,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-2",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Noah Brown",
      authorOrder: 2,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-3",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Justice Carbajal",
      authorOrder: 3,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-4",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Yevgen Chebotar",
      authorOrder: 4,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-5",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Joseph Dabis",
      authorOrder: 5,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-6",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Chelsea Finn",
      authorOrder: 6,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-7",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Keerthana Gopalakrishnan",
      authorOrder: 7,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-8",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Karol Hausman",
      authorOrder: 8,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-9",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Alex Herzog",
      authorOrder: 9,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-10",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Jasmine Hsu",
      authorOrder: 10,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-11",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Julian Ibarz",
      authorOrder: 11,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-12",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Brian Ichter",
      authorOrder: 12,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-13",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Alex Irpan",
      authorOrder: 13,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-14",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Tomas Jackson",
      authorOrder: 14,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-15",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Sally Jesmonth",
      authorOrder: 15,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-16",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Nikhil J Joshi",
      authorOrder: 16,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-17",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Ryan Julian",
      authorOrder: 17,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-18",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Dmitry Kalashnikov",
      authorOrder: 18,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-19",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Yuheng Kuang",
      authorOrder: 19,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-20",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Isabel Leal",
      authorOrder: 20,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-21",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Kuang-Huei Lee",
      authorOrder: 21,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-22",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Sergey Levine",
      authorOrder: 22,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-23",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Yao Lu",
      authorOrder: 23,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-24",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Utsav Malla",
      authorOrder: 24,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-25",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Deeksha Manjunath",
      authorOrder: 25,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-26",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Igor Mordatch",
      authorOrder: 26,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-27",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Ofir Nachum",
      authorOrder: 27,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-28",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Carolina Parada",
      authorOrder: 28,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-29",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Jodilyn Peralta",
      authorOrder: 29,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-30",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Emily Perez",
      authorOrder: 30,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-31",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Karl Pertsch",
      authorOrder: 31,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-32",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Jornell Quiambao",
      authorOrder: 32,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-33",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Kanishka Rao",
      authorOrder: 33,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-34",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Michael Ryoo",
      authorOrder: 34,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-35",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Grecia Salazar",
      authorOrder: 35,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-36",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Pannag Sanketi",
      authorOrder: 36,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-37",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Kevin Sayed",
      authorOrder: 37,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-38",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Jaspiar Singh",
      authorOrder: 38,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-39",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Sumedh Sontakke",
      authorOrder: 39,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-40",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Austin Stone",
      authorOrder: 40,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-41",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Clayton Tan",
      authorOrder: 41,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-42",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Huong Tran",
      authorOrder: 42,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-43",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Vincent Vanhoucke",
      authorOrder: 43,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-44",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Steve Vega",
      authorOrder: 44,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-45",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Quan Vuong",
      authorOrder: 45,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-46",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Fei Xia",
      authorOrder: 46,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-47",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Ted Xiao",
      authorOrder: 47,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-48",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Peng Xu",
      authorOrder: 48,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-49",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Sichun Xu",
      authorOrder: 49,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-50",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Tianhe Yu",
      authorOrder: 50,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2212.06817-51",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900100",
      displayName: "Brianna Zitkovich",
      authorOrder: 51,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2212.06817"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-1",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Anthony Brohan",
      authorOrder: 1,
      isFirstAuthor: true,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-2",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Noah Brown",
      authorOrder: 2,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-3",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Justice Carbajal",
      authorOrder: 3,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-4",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Yevgen Chebotar",
      authorOrder: 4,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-5",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Xi Chen",
      authorOrder: 5,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-6",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Krzysztof Choromanski",
      authorOrder: 6,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-7",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Tianli Ding",
      authorOrder: 7,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-8",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Danny Driess",
      authorOrder: 8,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-9",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Avinava Dubey",
      authorOrder: 9,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-10",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Chelsea Finn",
      authorOrder: 10,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-11",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Pete Florence",
      authorOrder: 11,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-12",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Chuyuan Fu",
      authorOrder: 12,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-13",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Montse Gonzalez Arenas",
      authorOrder: 13,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-14",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Keerthana Gopalakrishnan",
      authorOrder: 14,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-15",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Kehang Han",
      authorOrder: 15,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-16",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Karol Hausman",
      authorOrder: 16,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-17",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Alexander Herzog",
      authorOrder: 17,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-18",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Jasmine Hsu",
      authorOrder: 18,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-19",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Brian Ichter",
      authorOrder: 19,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-20",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Alex Irpan",
      authorOrder: 20,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-21",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Nikhil Joshi",
      authorOrder: 21,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-22",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Ryan Julian",
      authorOrder: 22,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-23",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Dmitry Kalashnikov",
      authorOrder: 23,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-24",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Yuheng Kuang",
      authorOrder: 24,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-25",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Isabel Leal",
      authorOrder: 25,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-26",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Lisa Lee",
      authorOrder: 26,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-27",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Tsang-Wei Edward Lee",
      authorOrder: 27,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-28",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Sergey Levine",
      authorOrder: 28,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-29",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Yao Lu",
      authorOrder: 29,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-30",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Henryk Michalewski",
      authorOrder: 30,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-31",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Igor Mordatch",
      authorOrder: 31,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-32",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Karl Pertsch",
      authorOrder: 32,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-33",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Kanishka Rao",
      authorOrder: 33,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-34",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Krista Reymann",
      authorOrder: 34,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-35",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Michael Ryoo",
      authorOrder: 35,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-36",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Grecia Salazar",
      authorOrder: 36,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-37",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Pannag Sanketi",
      authorOrder: 37,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-38",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Pierre Sermanet",
      authorOrder: 38,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-39",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Jaspiar Singh",
      authorOrder: 39,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-40",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Anikait Singh",
      authorOrder: 40,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-41",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Radu Soricut",
      authorOrder: 41,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-42",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Huong Tran",
      authorOrder: 42,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-43",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Vincent Vanhoucke",
      authorOrder: 43,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-44",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Quan Vuong",
      authorOrder: 44,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-45",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Ayzaan Wahid",
      authorOrder: 45,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-46",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Stefan Welker",
      authorOrder: 46,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-47",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Paul Wohlhart",
      authorOrder: 47,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-48",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Jialin Wu",
      authorOrder: 48,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-49",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Fei Xia",
      authorOrder: 49,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-50",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Ted Xiao",
      authorOrder: 50,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-51",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Peng Xu",
      authorOrder: 51,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-52",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Sichun Xu",
      authorOrder: 52,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-53",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Tianhe Yu",
      authorOrder: 53,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2307.15818-54",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-900104",
      displayName: "Brianna Zitkovich",
      authorOrder: 54,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2307.15818"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-1",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Kevin Black",
      authorOrder: 1,
      isFirstAuthor: true,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-2",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Noah Brown",
      authorOrder: 2,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-3",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Danny Driess",
      authorOrder: 3,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-4",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Adnan Esmail",
      authorOrder: 4,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-5",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Michael Equi",
      authorOrder: 5,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-6",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Chelsea Finn",
      authorOrder: 6,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-7",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Niccolo Fusai",
      authorOrder: 7,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-8",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Lachy Groom",
      authorOrder: 8,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-9",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Karol Hausman",
      authorOrder: 9,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-10",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Brian Ichter",
      authorOrder: 10,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-11",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Szymon Jakubczak",
      authorOrder: 11,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-12",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Tim Jones",
      authorOrder: 12,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-13",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Liyiming Ke",
      authorOrder: 13,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-14",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Sergey Levine",
      authorOrder: 14,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-15",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Adrian Li-Bell",
      authorOrder: 15,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-16",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Mohith Mothukuri",
      authorOrder: 16,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-17",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Suraj Nair",
      authorOrder: 17,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-18",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Karl Pertsch",
      authorOrder: 18,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-19",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Lucy Xiaoyang Shi",
      authorOrder: 19,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-20",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "James Tanner",
      authorOrder: 20,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-21",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Quan Vuong",
      authorOrder: 21,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-22",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Anna Walling",
      authorOrder: 22,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-23",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Haohuan Wang",
      authorOrder: 23,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    },
    {
      id: "AR-MENTION-2410.24164-24",
      collectionId: "atlas-review-robot-papers-2026-10-19",
      paperId: "ENT-9040003",
      displayName: "Ury Zhilinsky",
      authorOrder: 24,
      isFirstAuthor: false,
      resolution: "unresolved",
      resolutionTier: null,
      resolutionMethod: null,
      resolvedEntityId: null,
      relationshipId: null,
      evidenceIds: [
        "AR-EVD-PAPER-2410.24164"
      ],
      locator: "Ordered author byline; a name is not sufficient identity evidence for a canonical person join."
    }
  ]
};

// src/lib/sources.ts
function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function getActivitySources(activity) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  if (activity.sourceUrl && activity.sourceType !== "Gmail") {
    const url = activity.sourceUrl;
    const lookup = url.toLowerCase();
    if (!seen.has(lookup)) {
      seen.add(lookup);
      out.push({
        url,
        type: activity.sourceType,
        title: activity.sourceReference && !activity.sourceReference.startsWith("gmail:") ? activity.sourceReference : hostOf(url),
        primary: true
      });
    }
  }
  for (const ref of activity.additionalSources ?? []) {
    if (!ref.url) continue;
    const lookup = ref.url.toLowerCase();
    if (seen.has(lookup)) continue;
    seen.add(lookup);
    out.push({
      url: ref.url,
      type: ref.type ?? "article",
      title: ref.title ?? hostOf(ref.url),
      primary: false
    });
  }
  return out;
}

// src/lib/financingStatus.ts
var STATUS_LABELS = {
  proposed: "Proposed",
  announced: "Announced",
  closed: "Closed",
  unknown: "Status unconfirmed"
};
var PROPOSED_LANGUAGE = /\b(in talks?|talks? to raise|discuss(?:ing|ions?)|eyes?|target(?:s|ing)?|seeking|plans? to raise|consider(?:ing|ed)|could raise|expected to raise|unconfirmed|rumou?red|reportedly)\b/i;
var ANNOUNCED_LANGUAGE = /\b(announc(?:e|ed|es|ing)|new financing announced|funding announced)\b/i;
function financingStatusFromEvidence(input) {
  if (input.status) return input.status;
  const text = [input.title, input.description, input.sourceUrl].filter(Boolean).join(" ");
  if (PROPOSED_LANGUAGE.test(text)) return "proposed";
  if (ANNOUNCED_LANGUAGE.test(text)) return "announced";
  return "unknown";
}
function financingStatusFor(activity) {
  if (activity.activityType !== "financing") return "unknown";
  const sourceText = getActivitySources(activity).flatMap((source) => [source.title, source.url]).join(" ");
  return financingStatusFromEvidence({ status: activity.financingStatus, description: `${activity.description} ${activity.sourceReference ?? ""}`, sourceUrl: sourceText });
}
function financingStatusLabel(status) {
  return STATUS_LABELS[typeof status === "string" ? status : financingStatusFor(status)];
}

// src/lib/paperBylineCoverage.ts
var PAPER_BYLINE_SOURCES = [
  {
    paperId: "ENT-900012",
    sourceUrl: "https://arxiv.org/abs/2403.12945",
    sourceLabel: "arXiv v2 published page",
    sourceAuthorCount: 101,
    checkedAt: "2026-09-20"
  }
];
function paperBylineCoverage(paperId, includedAuthors, resolvedIdentities, sources = PAPER_BYLINE_SOURCES) {
  const source = sources.find((candidate) => candidate.paperId === paperId) ?? null;
  if (!source) {
    return {
      sourceAuthorCount: null,
      includedAuthors,
      resolvedIdentities,
      unknownSourceCount: null,
      status: "unknown",
      source: null
    };
  }
  const unknownSourceCount = source.sourceAuthorCount - includedAuthors;
  return {
    sourceAuthorCount: source.sourceAuthorCount,
    includedAuthors,
    resolvedIdentities,
    unknownSourceCount: unknownSourceCount >= 0 ? unknownSourceCount : null,
    status: unknownSourceCount === 0 ? "complete" : unknownSourceCount > 0 ? "partial" : "inconsistent",
    source
  };
}

// src/lib/knowledgeGraph.ts
var GRAPH_LAYERS = ["institutional", "research", "company", "capital"];
var RESEARCH_KINDS = /* @__PURE__ */ new Set(["paper", "thesis", "idea", "project", "software", "dataset", "model", "benchmark", "product"]);
var SEMANTIC_RESEARCH_PREDICATES = /* @__PURE__ */ new Set(["cites", "extends", "builds_on", "implements", "uses", "introduced", "contributed_to", "developed", "maintains", "released_by", "commercializes", "depends_on", "trained_on", "based_on"]);
var ORGANIZATION_KINDS = /* @__PURE__ */ new Set(["company", "vc_firm", "university", "lab", "organization"]);
var EMERGING_SUBTYPES = /emerging researcher|student|phd|doctoral|postdoc|research staff|fellow|recent graduate/i;
var PHYSICAL_AI_TERMS = /robot|embodied|physical ai|spatial|autonom|world model|ai for science|drug discovery|vision|control|simulation/i;
var STARTUP_TERMINAL_DIRECTIONS = {
  founded: "object",
  spun_out_of: "subject",
  launched_from: "subject",
  commercializes: "subject",
  released_by: "object"
};
function normalized(value) {
  return value.trim().toLocaleLowerCase();
}
function resolveRedirect(graph, id) {
  const seen = /* @__PURE__ */ new Set();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const next = graph.redirects?.find((redirect) => redirect.fromId === current)?.toId;
    if (!next) break;
    current = next;
  }
  return current;
}
function resolveGraphEntity(graph, candidate) {
  if (!candidate) return null;
  const directId = resolveRedirect(graph, candidate.trim());
  const byId = graph.entities.find((entity) => entity.id === directId || entity.typedId === directId);
  if (byId) return byId;
  const query = normalized(candidate);
  const names = graph.entities.filter((entity) => normalized(entity.canonicalName) === query || normalized(entity.displayName) === query);
  const matches = names.length ? names : graph.entities.filter((entity) => entity.aliases.some((alias) => normalized(alias) === query));
  const resolvedIds = new Set(matches.map((entity) => resolveRedirect(graph, entity.id)));
  return resolvedIds.size === 1 ? graph.entities.find((entity) => entity.id === [...resolvedIds][0]) ?? null : null;
}
var canonicalGraphCache = /* @__PURE__ */ new WeakMap();
function canonicalizeGraphIdentities(graph) {
  const cached = canonicalGraphCache.get(graph);
  if (cached) return cached;
  if (!graph.redirects?.length) return graph;
  const byId = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const canonicalId = (id) => {
    const target = resolveRedirect(graph, id);
    return byId.has(target) ? target : id;
  };
  const groups = /* @__PURE__ */ new Map();
  for (const entity of graph.entities) {
    const id = canonicalId(entity.id);
    const records = groups.get(id) ?? [];
    records.push(entity);
    groups.set(id, records);
  }
  const entities = [...groups].map(([id, records]) => {
    const canonical = byId.get(id);
    if (records.length === 1) return canonical;
    return {
      ...canonical,
      aliases: [.../* @__PURE__ */ new Set([...canonical.aliases, ...records.flatMap((record) => record.id === id ? [] : [record.canonicalName, record.displayName, ...record.aliases])])],
      externalIds: Object.fromEntries([...new Set(records.flatMap((record) => Object.keys(record.externalIds)))].map((key) => {
        const values = [...new Set(records.flatMap((record) => [record.externalIds[key] ?? []].flat()))];
        return [key, values.length === 1 ? values[0] : values];
      }))
    };
  });
  const relationships = graph.relationships.map((row) => ({ ...row, subjectId: canonicalId(row.subjectId), objectId: canonicalId(row.objectId) })).filter((row) => row.subjectId !== row.objectId);
  const result = {
    ...graph,
    entities,
    relationships,
    facts: graph.facts?.map((fact) => ({ ...fact, entityId: canonicalId(fact.entityId) })),
    authorMentions: graph.authorMentions?.map((mention) => ({ ...mention, paperId: canonicalId(mention.paperId), resolvedEntityId: mention.resolvedEntityId ? canonicalId(mention.resolvedEntityId) : null })),
    collections: graph.collections.map((collection) => ({ ...collection, entityIds: [...new Set(collection.entityIds.map(canonicalId))] }))
  };
  canonicalGraphCache.set(graph, result);
  canonicalGraphCache.set(result, result);
  return result;
}
function graphSnapshotAsOf(input, asOf) {
  const graph = canonicalizeGraphIdentities(input);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return graph;
  const editorialAsOf = graphEditorialResearchAsOf(graph);
  const enrichmentAsOf = graph.metadata.discoveryEvidence?.asOf;
  const latest = [graph.metadata.asOf, typeof graph.metadata.snapshotSourceAsOf === "string" ? graph.metadata.snapshotSourceAsOf : "", editorialAsOf ?? "", enrichmentAsOf ?? ""].sort().at(-1);
  const historical = asOf < latest;
  const knownByCutoff = (value) => {
    if (!historical) return value <= asOf.slice(0, value.length);
    const upper = value.length === 4 ? `${value}-12-31` : value.length === 7 ? `${value}-${new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0)).getUTCDate()}` : value;
    return upper <= asOf;
  };
  const visibleAt = (row) => {
    const start = row.temporal.startDate ?? row.temporal.startMonth ?? (row.temporal.startYear === null ? null : String(row.temporal.startYear));
    if (start) return knownByCutoff(start);
    const end = row.temporal.endDate ?? row.temporal.endMonth ?? (row.temporal.endYear === null ? null : String(row.temporal.endYear));
    return end ? knownByCutoff(end) : !historical && (!row.roleObservation || row.roleObservation.observedAsOf <= asOf);
  };
  let relationships = graph.relationships.filter(visibleAt);
  if (historical) {
    const support = verifiedPublicSupportingEvidenceIds(graph);
    const authorships = /* @__PURE__ */ new Map();
    for (const row of relationships) if (row.predicate === "authored" && relationshipHasVerifiedPublicSupport(row, support)) {
      authorships.set(row.objectId, [...authorships.get(row.objectId) ?? [], row]);
    }
    relationships = relationships.flatMap((row) => {
      if (row.predicate !== "coauthored_with" || !row.derived) return [row];
      const sharedPaperIds = (row.sharedPaperIds ?? []).filter((paperId) => {
        const byline = authorships.get(paperId) ?? [];
        return byline.some((author) => author.subjectId === row.subjectId) && byline.some((author) => author.subjectId === row.objectId);
      });
      const qualifies = sharedPaperIds.some((paperId) => authorships.get(paperId).length <= 10) || sharedPaperIds.filter((paperId) => authorships.get(paperId).length <= 20).length >= 2;
      if (!qualifies) return [];
      const bylines = sharedPaperIds.flatMap((paperId) => authorships.get(paperId).filter((author) => author.subjectId === row.subjectId || author.subjectId === row.objectId));
      const years = bylines.flatMap((author) => author.temporal.startYear === null ? [] : [author.temporal.startYear]).sort((a, b) => a - b);
      const firstYear = years[0] ?? null, lastYear = years.at(-1) ?? null;
      return [{
        ...row,
        sharedPaperIds,
        paperCount: sharedPaperIds.length,
        firstYear: firstYear ?? void 0,
        lastYear: lastYear ?? void 0,
        temporal: { startYear: firstYear, endYear: lastYear !== firstYear ? lastYear : null, precision: "exact_range" },
        evidenceIds: [...new Set(bylines.flatMap((author) => author.evidenceIds))],
        note: `Co-published on ${sharedPaperIds.length} sourced paper${sharedPaperIds.length === 1 ? "" : "s"} visible by ${asOf}. Derived under the bounded co-publication rule; this does not establish mentorship or influence.`
      }];
    });
  }
  const relationshipIds = new Set(relationships.map((row) => row.id));
  const metadata = { ...graph.metadata, asOf, snapshotSourceAsOf: latest, snapshotTemporalPolicy: historical ? "dated_relationships_only" : "current_with_unknown_dates" };
  if (enrichmentAsOf && enrichmentAsOf > asOf) delete metadata.discoveryEvidence;
  if (editorialAsOf && editorialAsOf > asOf) delete metadata.editorialResearch;
  return {
    ...graph,
    metadata,
    relationships,
    facts: graph.facts?.filter((fact) => fact.asOf ? fact.asOf <= asOf : !historical),
    authorMentions: graph.authorMentions?.filter((mention) => mention.relationshipId ? relationshipIds.has(mention.relationshipId) : relationships.some((row) => row.predicate === "authored" && row.objectId === mention.paperId)),
    collections: graph.collections.map((collection) => ({ ...collection, relationshipIds: collection.relationshipIds.filter((id) => relationshipIds.has(id)) }))
  };
}
var GRAPH_EMPLOYMENT_PREDICATES = /* @__PURE__ */ new Set(["employed_by", "directs", "leads", "principal_investigator"]);
function graphEntityLabel(entity) {
  return entity.displayName || entity.canonicalName;
}
function graphEditorialResearchAsOf(graph) {
  const editorial = graph.metadata.editorialResearch;
  if (!editorial || typeof editorial !== "object" || Array.isArray(editorial)) return null;
  const atlas = editorial.ecosystemAtlas;
  if (!atlas || typeof atlas !== "object" || Array.isArray(atlas)) return null;
  const asOf = atlas.asOf;
  return typeof asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : null;
}
function graphPredicateLabel(predicate) {
  return predicate === "coauthored_with" ? "co-published" : predicate.replaceAll("_", " ");
}
function graphRelationshipStepLabel(relationship, fromId) {
  if (relationship.predicate === "coauthored_with" || relationship.subjectId === fromId) return graphPredicateLabel(relationship.predicate);
  const inverse = {
    authored: "authored by",
    cites: "cited by",
    extends: "extended by",
    builds_on: "built on by",
    implements: "implemented by",
    uses: "used by",
    released_by: "released",
    introduced: "introduced by",
    contributed_to: "has contribution from",
    developed: "developed by",
    maintains: "maintained by",
    founded: "founded by",
    employed_by: "employs",
    directs: "directed by",
    leads: "led by",
    member_of: "has member",
    affiliated_with: "has affiliate",
    advised_by: "advised",
    part_of: "includes",
    spun_out_of: "has spinout",
    launched_from: "has launch",
    commercializes: "commercialized by",
    invested_in: "has investment from",
    depends_on: "dependency of",
    trained_on: "training data for",
    based_on: "basis for",
    integrates_with: "integrates with",
    collaborates_with: "collaborates with"
  };
  return inverse[relationship.predicate] ?? `reverse of ${graphPredicateLabel(relationship.predicate)}`;
}
function publishedRelationships(graph, layers) {
  const entityIds = new Set(graph.entities.map((entity) => entity.id));
  return graph.relationships.filter((relationship) => relationship.status === "published" && layers.has(relationship.layer) && entityIds.has(relationship.subjectId) && entityIds.has(relationship.objectId));
}
function buildAdjacency(relationships) {
  const adjacency = /* @__PURE__ */ new Map();
  const add = (id, nextId, relationship) => {
    const current = adjacency.get(id) ?? [];
    current.push({ nextId, relationship });
    adjacency.set(id, current);
  };
  for (const relationship of relationships) {
    add(relationship.subjectId, relationship.objectId, relationship);
    add(relationship.objectId, relationship.subjectId, relationship);
  }
  for (const rows of adjacency.values()) rows.sort((left, right) => Number(left.relationship.derived) - Number(right.relationship.derived) || right.relationship.evidenceIds.length - left.relationship.evidenceIds.length || left.relationship.id.localeCompare(right.relationship.id));
  return adjacency;
}
function toPath(entity, nodes, relationships) {
  return {
    entity,
    nodes,
    relationships,
    hopCount: relationships.length,
    evidenceIds: Array.from(new Set(relationships.flatMap((relationship) => relationship.evidenceIds))),
    containsDerivedRelationship: relationships.some((relationship) => relationship.derived)
  };
}
function buildFilteredGraphNeighborhood(graph, rootId, layers, maxHops, acceptsStep) {
  graph = canonicalizeGraphIdentities(graph);
  const root = resolveGraphEntity(graph, rootId);
  if (!root) return [];
  const entities = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const adjacency = buildAdjacency(publishedRelationships(graph, layers));
  const parent = /* @__PURE__ */ new Map();
  const depth = /* @__PURE__ */ new Map([[root.id, 0]]);
  const queue = [root.id];
  while (queue.length) {
    const currentId = queue.shift();
    const currentDepth = depth.get(currentId) ?? 0;
    if (currentDepth >= maxHops) continue;
    for (const item of adjacency.get(currentId) ?? []) {
      if (acceptsStep && !acceptsStep(entities.get(currentId), entities.get(item.nextId), item.relationship)) continue;
      if (depth.has(item.nextId)) continue;
      depth.set(item.nextId, currentDepth + 1);
      parent.set(item.nextId, { previousId: currentId, relationship: item.relationship });
      queue.push(item.nextId);
    }
  }
  return Array.from(depth.entries()).filter(([entityId]) => entityId !== root.id).map(([entityId]) => {
    const target = entities.get(entityId);
    if (!target) return null;
    const reversedNodes = [target];
    const reversedRelationships = [];
    let cursor = entityId;
    while (cursor !== root.id) {
      const step = parent.get(cursor);
      if (!step) return null;
      const previous = entities.get(step.previousId);
      if (!previous) return null;
      reversedRelationships.push(step.relationship);
      reversedNodes.push(previous);
      cursor = step.previousId;
    }
    return toPath(target, reversedNodes.reverse(), reversedRelationships.reverse());
  }).filter((path) => path !== null).sort((left, right) => left.hopCount - right.hopCount || graphEntityLabel(left.entity).localeCompare(graphEntityLabel(right.entity)));
}
function buildGraphNeighborhood(graph, rootId, layers = new Set(GRAPH_LAYERS), maxHops = 2) {
  return buildFilteredGraphNeighborhood(graph, rootId, layers, maxHops);
}
function band(value, medium, high) {
  if (value >= high) return "high";
  if (value >= medium) return "medium";
  return "low";
}
function pathInputIds(paths) {
  return Array.from(new Set(paths.flatMap((path) => path.relationships.map((relationship) => relationship.id))));
}
function axis(id, label, axisBand, explanation, inputIds) {
  return { id, label, band: axisBand, explanation, inputIds: inputIds.slice(0, 12), missingInputs: [] };
}
function evidenceCoverageFor(graph, paths) {
  const relationships = Array.from(new Map(paths.flatMap((path) => path.relationships).filter((relationship) => !relationship.derived).map((relationship) => [relationship.id, relationship])).values());
  if (!relationships.length) return { supported: 0, total: 0, percent: 0 };
  const evidenceIds = verifiedPublicSupportingEvidenceIds(graph);
  const supported = relationships.filter((relationship) => relationship.evidenceIds.some((evidenceId) => evidenceIds.has(evidenceId))).length;
  return { supported, total: relationships.length, percent: Math.round(supported / relationships.length * 100) };
}
function evidenceFreshnessFor(graph, evidenceIds) {
  const relevantIds = new Set(evidenceIds);
  const evidence = graph.evidence.filter((item) => relevantIds.has(item.id));
  if (!evidence.length) return 0;
  const asOf = /* @__PURE__ */ new Date(`${graph.metadata.asOf}T00:00:00Z`);
  if (Number.isNaN(asOf.getTime())) return 0;
  const cutoff = new Date(asOf);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24);
  const editorialDate = graphEditorialResearchAsOf(graph);
  const editorialAsOf = editorialDate ? /* @__PURE__ */ new Date(`${editorialDate}T00:00:00Z`) : asOf;
  const editorialCutoff = new Date(editorialAsOf);
  editorialCutoff.setUTCMonth(editorialCutoff.getUTCMonth() - 24);
  const fresh = evidence.filter((item) => {
    const retrieved = /* @__PURE__ */ new Date(`${item.retrievedAt}T00:00:00Z`);
    const enrichment = graph.metadata.discoveryEvidence;
    const enrichmentAsOf = enrichment?.asOf ? /* @__PURE__ */ new Date(`${enrichment.asOf}T00:00:00Z`) : asOf;
    const enrichmentCutoff = new Date(enrichmentAsOf);
    enrichmentCutoff.setUTCMonth(enrichmentCutoff.getUTCMonth() - 24);
    const enrichmentSource = item.id.startsWith("DISCOVERY-EVIDENCE-");
    const editorialSource = item.id.startsWith("ATLAS-EVIDENCE-");
    const sourceAsOf = enrichmentSource ? enrichmentAsOf : editorialSource ? editorialAsOf : asOf;
    const sourceCutoff = enrichmentSource ? enrichmentCutoff : editorialSource ? editorialCutoff : cutoff;
    return !Number.isNaN(retrieved.getTime()) && retrieved >= sourceCutoff && retrieved <= sourceAsOf;
  }).length;
  return Math.round(fresh / evidence.length * 100);
}
function isEmergingResearcher(path, recentSince) {
  if (path.entity.kind !== "person") return false;
  const subtypeSignal = EMERGING_SUBTYPES.test(`${path.entity.subtype ?? ""} ${path.entity.lifecycleStatus ?? ""}`);
  if (!subtypeSignal) return false;
  return path.relationships.some((relationship) => relationship.layer === "research" && relationship.temporal.startYear !== null && relationship.temporal.startYear >= recentSince && relationship.evidenceIds.length > 0);
}
function pathEndsAtRelationshipEndpoint(path, relationship, endpoint) {
  return (endpoint === "subject" ? relationship.subjectId : relationship.objectId) === path.entity.id;
}
function verifiedPublicSupportingEvidenceIds(graph) {
  return new Set(graph.evidence.filter((evidence) => evidence.stance === "supports" && Boolean(evidence.url)).map((evidence) => evidence.id));
}
function relationshipHasVerifiedPublicSupport(relationship, supportingEvidenceIds) {
  return !relationship.derived && relationship.conclusionLabel !== "Derived signal" && relationship.conclusionLabel !== "Analyst thesis" && relationship.evidenceIds.some((evidenceId) => supportingEvidenceIds.has(evidenceId));
}
function hasVerifiedPublicSupport(graph, path) {
  const supportingEvidenceIds = verifiedPublicSupportingEvidenceIds(graph);
  return path.relationships.length > 0 && path.relationships.every((relationship) => relationshipHasVerifiedPublicSupport(relationship, supportingEvidenceIds));
}
function isUpstreamStep(from, to, relationship) {
  const predicate = relationship.predicate.toLocaleLowerCase();
  const alongRecordedDirection = relationship.subjectId === from.id;
  if (predicate === "coauthored_with") return false;
  if (/^(member_of|affiliated_with|directs|leads|principal_investigator|studied_at|trained_at|employed_by|alumnus_of|phd_at|postdoc_at)$/.test(predicate)) {
    return from.kind === "person" && ORGANIZATION_KINDS.has(to.kind);
  }
  if (/^(advised_by|mentored_by|trained_by)$/.test(predicate)) return alongRecordedDirection;
  if (/^(advises|advised|mentors|mentored)$/.test(predicate)) return !alongRecordedDirection;
  if (/^(part_of|successor_of|successor_to|spun_out_of|launched_from)$/.test(predicate)) return alongRecordedDirection;
  if (/^(founded|co_founded|launched|introduced|authored)$/.test(predicate)) return !alongRecordedDirection;
  if (/^(released_by|cites|extends|builds_on)$/.test(predicate)) return alongRecordedDirection;
  return false;
}
function describeSourceAffiliation(relationship, asOf, hub) {
  const observation = relationship.roleObservation;
  if (observation) {
    if (observation.observedAsOf > asOf) {
      const endedByCutoff = observation.endYear !== null && observation.endYear < Number(asOf.slice(0, 4));
      return {
        affiliation: endedByCutoff ? "former" : "unknown",
        sourceRole: observation.role,
        note: `The role was observed ${observation.observedAsOf}, after this view (${asOf}). Only recorded event dates apply to this historical view; present status is not inferred.`
      };
    }
    const ended = observation.endYear !== null && observation.endYear < Number(observation.observedAsOf.slice(0, 4));
    const timing = ended || observation.timing === "former" ? "former" : observation.timing === "source_reported_current" ? "current" : "unknown";
    return {
      affiliation: timing,
      sourceRole: observation.role,
      note: `${observation.statement} Source observation as of ${observation.observedAsOf}; this is not an independent live employment check${observation.observedAsOf > asOf ? ` and is separately dated from the core graph (${asOf})` : ""}.`
    };
  }
  const note = relationship.note ?? "";
  const sourceRole = note.match(/Official roster role label:\s*(.*?)\. Source temporal label:/i)?.[1] ?? null;
  const temporalLabel = note.match(/Source temporal label:\s*([a-z_]+)/i)?.[1] ?? null;
  const end = relationship.temporal.endDate ?? relationship.temporal.endMonth;
  const asOfYear = Number(asOf.slice(0, 4));
  const endIsPast = end ? end < asOf.slice(0, end.length) : relationship.temporal.endYear !== null && relationship.temporal.endYear < asOfYear;
  if (endIsPast || temporalLabel === "former" || /^Former:/i.test(sourceRole ?? "")) {
    return { affiliation: "former", sourceRole, note: "A sourced end date or roster label identifies a former affiliation." };
  }
  if (hub?.lifecycleStatus === "historical" && temporalLabel?.startsWith("publisher_labeled_current")) {
    return { affiliation: "unknown", sourceRole, note: "This hub is marked historical. Its roster's current label describes the source page; a present affiliation or departure date is not established." };
  }
  if (temporalLabel?.includes("stale")) {
    return { affiliation: "unknown", sourceRole, note: "The roster says current, but the source is marked stale; current affiliation is unconfirmed." };
  }
  if (temporalLabel === "publisher_labeled_current") {
    return { affiliation: "current", sourceRole, note: "The source lists this affiliation as current. This is a roster observation, not a dated career transition." };
  }
  return { affiliation: "unknown", sourceRole, note: "The sourced connection does not establish whether this affiliation is current. An open end date is not current-role evidence." };
}
function graphFitLabel(priority) {
  if (priority === "Investigate now") return "Strong graph fit";
  if (priority === "Watch") return "Moderate graph fit";
  if (priority === "Low priority") return "Limited graph fit";
  return priority;
}
function isNearbyStartupPath(graph, path) {
  if (path.entity.kind !== "company") return false;
  const terminalRelationship = path.relationships[path.relationships.length - 1];
  if (!terminalRelationship) return false;
  const endpoint = STARTUP_TERMINAL_DIRECTIONS[terminalRelationship.predicate];
  return Boolean(endpoint) && pathEndsAtRelationshipEndpoint(path, terminalRelationship, endpoint) && hasVerifiedPublicSupport(graph, path);
}
function isCurrentNetworkEmployerPath(graph, path) {
  if (path.entity.kind !== "company") return false;
  const terminalRelationship = path.relationships[path.relationships.length - 1];
  if (!terminalRelationship || !GRAPH_EMPLOYMENT_PREDICATES.has(terminalRelationship.predicate)) return false;
  const asOfYear = Number(graph.metadata.asOf.slice(0, 4)) || (/* @__PURE__ */ new Date()).getUTCFullYear();
  const startedBySnapshot = terminalRelationship.temporal.startYear === null || terminalRelationship.temporal.startYear <= asOfYear;
  const notKnownToHaveEnded = describeSourceAffiliation(terminalRelationship, graph.metadata.asOf).affiliation !== "former";
  return startedBySnapshot && notKnownToHaveEnded && pathEndsAtRelationshipEndpoint(path, terminalRelationship, "object") && hasVerifiedPublicSupport(graph, path);
}
function classifyShortestCompanyPaths(graph, root, layers, companyPaths) {
  if (!companyPaths.length) return { nearbyStartups: [], currentNetworkEmployers: [], explicitCompanyPaths: [] };
  const supportingEvidenceIds = verifiedPublicSupportingEvidenceIds(graph);
  const supportedRelationships = publishedRelationships(graph, layers).filter((relationship) => relationshipHasVerifiedPublicSupport(relationship, supportingEvidenceIds));
  const supportedGraph = { ...graph, relationships: supportedRelationships };
  const maxPrefixHops = Math.max(0, Math.max(...companyPaths.map((path) => path.hopCount)) - 1);
  const prefixPaths = buildGraphNeighborhood(supportedGraph, root.id, layers, maxPrefixHops);
  const prefixByEntityId = new Map([
    [root.id, toPath(root, [root], [])],
    ...prefixPaths.map((path) => [path.entity.id, path])
  ]);
  const adjacency = buildAdjacency(supportedRelationships);
  const select = (basePath, qualifies) => {
    for (const terminal of adjacency.get(basePath.entity.id) ?? []) {
      const prefix = prefixByEntityId.get(terminal.nextId);
      if (!prefix || prefix.nodes.some((node) => node.id === basePath.entity.id)) continue;
      const candidate = toPath(
        basePath.entity,
        [...prefix.nodes, basePath.entity],
        [...prefix.relationships, terminal.relationship]
      );
      if (candidate.hopCount === basePath.hopCount && qualifies(candidate)) return candidate;
    }
    return null;
  };
  const explicitCompanyPaths = companyPaths.flatMap((path) => [
    ["implements", "uses", "depends_on", "trained_on", "based_on"],
    ["integrates_with", "collaborates_with"],
    ["invested_in"]
  ].map((predicates) => select(path, (candidate) => predicates.includes(candidate.relationships.at(-1).predicate))).filter((candidate) => candidate !== null));
  return {
    explicitCompanyPaths,
    nearbyStartups: companyPaths.map((path) => select(path, (candidate) => isNearbyStartupPath(graph, candidate))).filter((path) => path !== null),
    currentNetworkEmployers: companyPaths.map((path) => select(path, (candidate) => isCurrentNetworkEmployerPath(graph, candidate))).filter((path) => path !== null)
  };
}
function graphFinancingFactStatus(graph, fact) {
  if (!/funding|financing|valuation/.test(fact.factType)) return null;
  const sources = graph.evidence.filter((source) => fact.evidenceIds.includes(source.id));
  const status = financingStatusFromEvidence({ status: fact.financingStatus, title: sources.map((source) => source.locator ?? "").join(" "), description: `${fact.metric} ${fact.periodLabel ?? ""}`, sourceUrl: sources.map((source) => source.url).join(" ") });
  if (status === "unknown") return null;
  const attribution = fact.conclusionLabel === "Company-reported claim" ? "Company-reported claim" : "Source-backed report";
  return { status, label: `${financingStatusLabel(status)} financing${status !== "closed" ? " \xB7 not confirmed closed" : ""}`, trustLabel: `${attribution} \xB7 ${financingStatusLabel(status).toLowerCase()} financing` };
}
function isCorporateGraphHub(entity) {
  return entity?.kind === "company" || Boolean(entity && ["lab", "organization"].includes(entity.kind) && /^corporate (?:research lab(?:\s*\/\s*program)?|(?:research )?program)$/i.test(entity.subtype?.trim() ?? ""));
}
function buildGraphCareerHistory(input, personId) {
  const graph = canonicalizeGraphIdentities(input);
  const person = resolveGraphEntity(graph, personId);
  if (person?.kind !== "person") return [];
  const support = verifiedPublicSupportingEvidenceIds(graph);
  return graph.relationships.flatMap((relationship) => {
    if (relationship.status !== "published" || relationship.subjectId !== person.id || !GRAPH_EMPLOYMENT_PREDICATES.has(relationship.predicate) || !relationshipHasVerifiedPublicSupport(relationship, support)) return [];
    const employer = resolveGraphEntity(graph, relationship.objectId);
    if (!employer || !isCorporateGraphHub(employer)) return [];
    const observation = describeSourceAffiliation(relationship, graph.metadata.asOf);
    return [{
      employer,
      relationship,
      role: observation.sourceRole ?? (relationship.originalLabel && relationship.originalLabel !== relationship.predicate ? relationship.originalLabel : relationship.predicate === "employed_by" ? "Employment" : graphPredicateLabel(relationship.predicate)),
      timing: observation.affiliation,
      timingNote: observation.note
    }];
  }).sort((a, b) => (b.relationship.temporal.startYear ?? -1) - (a.relationship.temporal.startYear ?? -1) || graphEntityLabel(a.employer).localeCompare(graphEntityLabel(b.employer)) || a.relationship.id.localeCompare(b.relationship.id));
}
function corporateFounderTiming(employment, founding) {
  const bounds = (row, endpoint) => {
    if (row.temporal.precision === "approximate" || row.temporal.precision === "undated") return null;
    const value = endpoint === "start" ? row.temporal.startDate ?? row.temporal.startMonth ?? row.temporal.startYear : row.temporal.endDate ?? row.temporal.endMonth ?? row.temporal.endYear;
    if (value === null || value === void 0) return null;
    const text = String(value);
    return text.length === 4 ? [text + "-01-01", text + "-12-31"] : text.length === 7 ? [text + "-01", text + "-31"] : [text, text];
  };
  const end = bounds(employment, "end");
  const start = bounds(founding, "start");
  if (end && start && end[1] < start[0]) return { timing: "prior_employment", timingNote: "A sourced employment end precedes the sourced founding date. This establishes prior employment; it does not establish that the employer caused the company formation." };
  if (end && start && end[0] > start[1]) return { timing: "overlapping", timingNote: "The sourced employment end follows company formation. This is an employment and founding connection; a prior departure is not established." };
  if (GRAPH_EMPLOYMENT_PREDICATES.has(employment.predicate) && founding.predicate === "founded" && employment.subjectId === founding.subjectId && employment.roleObservation?.beforeFoundingCompanyIds?.includes(founding.objectId)) {
    return { timing: "prior_employment", timingNote: "Source explicitly places employment before founding; exact dates unknown. This ordering applies to this company only and does not establish a departure date." };
  }
  return { timing: "unknown", timingNote: "Both employment and founding are sourced, but their dates do not establish a departure before formation. Alumni chronology remains unknown." };
}
function buildCorporateFounderPaths(input, hubId) {
  const graph = canonicalizeGraphIdentities(input);
  const support = verifiedPublicSupportingEvidenceIds(graph);
  const entities = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const supported = graph.relationships.filter((row) => row.status === "published" && relationshipHasVerifiedPublicSupport(row, support));
  const founders = /* @__PURE__ */ new Map();
  const parents = /* @__PURE__ */ new Map();
  for (const row of supported) {
    if (row.predicate === "founded" && entities.get(row.subjectId)?.kind === "person" && entities.get(row.objectId)?.kind === "company") {
      founders.set(row.subjectId, [...founders.get(row.subjectId) ?? [], row]);
    }
    if (row.predicate === "part_of") parents.set(row.subjectId, [...parents.get(row.subjectId) ?? [], row]);
  }
  const root = hubId ? resolveGraphEntity(graph, hubId) : null;
  if (hubId && !isCorporateGraphHub(root)) return [];
  const result = [];
  for (const employment of supported) {
    if (!GRAPH_EMPLOYMENT_PREDICATES.has(employment.predicate)) continue;
    const person = entities.get(employment.subjectId);
    const employer = entities.get(employment.objectId);
    if (person?.kind !== "person" || !employer || !ORGANIZATION_KINDS.has(employer.kind)) continue;
    const hubs = [{ hub: employer, nodes: [employer], relationships: [] }];
    for (let index = 0; index < hubs.length; index += 1) {
      const entry = hubs[index];
      if (entry.relationships.length >= 2) continue;
      for (const parent of parents.get(entry.hub.id) ?? []) {
        const parentEntity = entities.get(parent.objectId);
        if (parentEntity && ORGANIZATION_KINDS.has(parentEntity.kind) && !entry.nodes.some((node) => node.id === parentEntity.id)) {
          hubs.push({ hub: parentEntity, nodes: [parentEntity, ...entry.nodes], relationships: [parent, ...entry.relationships] });
        }
      }
    }
    for (const entry of hubs) {
      if (!isCorporateGraphHub(entry.hub) || root && entry.hub.id !== root.id) continue;
      for (const founding of founders.get(person.id) ?? []) {
        const company = entities.get(founding.objectId);
        if (company.id === entry.hub.id || entry.nodes.some((node) => node.id === company.id)) continue;
        if (employment.temporal.startYear !== null && founding.temporal.startYear !== null && employment.temporal.startYear > founding.temporal.startYear) continue;
        result.push({
          hub: entry.hub,
          person,
          company,
          path: toPath(company, [...entry.nodes, person, company], [...entry.relationships, employment, founding]),
          ...corporateFounderTiming(employment, founding)
        });
      }
    }
  }
  const unique2 = /* @__PURE__ */ new Map();
  for (const item of result.sort((a, b) => a.path.hopCount - b.path.hopCount || a.path.relationships.map((row) => row.id).join().localeCompare(b.path.relationships.map((row) => row.id).join()))) {
    const key = `${item.hub.id}:${item.person.id}:${item.company.id}:${item.timing}`;
    if (!unique2.has(key)) unique2.set(key, item);
  }
  return [...unique2.values()].sort((a, b) => graphEntityLabel(a.hub).localeCompare(graphEntityLabel(b.hub)) || graphEntityLabel(a.person).localeCompare(graphEntityLabel(b.person)) || graphEntityLabel(a.company).localeCompare(graphEntityLabel(b.company)));
}
function buildInvestigationDossier(graph, entityId, layers = new Set(GRAPH_LAYERS), options = {}) {
  graph = options.asOf ? graphSnapshotAsOf(graph, options.asOf) : canonicalizeGraphIdentities(graph);
  const maxHops = Math.max(1, Math.min(3, Math.floor(options.maxHops ?? 2)));
  const entity = resolveGraphEntity(graph, entityId);
  if (!entity) return null;
  const neighborhood = buildGraphNeighborhood(graph, entity.id, layers, maxHops);
  const supportingEvidenceIds = verifiedPublicSupportingEvidenceIds(graph);
  const origin = buildFilteredGraphNeighborhood(graph, entity.id, layers, maxHops, (from, to, relationship) => relationshipHasVerifiedPublicSupport(relationship, supportingEvidenceIds) && isUpstreamStep(from, to, relationship));
  const corporateEmploymentPeople = isCorporateGraphHub(entity) ? buildFilteredGraphNeighborhood(graph, entity.id, layers, maxHops, (from, to, relationship) => {
    if (from.kind === "person" || !relationshipHasVerifiedPublicSupport(relationship, supportingEvidenceIds)) return false;
    return to.kind === "person" ? GRAPH_EMPLOYMENT_PREDICATES.has(relationship.predicate) && relationship.subjectId === to.id && relationship.objectId === from.id : ORGANIZATION_KINDS.has(to.kind) && relationship.predicate === "part_of" && relationship.subjectId === to.id && relationship.objectId === from.id;
  }).filter((path) => path.entity.kind === "person") : [];
  const semanticResearchPredicates = SEMANTIC_RESEARCH_PREDICATES;
  const researchPaths = neighborhood.filter((path) => RESEARCH_KINDS.has(path.entity.kind));
  const researchDna = buildFilteredGraphNeighborhood(graph, entity.id, layers, maxHops, (from, _to, row) => relationshipHasVerifiedPublicSupport(row, supportingEvidenceIds) && (semanticResearchPredicates.has(row.predicate) || entity.kind === "person" && from.id === entity.id && row.subjectId === entity.id && row.predicate === "authored")).filter((path) => RESEARCH_KINDS.has(path.entity.kind));
  const semanticIds = new Set(researchDna.map((path) => path.entity.id));
  const otherWorkByAuthors = researchPaths.filter((path) => !semanticIds.has(path.entity.id) && hasVerifiedPublicSupport(graph, path) && path.relationships.some((row) => row.predicate === "authored"));
  const directSemanticResearchCount = graph.relationships.filter((row) => layers.has(row.layer) && semanticResearchPredicates.has(row.predicate) && relationshipHasVerifiedPublicSupport(row, supportingEvidenceIds) && (row.subjectId === entity.id && RESEARCH_KINDS.has(resolveGraphEntity(graph, row.objectId)?.kind ?? "company") || row.objectId === entity.id && RESEARCH_KINDS.has(resolveGraphEntity(graph, row.subjectId)?.kind ?? "company"))).length;
  const companyPaths = neighborhood.filter((path) => path.entity.kind === "company" && path.entity.id !== entity.id);
  const { nearbyStartups, currentNetworkEmployers, explicitCompanyPaths } = classifyShortestCompanyPaths(
    graph,
    entity,
    layers,
    companyPaths
  );
  const asOfYear = Number(graph.metadata.asOf.slice(0, 4)) || (/* @__PURE__ */ new Date()).getUTCFullYear();
  const recentSince = asOfYear - 2;
  const emergingResearchers = neighborhood.filter((path) => isEmergingResearcher(path, recentSince));
  const evidenceIdSet = new Set(graph.evidence.map((item) => item.id));
  const facts = (graph.facts ?? []).filter((fact) => fact.entityId === entity.id && ["Verified fact", "Company-reported claim"].includes(fact.conclusionLabel) && (fact.status === void 0 || fact.status === "published") && (fact.publicationState === void 0 || fact.publicationState === "published") && fact.evidenceIds.some((evidenceId) => evidenceIdSet.has(evidenceId))).sort((left, right) => left.metric.localeCompare(right.metric) || left.id.localeCompare(right.id)).map((fact) => {
    const observation = graphFinancingFactStatus(graph, fact);
    return observation ? { ...fact, financingObservation: observation } : fact;
  });
  const sourceCoverage = evidenceCoverageFor(graph, neighborhood);
  const evidenceCoverage = sourceCoverage.percent;
  const mentions = (graph.authorMentions ?? []).filter((mention) => mention.paperId === entity.id);
  const byline = mentions.length ? mentions : graph.relationships.filter((row) => row.objectId === entity.id && row.predicate === "authored").map((row) => ({ resolution: "resolved", resolvedEntityId: row.subjectId }));
  const resolvedAuthors = byline.filter((row) => row.resolution === "resolved" && graph.entities.some((person) => person.id === row.resolvedEntityId && person.kind === "person")).length;
  const authorResolution = entity.kind === "paper" ? { total: byline.length, resolved: resolvedAuthors, unresolved: byline.length - resolvedAuthors } : null;
  const reviewedBylineSources = entity.kind === "paper" ? PAPER_BYLINE_SOURCES.filter((candidate) => graph.relationships.some((relationship) => relationship.objectId === entity.id && relationship.predicate === "authored" && relationship.status === "published" && !relationship.derived && relationship.evidenceIds.some((evidenceId) => graph.evidence.some((evidence) => evidence.id === evidenceId && (evidence.stance === "supports" || evidence.stance === "qualifies") && evidence.url.replace(/\/$/, "") === candidate.sourceUrl.replace(/\/$/, ""))))) : [];
  const bylineCoverage = entity.kind === "paper" ? paperBylineCoverage(entity.id, byline.length, resolvedAuthors, reviewedBylineSources) : null;
  const companyConnections = [...new Map([...companyPaths, ...nearbyStartups, ...currentNetworkEmployers, ...explicitCompanyPaths, ...neighborhood.filter((path) => path.entity.kind === "vc_firm" && path.relationships.some((row) => row.predicate === "invested_in"))].map((path) => [path.relationships.map((row) => row.id).join("/"), path])).values()].filter((path) => hasVerifiedPublicSupport(graph, path)).map((path) => {
    const predicates = path.relationships.map((row) => row.predicate);
    const category = isNearbyStartupPath(graph, path) ? "startup_lineage" : predicates.some((predicate) => ["implements", "uses", "depends_on", "trained_on", "based_on"].includes(predicate)) ? "implementation" : predicates.some((predicate) => ["integrates_with", "collaborates_with"].includes(predicate)) ? "integration" : predicates.some((predicate) => GRAPH_EMPLOYMENT_PREDICATES.has(predicate)) ? "employment" : predicates.includes("invested_in") ? "investment" : "other";
    return { category, path };
  });
  const collectionMatches = graph.collections.filter((collection) => collection.entityIds.includes(entity.id));
  const themeCollections = collectionMatches.filter((collection) => PHYSICAL_AI_TERMS.test(`${collection.title} ${collection.summary}`));
  const recentResearch = neighborhood.filter((path) => path.relationships.some((relationship) => relationship.layer === "research" && relationship.temporal.startYear !== null && relationship.temporal.startYear >= recentSince));
  const labReach = neighborhood.filter((path) => path.entity.kind === "lab");
  const companyReach = neighborhood.filter((path) => path.entity.kind === "company");
  const peopleReach = neighborhood.filter((path) => path.entity.kind === "person");
  const commercialDistance = entity.kind === "company" ? 0 : nearbyStartups[0]?.hopCount ?? Number.POSITIVE_INFINITY;
  const evidenceIds = Array.from(/* @__PURE__ */ new Set([
    ...neighborhood.flatMap((path) => path.evidenceIds),
    ...corporateEmploymentPeople.flatMap((path) => path.evidenceIds),
    ...facts.flatMap((fact) => fact.evidenceIds)
  ]));
  const evidenceFreshness = evidenceFreshnessFor(graph, evidenceIds);
  const evidenceQuality = Math.min(evidenceCoverage, evidenceFreshness);
  const axes = [
    axis(
      "theme_fit",
      "Physical-AI & theme fit",
      band(themeCollections.length, 1, 2),
      themeCollections.length ? `${themeCollections.length} declared collection${themeCollections.length === 1 ? "" : "s"} connect this entity to the tracked thesis.` : "No declared collection currently establishes a Physical-AI theme fit.",
      themeCollections.map((collection) => collection.id)
    ),
    axis(
      "research_momentum",
      "Research momentum",
      band(recentResearch.length, 1, 3),
      `${recentResearch.length} nearby node${recentResearch.length === 1 ? "" : "s"} carry a sourced research transition in the trailing 24-month window.`,
      pathInputIds(recentResearch)
    ),
    axis(
      "commercialization",
      "Commercialization proximity",
      commercialDistance <= 1 ? "high" : commercialDistance === 2 ? "medium" : "low",
      entity.kind === "company" ? "The selected entity is a company." : Number.isFinite(commercialDistance) ? `The nearest company with a qualifying startup-lineage or commercialization connection is ${commercialDistance} sourced step${commercialDistance === 1 ? "" : "s"} away.` : companyReach.length ? `${companyReach.length} company connection${companyReach.length === 1 ? " is" : "s are"} visible within ${maxHops} steps, but no qualifying founding, spinout, launch, commercialization, or release path is mapped.` : `No source-backed company connection is visible within ${maxHops} steps in this view.`,
      pathInputIds(nearbyStartups.slice(0, 3))
    ),
    axis(
      "bridge_reach",
      "Lab/company bridge reach",
      labReach.length > 0 && companyReach.length > 0 ? "high" : labReach.length + companyReach.length > 0 ? "medium" : "low",
      `${labReach.length} lab or research-organization node${labReach.length === 1 ? "" : "s"} and ${companyReach.length} company node${companyReach.length === 1 ? "" : "s"} are visible within ${maxHops} steps.`,
      pathInputIds([...labReach, ...companyReach])
    ),
    axis(
      "talent_concentration",
      "Relevant talent concentration",
      band(peopleReach.length, 2, 4),
      `${peopleReach.length} named person${peopleReach.length === 1 ? " is" : "s are"} reachable within ${maxHops} sourced steps.`,
      pathInputIds(peopleReach)
    ),
    axis(
      "evidence_quality",
      "Relationship source coverage & source recency",
      evidenceQuality >= 85 ? "high" : evidenceQuality >= 70 ? "medium" : "low",
      neighborhood.length === 0 && facts.length ? `${facts.length} sourced fact${facts.length === 1 ? " has" : "s have"} linked evidence; relationship coverage cannot be calculated until lineage is mapped.` : `${evidenceCoverage}% of visible relationships have linked evidence and are not derived; ${evidenceFreshness}% of those sources were checked within 24 months of their graph or editorial release. Source recency does not establish current performance or employment.`,
      evidenceIds
    )
  ];
  const highAxes = axes.filter((item) => item.band === "high");
  const themeAxis = axes.find((item) => item.id === "theme_fit");
  const evidenceAxis = axes.find((item) => item.id === "evidence_quality");
  const priority = evidenceCoverage < 70 ? "Coverage gap \u2014 unranked" : themeAxis.band === "high" && evidenceAxis.band === "high" && highAxes.filter((item) => item.id !== "theme_fit" && item.id !== "evidence_quality").length >= 2 ? "Investigate now" : themeAxis.band !== "low" ? "Watch" : "Low priority";
  const declaredBylineIds = graph.metadata.discoveryEvidence?.pack?.papers?.find((paper) => paper.entityId === entity.id)?.authors.map((author) => author.entityId ?? "") ?? [];
  const overlayGapKeys = [entity.id, graphEntityLabel(entity), ...declaredBylineIds, ...mentions.flatMap((mention) => [mention.displayName, mention.resolvedEntityId ?? ""])].filter(Boolean);
  const overlayGaps = (graph.metadata.discoveryEvidence?.gaps ?? []).filter((gap) => overlayGapKeys.some((key) => gap.toLocaleLowerCase().includes(key.toLocaleLowerCase())));
  const gaps = [
    ...overlayGaps,
    neighborhood.length === 0 ? facts.length ? `Graph lineage is not yet mapped; ${facts.length} sourced fact${facts.length === 1 ? " is" : "s are"} available.` : "No published relationships or sourced facts are visible for this entity." : null,
    origin.length === 0 ? "No sourced institutional or founder origin is visible." : null,
    researchDna.length === 0 ? "No explicit semantic research or direct personal authorship path is mapped; shared authorship does not establish influence." : null,
    authorResolution?.unresolved ? `${authorResolution.unresolved} of ${authorResolution.total} published author identities remain unresolved in the loaded graph.` : null,
    bylineCoverage?.status === "partial" ? `${bylineCoverage.unknownSourceCount} published source author${bylineCoverage.unknownSourceCount === 1 ? " is" : "s are"} not yet included in this graph.` : null,
    bylineCoverage?.status === "inconsistent" ? "Included author entries exceed the recorded source byline count; the source count requires review." : null,
    nearbyStartups.length === 0 && entity.kind !== "company" ? `No company is connected by a sourced founding, spinout, launch, commercialization, or release path within ${maxHops} steps.` : null,
    emergingResearchers.length === 0 ? "No researcher meets the sourced career-stage and recent-work rule." : null,
    evidenceCoverage < 70 ? neighborhood.length === 0 && facts.length ? "Lineage evidence coverage is unavailable until at least one sourced relationship is mapped." : `Visible relationship source coverage is ${evidenceCoverage}%; graph fit requires at least 70%.` : null
  ].filter((gap) => gap !== null);
  return {
    entity,
    neighborhood,
    origin,
    researchDna,
    otherWorkByAuthors,
    directSemanticResearchCount,
    sourceCoverage,
    authorResolution,
    bylineCoverage,
    companyConnections,
    nearbyStartups,
    currentNetworkEmployers,
    corporateEmploymentPeople,
    emergingResearchers,
    facts,
    axes,
    evidenceCoverage,
    evidenceFreshness,
    priority,
    gaps,
    evidenceIds,
    asOf: graph.metadata.asOf,
    maxHops,
    careerHistory: buildGraphCareerHistory(graph, entity.id),
    corporateFounderPaths: isCorporateGraphHub(entity) ? buildCorporateFounderPaths(graph, entity.id).filter((row) => row.path.hopCount <= maxHops) : [],
    signalModelVersion: "1.0.0"
  };
}
function markdownPath(path) {
  const steps = path.relationships.map((relationship, index) => {
    const label = graphRelationshipStepLabel(relationship, path.nodes[index].id);
    if (relationship.predicate === "coauthored_with") {
      return `${graphEntityLabel(path.nodes[index])} \u2014${label}\u2014 ${graphEntityLabel(path.nodes[index + 1])}`;
    }
    return relationship.subjectId === path.nodes[index].id ? `${graphEntityLabel(path.nodes[index])} \u2014${label}\u2192 ${graphEntityLabel(path.nodes[index + 1])}` : `${graphEntityLabel(path.nodes[index])} \u2014${label}\u2192 ${graphEntityLabel(path.nodes[index + 1])}`;
  });
  return steps.join(" | ");
}
function serializeInvestigationMarkdown(dossier, comparison, hubPeople) {
  const showsInvestmentPriority = !["paper", "idea", "model"].some((kind) => dossier.entity.kind === kind);
  const section = (title, paths) => [
    `## ${title}`,
    "",
    ...paths.length ? paths.map((path) => `- ${graphEntityLabel(path.entity)} (${path.hopCount} hop${path.hopCount === 1 ? "" : "s"}): ${markdownPath(path)}`) : ["- No qualifying sourced path in the current layer view."],
    ""
  ];
  const publicSections = [
    `# ${graphEntityLabel(dossier.entity)} \u2014 Investigation dossier`,
    "",
    `Entity key: ${dossier.entity.id}`,
    `As of: ${dossier.asOf}`,
    `Neighborhood scope: ${dossier.maxHops ?? 2} steps`,
    `Visible relationship source coverage: ${dossier.sourceCoverage.percent}% (${dossier.sourceCoverage.supported}/${dossier.sourceCoverage.total} mapped relationships)`,
    `Direct semantic research links: ${dossier.directSemanticResearchCount}`,
    ...dossier.authorResolution ? [`Included author identities resolved: ${dossier.authorResolution.resolved}/${dossier.authorResolution.total}`] : [],
    ...dossier.bylineCoverage ? [
      dossier.bylineCoverage.status === "complete" ? `Source byline coverage: complete (${dossier.bylineCoverage.includedAuthors}/${dossier.bylineCoverage.sourceAuthorCount} included)` : dossier.bylineCoverage.status === "partial" ? `Source byline coverage: partial (${dossier.bylineCoverage.includedAuthors}/${dossier.bylineCoverage.sourceAuthorCount} included; ${dossier.bylineCoverage.unknownSourceCount} not yet included)` : dossier.bylineCoverage.status === "unknown" ? `Source byline coverage: unknown (${dossier.bylineCoverage.includedAuthors} author entries included)` : `Source byline coverage: inconsistent with recorded source count (${dossier.bylineCoverage.includedAuthors} included; source says ${dossier.bylineCoverage.sourceAuthorCount})`
    ] : [],
    `Source checks within 24 months: ${dossier.evidenceFreshness}%`,
    `Signal model: ${dossier.signalModelVersion}`,
    "",
    ...hubPeople ? [
      "## People connected to this center",
      "",
      ...hubPeople.map((person) => `- ${graphEntityLabel(person.path.entity)} (${person.path.entity.id}): ${person.affiliation === "current" ? "Source lists current" : person.affiliation === "former" ? "Former affiliation" : "Affiliation status unknown"}. ${person.affiliationNote}${person.sourceRole ? ` Source role label: ${person.sourceRole}.` : ""} Path: ${markdownPath(person.path)}. Evidence: ${person.path.evidenceIds.join(", ")}.`),
      ...hubPeople.length ? [] : ["- No source-supported person path is available in this two-step summary."],
      ""
    ] : [],
    ...section("Origins & affiliations (current, historical, or undated; not a time sequence)", dossier.origin),
    ...section("Research DNA", dossier.researchDna),
    ...dossier.careerHistory?.length ? [
      "## Documented corporate career history",
      "",
      ...dossier.careerHistory.map((row) => `- ${graphEntityLabel(row.employer)}: ${row.role}; ${row.relationship.temporal.startDate ?? row.relationship.temporal.startMonth ?? row.relationship.temporal.startYear ?? "start unknown"} to ${row.relationship.temporal.endDate ?? row.relationship.temporal.endMonth ?? row.relationship.temporal.endYear ?? "end unknown"}. ${row.timingNote} Evidence: ${row.relationship.evidenceIds.join(", ")}.`),
      ""
    ] : [],
    ...dossier.corporateFounderPaths?.length ? [
      "## Corporate employment to founder paths",
      "",
      ...dossier.corporateFounderPaths.map((row) => `- ${row.timing === "prior_employment" ? "Documented prior employment" : row.timing === "overlapping" ? "Employment overlaps formation" : "Timing unknown"}: ${markdownPath(row.path)}. ${row.timingNote} Evidence: ${row.path.evidenceIds.join(", ")}.`),
      ""
    ] : [],
    ...section("Other work by authors (up to 20; co-publication does not establish influence)", dossier.otherWorkByAuthors.slice(0, 20)),
    ...section("Implementation and usage company connections", dossier.companyConnections.filter((row) => row.category === "implementation").map((row) => row.path)),
    ...dossier.facts.length ? [
      "## Known facts",
      "",
      ...dossier.facts.map((fact) => `- ${fact.factType.replaceAll("_", " ")}: ${fact.displayValue ?? fact.disclosureStatus}.${fact.financingObservation ? ` ${fact.financingObservation.label}; ${fact.financingObservation.trustLabel}.` : ""} Evidence: ${fact.evidenceIds.join(", ")}.`),
      ""
    ] : []
  ];
  const researchSections = [
    showsInvestmentPriority && dossier.neighborhood.length === 0 ? `Decision band: Not yet mapped \u2014 ${dossier.facts.length} sourced fact${dossier.facts.length === 1 ? "" : "s"}; no lineage path.` : showsInvestmentPriority ? `Graph discovery fit: ${graphFitLabel(dossier.priority)}. Fit to mapped themes and relationships; separate from reviewed outreach priority.` : `Visible relationship source coverage: ${dossier.evidenceCoverage}%; source checks within 24 months: ${dossier.evidenceFreshness}%. This does not measure scientific completeness or influence.`,
    "",
    ...section("Nearby startups", dossier.nearbyStartups),
    ...section("Employment connections", isCorporateGraphHub(dossier.entity) ? dossier.corporateEmploymentPeople ?? [] : dossier.currentNetworkEmployers),
    ...section("Emerging researchers", dossier.emergingResearchers),
    "## Why investigate",
    "",
    ...dossier.axes.map((item) => `- ${item.label}: ${item.band.toUpperCase()} \u2014 ${item.explanation} Inputs: ${item.inputIds.join(", ") || "none"}.`),
    "",
    "## Coverage gaps",
    "",
    ...dossier.gaps.length ? dossier.gaps.map((gap) => `- ${gap}`) : ["- No threshold-level coverage gaps in this view."],
    ...comparison ? [
      "",
      `## Comparison: ${graphEntityLabel(comparison.right)}`,
      "",
      comparison.path ? `- Shortest graph path${comparison.path.containsDerivedRelationship ? " (includes derived signal)" : " (sourced facts)"}: ${markdownPath(comparison.path)}` : "- No graph path found within six steps.",
      `- Shared two-hop context: ${comparison.shared.map(graphEntityLabel).join(", ") || "none"}.`
    ] : []
  ];
  return [
    ...publicSections,
    ...researchSections,
    "",
    showsInvestmentPriority ? "Labels distinguish verified facts, company-reported claims and derived signals; prioritization and proximity are derived signals, not predictions." : "Labels distinguish verified facts, company-reported claims and derived signals; research-artifact proximity is a derived signal, not an investment-priority judgment."
  ].join("\n");
}

// src/lib/atlasRemediation.ts
var atlasRemediation = atlasRemediation_default;
var cache = /* @__PURE__ */ new WeakMap();
var unique = (values) => [...new Set(values)];
function applyAtlasRemediation(graph) {
  const cached = cache.get(graph);
  if (cached) return cached;
  if (graph.metadata.atlasRemediationVersion === atlasRemediation.version) return graph;
  const entities = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const evidence = new Map(graph.evidence.map((item) => [item.id, item]));
  for (const item of atlasRemediation.evidence) {
    const existing = evidence.get(item.id);
    if (existing && existing.url !== item.url) throw new Error(`Atlas remediation evidence collision: ${item.id}`);
    evidence.set(item.id, item);
  }
  for (const incoming of atlasRemediation.entities) {
    const existing = entities.get(incoming.id);
    if (existing && (existing.kind !== incoming.kind || existing.canonicalName !== incoming.canonicalName)) {
      throw new Error(`Atlas remediation entity collision: ${incoming.id}`);
    }
    entities.set(incoming.id, existing ? { ...existing, aliases: unique([...existing.aliases, ...incoming.aliases]), externalIds: { ...existing.externalIds, ...incoming.externalIds } } : incoming);
  }
  for (const update of atlasRemediation.entityUpdates) {
    const existing = entities.get(update.id);
    if (!existing || existing.canonicalName !== update.canonicalName) continue;
    entities.set(update.id, { ...existing, aliases: unique([...existing.aliases, ...update.aliases]), externalIds: { ...existing.externalIds, ...update.externalIds } });
  }
  const relationships = new Map(graph.relationships.map((row) => [row.id, row]));
  const appliedRelationshipIds = [];
  for (const incoming of atlasRemediation.relationships) {
    if (!entities.has(incoming.subjectId) || !entities.has(incoming.objectId)) continue;
    if (incoming.evidenceIds.some((id) => !evidence.has(id))) throw new Error(`Atlas remediation relationship lacks evidence: ${incoming.id}`);
    const prior = relationships.get(incoming.id);
    if (prior && (prior.subjectId !== incoming.subjectId || prior.objectId !== incoming.objectId || prior.predicate !== incoming.predicate)) throw new Error(`Atlas remediation relationship collision: ${incoming.id}`);
    const corroborated = incoming.predicate === "founded" ? [...relationships.values()].find((row) => row.predicate === incoming.predicate && row.subjectId === incoming.subjectId && row.objectId === incoming.objectId && row.status === "published" && !row.derived) : void 0;
    if (corroborated) {
      relationships.set(corroborated.id, { ...corroborated, evidenceIds: unique([...corroborated.evidenceIds, ...incoming.evidenceIds]), note: [corroborated.note, incoming.note].filter(Boolean).join(" ") });
      appliedRelationshipIds.push(corroborated.id);
    } else {
      relationships.set(incoming.id, incoming);
      appliedRelationshipIds.push(incoming.id);
    }
  }
  const redirects = [...graph.redirects ?? []];
  const appliedRedirects = [];
  for (const review of atlasRemediation.redirects) {
    const target = entities.get(review.toId);
    const original = entities.get(review.fromId);
    if (!target || target.kind !== "person" || target.canonicalName !== review.canonicalName) continue;
    if (original && (original.kind !== "person" || original.canonicalName !== review.canonicalName)) continue;
    const existing = redirects.find((row) => row.fromId === review.fromId);
    if (existing && existing.toId !== review.toId) throw new Error(`Atlas remediation redirect conflicts with published adjudication: ${review.fromId}`);
    if (!existing) redirects.push({ fromId: review.fromId, toId: review.toId });
    if (review.fromTypedId && !redirects.some((row) => row.fromId === review.fromTypedId)) redirects.push({ fromId: review.fromTypedId, toId: review.toId });
    appliedRedirects.push(review);
  }
  const facts = new Map((graph.facts ?? []).map((fact) => [fact.id, fact]));
  for (const fact of atlasRemediation.facts) if (entities.has(fact.entityId)) facts.set(fact.id, fact);
  const authorMentions = new Map((graph.authorMentions ?? []).map((mention) => [mention.id, mention]));
  for (const mention of atlasRemediation.authorMentions) {
    if (!entities.has(mention.paperId)) continue;
    const existing = [...authorMentions.values()].find((row) => row.paperId === mention.paperId && row.authorOrder === mention.authorOrder && row.displayName === mention.displayName);
    if (existing) authorMentions.set(existing.id, { ...existing, evidenceIds: unique([...existing.evidenceIds, ...mention.evidenceIds]) });
    else authorMentions.set(mention.id, mention);
  }
  const result = canonicalizeGraphIdentities({
    ...graph,
    entities: [...entities.values()],
    relationships: [...relationships.values()],
    evidence: [...evidence.values()],
    facts: [...facts.values()],
    authorMentions: [...authorMentions.values()],
    redirects,
    metadata: {
      ...graph.metadata,
      baseGraphAsOf: graph.metadata.baseGraphAsOf ?? graph.metadata.asOf,
      asOf: [graph.metadata.asOf, atlasRemediation.reviewedAt].sort().at(-1),
      atlasRemediationVersion: atlasRemediation.version,
      atlasRemediationAsOf: atlasRemediation.reviewedAt,
      atlasRemediationRelationshipIds: appliedRelationshipIds,
      atlasRemediationIdentityReviews: appliedRedirects,
      atlasRemediationGaps: atlasRemediation.gaps
    }
  });
  if (result.metadata.counts) {
    result.metadata = { ...result.metadata, counts: {
      ...result.metadata.counts,
      entities: result.entities.length,
      relationships: result.relationships.length,
      evidence: result.evidence.length,
      facts: result.facts?.length ?? 0,
      people: result.entities.filter((entity) => entity.kind === "person").length,
      companies: result.entities.filter((entity) => entity.kind === "company").length
    } };
  }
  cache.set(graph, result);
  cache.set(result, result);
  return result;
}

// scripts/public-export-entry.ts
function renderPublicDossier(graph, entityId, hops, asOf) {
  const scoped = graphSnapshotAsOf(applyAtlasRemediation(graph), asOf);
  const dossier = buildInvestigationDossier(scoped, entityId, void 0, { maxHops: hops });
  if (!dossier) throw new Error("Public entity unavailable");
  const evidenceIds = new Set(dossier.evidenceIds);
  const sources = scoped.evidence.filter((source) => evidenceIds.has(source.id));
  return `${serializeInvestigationMarkdown(dossier)}

## Sources

${sources.map((source) => `- ${source.id}: [${source.publisher}](${source.url}) \xB7 ${source.tier} \xB7 checked ${source.retrievedAt}${source.locator ? ` \xB7 ${source.locator}` : ""}`).join("\n")}
`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  renderPublicDossier
});

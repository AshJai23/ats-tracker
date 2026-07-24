// Curated reference data used by app.js for keyword/skill matching and language checks.

const STOPWORDS = new Set(`
a about above after again against all am an and any are aren't as at be because been before
being below between both but by can't cannot could couldn't did didn't do does doesn't doing
don't down during each few for from further had hadn't has hasn't have haven't having he he'd
he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into
is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only
or other ought our ours ourselves out over own same shan't she she'd she'll she's should
shouldn't so some such than that that's the their theirs them themselves then there there's
these they they'd they'll they're they've this those through to too under until up very was
wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while
who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours
yourself yourselves will able across also among around etc get got make made using used use via
within without based per within strong excellent proven demonstrated highly must plus preferred
looking seeking candidate candidates applicant applicants join team teams role roles position
positions job jobs company companies work working works environment opportunity opportunities
year years including include includes required requirement requirements responsibilities duties
qualification qualifications skill skills ability abilities knowledge experience background
minimum least etc e.g. i.e.
`.split(/\s+/).filter(Boolean));

// Common hard skills / tools / technologies for cross-referencing JD <-> resume.
const SKILL_DICTIONARY = [
  // languages
  "javascript","typescript","python","java","c++","c#","php","ruby","go","golang","rust","swift",
  "kotlin","scala","r","matlab","sql","nosql","html","css","bash","shell scripting","perl",
  // frontend
  "react","react.js","vue","vue.js","angular","next.js","nuxt","svelte","redux","tailwind","sass",
  "webpack","vite","jquery",
  // backend
  "node.js","node","express","django","flask","spring","spring boot","laravel","rails",".net",
  "asp.net","fastapi","graphql","rest api","restful api","microservices","grpc",
  // data / db
  "mysql","postgresql","postgres","mongodb","redis","elasticsearch","dynamodb","oracle","sqlite",
  "snowflake","bigquery","redshift","cassandra","firebase",
  // cloud / devops
  "aws","azure","gcp","google cloud","docker","kubernetes","terraform","jenkins","ci/cd","github actions",
  "gitlab ci","ansible","puppet","chef","linux","nginx","cloudformation","serverless",
  // data/ml
  "machine learning","deep learning","tensorflow","pytorch","keras","scikit-learn","pandas","numpy",
  "data analysis","data science","nlp","computer vision","llm","generative ai","statistics",
  "power bi","tableau","looker","excel","spss","sas","etl","data pipeline","data warehouse","spark",
  "hadoop","airflow",
  // pm / design / general business
  "project management","product management","agile","scrum","kanban","jira","confluence","figma",
  "sketch","adobe xd","photoshop","illustrator","ui/ux","ux design","ui design","user research",
  "wireframing","prototyping","seo","sem","google analytics","content marketing","email marketing",
  "salesforce","hubspot","crm","erp","sap","quickbooks","stakeholder management","budget management",
  "vendor management","business analysis","financial modeling","forecasting","negotiation",
  // testing / qa
  "unit testing","selenium","cypress","jest","qa testing","test automation","manual testing",
  // certs
  "pmp","cpa","cfa","shrm","six sigma","itil","cissp","comptia","aws certified","scrum master",
  // soft/general still worth flagging
  "leadership","communication","cross-functional","team leadership","mentoring","public speaking",
  "customer service","problem solving","critical thinking","time management"
];

const STRONG_ACTION_VERBS = [
  "led","managed","built","designed","architected","implemented","launched","increased","reduced",
  "decreased","optimized","spearheaded","drove","delivered","negotiated","orchestrated","streamlined",
  "automated","scaled","mentored","owned","created","developed","established","directed","executed",
  "improved","generated","initiated","transformed","restructured","accelerated","expanded","secured",
  "resolved","engineered","pioneered","launched","cut","grew","saved","forecasted","analyzed",
  "coordinated","supervised","trained","authored","migrated","deployed","standardized","consolidated"
];

const WEAK_PHRASES = [
  "responsible for","duties included","helped with","worked on","in charge of","assisted with",
  "tasked with","involved in","familiar with","exposure to","participated in","various tasks",
  "day to day","day-to-day","other duties as assigned","team player","hard worker","detail oriented",
  "detail-oriented","go-getter","think outside the box","synergy","self-starter"
];

const EXPECTED_SECTIONS = [
  { name: "Contact Info", patterns: [/@/, /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/] },
  { name: "Summary/Objective", patterns: [/\b(summary|objective|profile)\b/i] },
  { name: "Experience", patterns: [/\b(experience|employment history|work history|professional experience)\b/i] },
  { name: "Education", patterns: [/\b(education|academic)\b/i] },
  { name: "Skills", patterns: [/\b(skills|technical skills|core competencies)\b/i] }
];

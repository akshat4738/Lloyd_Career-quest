// Small grounding set of REAL roles / certifications / tools. Injected into the prompt so a
// small local model picks real things instead of inventing them. Add more domains freely.
const DOMAINS = [
  {
    name: 'Web / Frontend / Full Stack',
    keys: ['frontend', 'front-end', 'front end', 'full stack', 'fullstack', 'web dev', 'react', 'javascript', 'web developer', 'backend', 'software engineer', 'software developer'],
    roles: ['Web Development Intern', 'Junior Frontend Developer', 'Frontend Developer', 'Full Stack Developer', 'Software Engineer I'],
    certs: ['freeCodeCamp Responsive Web Design', 'Meta Front-End Developer Professional Certificate', 'AWS Certified Cloud Practitioner', 'Google IT Automation with Python'],
    tools: ['HTML/CSS', 'JavaScript (ES6+)', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Express', 'PostgreSQL', 'Git/GitHub', 'Docker', 'Jest', 'Playwright'],
  },
  {
    name: 'Data / ML / AI',
    keys: ['data scientist', 'data analyst', 'machine learning', 'ml engineer', 'ai engineer', 'data engineer', 'deep learning', 'analytics'],
    roles: ['Data Analyst Intern', 'Junior Data Analyst', 'Data Scientist', 'Machine Learning Engineer', 'Data Engineer'],
    certs: ['Google Data Analytics Professional Certificate', 'IBM Data Science Professional Certificate', 'TensorFlow Developer Certificate', 'Microsoft Azure Data Scientist Associate (DP-100)', 'AWS Certified Machine Learning - Specialty'],
    tools: ['Python', 'SQL', 'pandas', 'scikit-learn', 'PyTorch', 'Jupyter', 'Tableau', 'Power BI', 'Airflow', 'Kaggle competitions'],
  },
  {
    name: 'UI/UX / Product Design',
    keys: ['ui', 'ux', 'designer', 'product design', 'figma', 'interaction design'],
    roles: ['Design Intern', 'Junior UI/UX Designer', 'Product Designer', 'UX Researcher', 'Senior Product Designer'],
    certs: ['Google UX Design Professional Certificate', 'Nielsen Norman Group UX Certification', 'Interaction Design Foundation courses', 'Figma Config community challenges'],
    tools: ['Figma', 'FigJam', 'Adobe XD', 'user interviews', 'usability testing', 'design systems', 'wireframing', 'prototyping', 'WCAG accessibility'],
  },
  {
    name: 'Cloud / DevOps / Security',
    keys: ['devops', 'cloud', 'sre', 'security', 'cyber', 'sysadmin', 'infrastructure'],
    roles: ['IT Support Intern', 'Junior Cloud Engineer', 'DevOps Engineer', 'Site Reliability Engineer', 'Security Analyst'],
    certs: ['CompTIA Security+', 'AWS Certified Solutions Architect - Associate', 'Certified Kubernetes Administrator (CKA)', 'HashiCorp Terraform Associate', 'Microsoft AZ-900'],
    tools: ['Linux', 'Bash', 'Docker', 'Kubernetes', 'Terraform', 'GitHub Actions', 'Prometheus', 'Grafana', 'Wireshark'],
  },
  {
    name: 'Mobile',
    keys: ['android', 'ios', 'mobile', 'flutter', 'react native', 'swift', 'kotlin'],
    roles: ['Mobile Developer Intern', 'Junior Android Developer', 'iOS Developer', 'Mobile Engineer'],
    certs: ['Associate Android Developer (Google)', 'Meta React Native Specialization', 'Flutter Certification (Udemy/Google Developers)'],
    tools: ['Kotlin', 'Jetpack Compose', 'Swift', 'SwiftUI', 'Flutter', 'Dart', 'Firebase', 'App Store / Play Store publishing'],
  },
  {
    name: 'Product / Business / Marketing',
    keys: ['product manager', 'product management', 'business analyst', 'marketing', 'growth', 'project manager', 'consultant'],
    roles: ['Associate Product Manager', 'Business Analyst', 'Product Analyst', 'Product Manager', 'Growth Marketer'],
    certs: ['Google Project Management Certificate', 'Pragmatic Institute PMC', 'CSPO (Scrum Alliance)', 'Google Analytics Certification', 'HubSpot Inbound Marketing'],
    tools: ['SQL', 'Excel', 'Mixpanel', 'Amplitude', 'Jira', 'Notion', 'A/B testing', 'PRDs', 'roadmapping', 'user research'],
  },
  {
    name: 'Game Dev',
    keys: ['game', 'unity', 'unreal', 'gamedev'],
    roles: ['QA Tester (Games)', 'Junior Gameplay Programmer', 'Game Developer', 'Technical Artist'],
    certs: ['Unity Certified User: Programmer', 'Unity Certified Associate', 'Epic Games Unreal Authorized Courses'],
    tools: ['Unity', 'C#', 'Unreal Engine', 'C++', 'Blender', 'game jams (itch.io)', 'Git LFS'],
  },
  {
    name: 'Climate / Sustainability tech',
    keys: ['climate', 'sustainab', 'green', 'energy', 'carbon', 'esg'],
    roles: ['Sustainability Analyst', 'Climate Data Analyst', 'Energy Systems Engineer'],
    certs: ['GRI Certified Sustainability Professional', 'GHG Protocol training', 'FSA Credential (SASB)', 'Climate Change Fundamentals (edX)'],
    tools: ['GHG Protocol', 'carbon accounting', 'Open-Meteo / NASA POWER open data', 'GIS (QGIS)', 'Python', 'dashboards'],
  },
  {
    name: 'Fintech',
    keys: ['fintech', 'finance', 'banking', 'payments', 'trading', 'quant'],
    roles: ['Financial Analyst Intern', 'Junior Fintech Developer', 'Payments Engineer', 'Risk Analyst'],
    certs: ['CFA Level I (optional)', 'Stripe developer docs/Stripe Apps', 'PCI DSS Awareness', 'AWS Certified Cloud Practitioner'],
    tools: ['Stripe API', 'Plaid API', 'SQL', 'Python', 'KYC/AML basics', 'ledger design', 'Excel modelling'],
  },
];

export function hintsFor(goal) {
  const g = ` ${String(goal).toLowerCase()} `;
  const hits = DOMAINS.filter((d) => d.keys.some((k) => g.includes(k))).slice(0, 2);
  if (!hits.length) return '';
  return hits
    .map(
      (d) =>
        `Known real examples for ${d.name}:\n- Roles: ${d.roles.join('; ')}\n- Certifications: ${d.certs.join('; ')}\n- Tools/skills: ${d.tools.join(', ')}`
    )
    .join('\n');
}

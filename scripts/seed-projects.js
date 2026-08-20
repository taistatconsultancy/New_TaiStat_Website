/**
 * Seed / refresh portfolio projects (upsert by slug).
 */
require('dotenv').config();
const { getPool, resolveDatabaseUrl } = require('../api/_db');

const pool = getPool();

const seeds = [
  {
    title: 'TaiStat AgroLink (Mkulima Sokoni)',
    slug: 'mkulima-sokoni',
    summary:
      'Kenya-first agriculture marketplace connecting verified farmers with trusted buyers — traceability, fair pricing, and scale.',
    description: `We built TaiStat AgroLink as a flagship agriculture platform for transparent markets and verified participation across Kenyan counties.

The product combines marketplace workflows with traceability concepts so buyers can discover verified producers and farmers can reach fair demand. Smart pricing signals and structured onboarding reduce friction for smallholders while giving buyers confidence in origin and quality.

TaiStat continues to invest in AI-assisted insights for yields and market dynamics alongside blockchain-inspired verification patterns where they add trust—not hype.`,
    problem_statement: `Smallholder farmers often lack predictable markets and transparent pricing, while buyers struggle to verify origin and quality at scale. Traditional channels fragment trust and leave value on the table.`,
    outcome_text: `A structured marketplace direction with verified onboarding, clearer farmer–buyer matching, and data-informed pricing narratives — built to scale county by county with TaiStat's agriculture and engineering teams.`,
    category: 'Agriculture & Platforms',
    client_name: 'TaiStat Firm',
    project_type: 'Web platform',
    status_label: 'Live',
    features: [
      'Farmer–buyer marketplace with transparent pricing narratives',
      'Verification and traceability-oriented workflows',
      'Designed for rollout across Kenyan counties',
      'Roadmap: deeper analytics and AI-assisted market signals'
    ],
    tech_tags: ['Web platform', 'Analytics', 'APIs', 'Cloud'],
    image_url:
      'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1600&q=80&auto=format&fit=crop',
    project_url: 'https://www.mkulimasokoni.com/',
    secondary_url: null,
    featured: true,
    published: true,
    sort_order: 0
  },
  {
    title: 'YodaAI',
    slug: 'yodaai',
    summary:
      'An intelligent retrospective assistant for agile teams — 4Ls facilitation, theme detection, and exportable outcomes.',
    description: `YodaAI guides agile teams through structured retrospectives using the 4Ls framework: Liked, Learned, Lacked, and Longed For. The assistant keeps sessions focused, captures nuance in natural language, and clusters comments into themes so patterns emerge without manual tagging marathons.

Teams vote on what matters most; the product surfaces Disciplined Agile–aligned practice ideas and turns the session into a concise PDF report — action items included — so outcomes are traceable sprint over sprint.`,
    problem_statement: `Many agile teams run retrospectives that feel repetitive or unstructured. Feedback scatters across notes, themes stay implicit, and action items evaporate after the meeting.`,
    outcome_text: `Repeatable 4Ls sessions with automatic theme grouping, prioritisation through voting, and shareable PDF summaries — so retrospectives become comparable across sprints and commitments stay visible.`,
    category: 'AI & Agile',
    client_name: 'TaiStat Firm',
    project_type: 'Web application',
    status_label: 'Live',
    features: [
      'Structured 4Ls facilitation end-to-end',
      'Theme clustering from free-text feedback',
      'Team voting on priorities',
      'Practice recommendations aligned to agile delivery',
      'PDF exports for stakeholders'
    ],
    tech_tags: ['Python', 'NLP', 'AI / ML', 'REST API', 'PDF generation'],
    image_url:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80&auto=format&fit=crop',
    project_url: 'https://yoda-ai-theta.vercel.app/ui/yodaai-app.html',
    secondary_url: 'https://stephenmulingwa.com/project-yodaai.html',
    featured: false,
    published: true,
    sort_order: 10
  }
];

async function run() {
  if (!resolveDatabaseUrl()) {
    console.error('DATABASE_URL (or SUPABASE_DATABASE_URL) is required');
    process.exit(1);
  }

  for (const p of seeds) {
    await pool.query(
      `INSERT INTO projects (
        title, slug, summary, description, category, features,
        image_url, project_url, secondary_url, featured, published, sort_order,
        problem_statement, outcome_text, client_name, project_type, status_label, tech_tags
      ) VALUES (
        $1, $2, $3, $4, $5, $6::text[],
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18::text[]
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        features = EXCLUDED.features,
        image_url = EXCLUDED.image_url,
        project_url = EXCLUDED.project_url,
        secondary_url = EXCLUDED.secondary_url,
        featured = EXCLUDED.featured,
        published = EXCLUDED.published,
        sort_order = EXCLUDED.sort_order,
        problem_statement = EXCLUDED.problem_statement,
        outcome_text = EXCLUDED.outcome_text,
        client_name = EXCLUDED.client_name,
        project_type = EXCLUDED.project_type,
        status_label = EXCLUDED.status_label,
        tech_tags = EXCLUDED.tech_tags,
        updated_at = CURRENT_TIMESTAMP`,
      [
        p.title,
        p.slug,
        p.summary,
        p.description,
        p.category,
        p.features,
        p.image_url,
        p.project_url,
        p.secondary_url,
        p.featured,
        p.published,
        p.sort_order,
        p.problem_statement,
        p.outcome_text,
        p.client_name,
        p.project_type,
        p.status_label,
        p.tech_tags
      ]
    );
    console.log('Upserted project:', p.slug);
  }

  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

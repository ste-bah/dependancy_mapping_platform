/**
 * Sidebars Configuration
 * TASK-FINAL-004: Documentation System
 *
 * Creating a sidebar enables you to:
 * - create an ordered group of docs
 * - render a sidebar for each doc of that group
 * - provide next/previous navigation
 *
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */
const sidebars = {
  docs: [
    'getting-started',
    {
      type: 'category',
      label: 'User Guide',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Repositories',
          items: [
            'repositories/adding-repositories',
            'repositories/managing-repositories',
            'repositories/webhook-configuration',
          ],
        },
        {
          type: 'category',
          label: 'Graphs & Visualization',
          items: [
            'graphs/understanding-graphs',
            'graphs/navigation-controls',
            'graphs/filtering-searching',
            'graphs/blast-radius',
            'graphs/graph-diff',
          ],
        },
        {
          type: 'category',
          label: 'Scans',
          items: [
            'scans/running-scans',
            'scans/scan-results',
            'scans/scheduling-scans',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/authentication',
        'api/endpoints',
        'api/error-handling',
        'api/rate-limits',
        'api/api-keys',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'integrations/github-actions',
        'integrations/gitlab-ci',
        'integrations/terraform-cloud',
        'integrations/slack-notifications',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      items: [
        'advanced/cross-repo-analysis',
        'advanced/external-objects',
        'advanced/custom-parsers',
        'advanced/performance-tuning',
      ],
    },
    {
      type: 'category',
      label: 'Support',
      items: [
        'support/troubleshooting',
        'support/faq',
        'support/runbook',
        'support/feedback',
      ],
    },
  ],
};

module.exports = sidebars;

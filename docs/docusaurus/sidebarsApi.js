/**
 * API Documentation Sidebars
 * TASK-FINAL-004: Documentation System
 *
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */
const sidebarsApi = {
  api: [
    'overview',
    {
      type: 'category',
      label: 'Authentication',
      items: [
        'auth/oauth-flow',
        'auth/api-keys',
        'auth/jwt-tokens',
      ],
    },
    {
      type: 'category',
      label: 'Repositories',
      items: [
        'repositories/list',
        'repositories/create',
        'repositories/get',
        'repositories/update',
        'repositories/delete',
      ],
    },
    {
      type: 'category',
      label: 'Scans',
      items: [
        'scans/list',
        'scans/create',
        'scans/get',
        'scans/status',
        'scans/cancel',
      ],
    },
    {
      type: 'category',
      label: 'Graph',
      items: [
        'graph/get-graph',
        'graph/list-nodes',
        'graph/get-node',
        'graph/dependencies',
        'graph/dependents',
        'graph/blast-radius',
        'graph/impact-analysis',
      ],
    },
    {
      type: 'category',
      label: 'Rollups',
      items: [
        'rollups/overview',
        'rollups/create',
        'rollups/execute',
        'rollups/results',
      ],
    },
    {
      type: 'category',
      label: 'Webhooks',
      items: [
        'webhooks/github',
        'webhooks/gitlab',
        'webhooks/verification',
      ],
    },
    'errors',
    'rate-limits',
    'changelog',
  ],
};

module.exports = sidebarsApi;

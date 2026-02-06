// @ts-check
// Docusaurus Configuration for Dependency Mapping Platform
// TASK-FINAL-004: Documentation System

const { themes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Dependency Mapping Platform',
  tagline: 'Visualize and understand your infrastructure dependencies',
  url: 'https://docs.code-reviewer.io',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'code-reviewer',
  projectName: 'dependency-mapping-platform',

  // Internationalization settings
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/code-reviewer/docs/edit/main/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'api',
        path: 'api-docs',
        routeBasePath: 'api',
        sidebarPath: require.resolve('./sidebarsApi.js'),
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Color mode settings
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },

      // Navbar configuration
      navbar: {
        title: 'DMP Docs',
        logo: {
          alt: 'Dependency Mapping Platform',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'getting-started',
            position: 'left',
            label: 'User Guide',
          },
          {
            to: '/api',
            label: 'API Reference',
            position: 'left',
          },
          {
            type: 'search',
            position: 'right',
          },
          {
            href: 'https://github.com/code-reviewer',
            label: 'GitHub',
            position: 'right',
          },
          {
            href: 'https://app.code-reviewer.io',
            label: 'Launch App',
            position: 'right',
            className: 'navbar-launch-button',
          },
        ],
      },

      // Footer configuration
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/getting-started',
              },
              {
                label: 'User Guide',
                to: '/repositories/adding-repositories',
              },
              {
                label: 'API Reference',
                to: '/api',
              },
            ],
          },
          {
            title: 'Features',
            items: [
              {
                label: 'Graph Visualization',
                to: '/graphs/understanding-graphs',
              },
              {
                label: 'Blast Radius Analysis',
                to: '/graphs/blast-radius',
              },
              {
                label: 'CI/CD Integration',
                to: '/integrations/github-actions',
              },
            ],
          },
          {
            title: 'Support',
            items: [
              {
                label: 'FAQ',
                to: '/support/faq',
              },
              {
                label: 'Troubleshooting',
                to: '/support/troubleshooting',
              },
              {
                label: 'Status Page',
                href: 'https://status.code-reviewer.io',
              },
            ],
          },
          {
            title: 'Legal',
            items: [
              {
                label: 'Privacy Policy',
                href: 'https://code-reviewer.io/privacy',
              },
              {
                label: 'Terms of Service',
                href: 'https://code-reviewer.io/terms',
              },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Code Reviewer. All rights reserved.`,
      },

      // Prism syntax highlighting
      prism: {
        theme: themes.github,
        darkTheme: themes.dracula,
        additionalLanguages: ['bash', 'hcl', 'yaml', 'json', 'typescript'],
      },

      // Algolia search (configure when available)
      // algolia: {
      //   appId: 'YOUR_APP_ID',
      //   apiKey: 'YOUR_SEARCH_API_KEY',
      //   indexName: 'code-reviewer-docs',
      // },

      // Announcement bar for beta
      announcementBar: {
        id: 'beta_notice',
        content:
          'Welcome to DMP Beta! Your feedback helps us improve. <a href="/support/feedback">Share your thoughts</a>.',
        backgroundColor: '#6366f1',
        textColor: '#ffffff',
        isCloseable: true,
      },

      // Table of contents settings
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
};

module.exports = config;

import {
  ServiceStatus,
  ServiceType,
} from '../../services/entities/service.entity';

export interface SeedVersion {
  name: string;
  description: string;
  changelog: string;
  releasedAt: string;
}

export interface SeedService {
  name: string;
  description: string;
  type: ServiceType;
  status: ServiceStatus;
  versions: SeedVersion[];
}

/**
 * A realistic-looking catalog: enough rows to exercise pagination, a spread of
 * types/statuses to exercise filtering, and varied version counts so the card's
 * "N versions" badge has something interesting to show.
 */
export const SEED_SERVICES: SeedService[] = [
  {
    name: 'Contact Us',
    description:
      'Handles inbound contact form submissions, routes them to the right team queue, and issues acknowledgement emails.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial release.',
        changelog: 'Form intake and email acknowledgement.',
        releasedAt: '2023-01-17T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'Team routing rules.',
        changelog: 'Added configurable routing by subject line.',
        releasedAt: '2023-06-02T09:00:00Z',
      },
    ],
  },
  {
    name: 'Payment Gateway',
    description:
      'Tokenizes cards and brokers authorizations, captures, and refunds across our payment processors.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Single-processor launch.',
        changelog: 'Authorize and capture via primary processor.',
        releasedAt: '2021-03-11T09:00:00Z',
      },
      {
        name: 'v2.0.0',
        description: 'Multi-processor routing.',
        changelog:
          'BREAKING: reshaped the charge payload. Added failover routing.',
        releasedAt: '2022-08-30T09:00:00Z',
      },
      {
        name: 'v2.1.0',
        description: 'Partial refunds.',
        changelog: 'Support partial and multi-step refunds.',
        releasedAt: '2023-02-14T09:00:00Z',
      },
      {
        name: 'v2.2.0',
        description: '3-D Secure 2.',
        changelog: 'Added 3DS2 challenge flow and exemption handling.',
        releasedAt: '2024-01-22T09:00:00Z',
      },
    ],
  },
  {
    name: 'Identity Provider',
    description:
      'Issues and validates OIDC tokens, manages sessions, and enforces the organization password and MFA policy.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'OIDC authorization code flow.',
        changelog: 'Initial identity provider.',
        releasedAt: '2020-09-01T09:00:00Z',
      },
      {
        name: 'v1.4.0',
        description: 'MFA enrollment.',
        changelog: 'TOTP enrollment and recovery codes.',
        releasedAt: '2021-11-19T09:00:00Z',
      },
      {
        name: 'v2.0.0',
        description: 'Refresh token rotation.',
        changelog: 'BREAKING: refresh tokens are now single-use.',
        releasedAt: '2023-05-08T09:00:00Z',
      },
    ],
  },
  {
    name: 'Notification Hub',
    description:
      'Fan-out delivery for transactional email, SMS, and push, with per-user channel preferences and retry backoff.',
    type: ServiceType.KAFKA,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Email only.',
        changelog: 'Transactional email fan-out.',
        releasedAt: '2022-02-03T09:00:00Z',
      },
      {
        name: 'v1.2.0',
        description: 'SMS channel.',
        changelog: 'Added SMS delivery and opt-out handling.',
        releasedAt: '2022-10-27T09:00:00Z',
      },
      {
        name: 'v1.3.0',
        description: 'Push channel.',
        changelog: 'Added APNs and FCM delivery.',
        releasedAt: '2023-07-15T09:00:00Z',
      },
    ],
  },
  {
    name: 'Inventory Sync',
    description:
      'Reconciles warehouse stock levels with the storefront catalog on a rolling five-minute window.',
    type: ServiceType.GRPC,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial reconciliation loop.',
        changelog: 'Nightly full sync.',
        releasedAt: '2022-05-20T09:00:00Z',
      },
      {
        name: 'v2.0.0',
        description: 'Incremental sync.',
        changelog:
          'BREAKING: replaced nightly full sync with a five-minute delta.',
        releasedAt: '2023-09-12T09:00:00Z',
      },
    ],
  },
  {
    name: 'Search Indexer',
    description:
      'Consumes catalog change events and maintains the denormalized product search index.',
    type: ServiceType.KAFKA,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial indexer.',
        changelog: 'Full and incremental index builds.',
        releasedAt: '2023-04-04T09:00:00Z',
      },
    ],
  },
  {
    name: 'Reporting API',
    description:
      'Serves aggregated business metrics and scheduled exports to the analytics dashboard.',
    type: ServiceType.GRAPHQL,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Core metrics graph.',
        changelog: 'Revenue, orders, and customer metrics.',
        releasedAt: '2022-11-08T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'Scheduled exports.',
        changelog: 'CSV and Parquet export scheduling.',
        releasedAt: '2023-08-21T09:00:00Z',
      },
      {
        name: 'v1.2.0',
        description: 'Cohort analysis.',
        changelog: 'Added retention cohort resolvers.',
        releasedAt: '2024-03-05T09:00:00Z',
      },
    ],
  },
  {
    name: 'Shipping Rates',
    description:
      'Quotes live carrier rates and transit times, with fallback to cached rate cards when carriers are unreachable.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Single carrier.',
        changelog: 'Live rate quoting.',
        releasedAt: '2022-07-19T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'Multi-carrier.',
        changelog: 'Added three additional carriers and rate comparison.',
        releasedAt: '2023-03-30T09:00:00Z',
      },
    ],
  },
  {
    name: 'Fraud Scoring',
    description:
      'Scores transactions in real time against behavioral and device signals, returning an accept/review/decline decision.',
    type: ServiceType.GRPC,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Rules engine.',
        changelog: 'Deterministic rule scoring.',
        releasedAt: '2021-08-14T09:00:00Z',
      },
      {
        name: 'v2.0.0',
        description: 'Model scoring.',
        changelog: 'BREAKING: score is now 0-1000 rather than 0-100.',
        releasedAt: '2023-01-09T09:00:00Z',
      },
      {
        name: 'v2.1.0',
        description: 'Device fingerprinting.',
        changelog: 'Added device signal ingestion.',
        releasedAt: '2023-10-02T09:00:00Z',
      },
    ],
  },
  {
    name: 'Customer Profile',
    description:
      'Canonical customer record: contact details, consent flags, and the merge history for deduplicated identities.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial profile store.',
        changelog: 'CRUD over the canonical customer record.',
        releasedAt: '2021-01-25T09:00:00Z',
      },
      {
        name: 'v1.5.0',
        description: 'Consent tracking.',
        changelog: 'Added GDPR consent flags and audit trail.',
        releasedAt: '2022-04-11T09:00:00Z',
      },
      {
        name: 'v1.6.0',
        description: 'Identity merge.',
        changelog: 'Added duplicate detection and merge history.',
        releasedAt: '2023-11-27T09:00:00Z',
      },
    ],
  },
  {
    name: 'Audit Log',
    description:
      'Append-only record of privileged actions across the platform, retained for seven years and queryable by actor or resource.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial append-only log.',
        changelog: 'Write and query privileged actions.',
        releasedAt: '2022-06-06T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'Retention policy.',
        changelog: 'Added seven-year retention and cold storage tiering.',
        releasedAt: '2023-12-18T09:00:00Z',
      },
    ],
  },
  {
    name: 'Feature Flags',
    description:
      'Evaluates rollout rules and returns flag values per user segment, with a streaming channel for live updates.',
    type: ServiceType.WEBSOCKET,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Polling evaluation.',
        changelog: 'Flag evaluation over HTTP polling.',
        releasedAt: '2022-09-13T09:00:00Z',
      },
      {
        name: 'v2.0.0',
        description: 'Streaming updates.',
        changelog: 'BREAKING: replaced polling with a WebSocket stream.',
        releasedAt: '2024-02-26T09:00:00Z',
      },
    ],
  },
  {
    name: 'Media Transcoder',
    description:
      'Transcodes uploaded video into adaptive bitrate renditions and generates poster frames.',
    type: ServiceType.HTTP,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial transcoding pipeline.',
        changelog: 'H.264 renditions and poster frames.',
        releasedAt: '2023-02-07T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'AV1 support.',
        changelog: 'Added AV1 renditions for supported clients.',
        releasedAt: '2024-04-16T09:00:00Z',
      },
    ],
  },
  {
    name: 'Tax Calculation',
    description:
      'Computes sales tax, VAT, and GST per line item using jurisdiction rules refreshed nightly.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'US sales tax.',
        changelog: 'State and local sales tax calculation.',
        releasedAt: '2022-03-22T09:00:00Z',
      },
      {
        name: 'v1.2.0',
        description: 'EU VAT.',
        changelog: 'Added VAT with reverse-charge handling.',
        releasedAt: '2023-05-30T09:00:00Z',
      },
      {
        name: 'v1.3.0',
        description: 'APAC GST.',
        changelog: 'Added GST for AU, NZ, and SG.',
        releasedAt: '2024-05-09T09:00:00Z',
      },
    ],
  },
  {
    name: 'Legacy Billing',
    description:
      'Original subscription billing engine. Superseded by Payment Gateway; retained read-only for historical invoices.',
    type: ServiceType.REST,
    status: ServiceStatus.DEPRECATED,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial billing engine.',
        changelog: 'Subscription invoicing and dunning.',
        releasedAt: '2019-04-02T09:00:00Z',
      },
      {
        name: 'v1.9.0',
        description: 'Final feature release.',
        changelog: 'Last release before deprecation.',
        releasedAt: '2021-06-15T09:00:00Z',
      },
    ],
  },
  {
    name: 'SOAP Order Bridge',
    description:
      'Translated orders between the storefront and the legacy ERP. Retired after the ERP migration completed.',
    type: ServiceType.HTTP,
    status: ServiceStatus.RETIRED,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial bridge.',
        changelog: 'Order translation to the legacy ERP.',
        releasedAt: '2018-10-08T09:00:00Z',
      },
    ],
  },
  {
    name: 'Recommendation Engine',
    description:
      'Serves personalized product recommendations from collaborative filtering and recent session behavior.',
    type: ServiceType.GRPC,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Collaborative filtering.',
        changelog: 'Item-to-item recommendations.',
        releasedAt: '2023-06-26T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'Session signals.',
        changelog: 'Blended in real-time session behavior.',
        releasedAt: '2024-06-11T09:00:00Z',
      },
    ],
  },
  {
    name: 'Webhook Dispatcher',
    description:
      'Delivers outbound webhooks to partner endpoints with signing, exponential backoff, and a replay API.',
    type: ServiceType.REST,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial dispatcher.',
        changelog: 'Signed delivery with retry.',
        releasedAt: '2022-12-05T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'Replay API.',
        changelog: 'Added manual replay of failed deliveries.',
        releasedAt: '2023-09-25T09:00:00Z',
      },
    ],
  },
  {
    name: 'Document Store',
    description:
      'Stores and versions customer-uploaded documents with virus scanning and signed download URLs.',
    type: ServiceType.HTTP,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Initial store.',
        changelog: 'Upload, scan, and signed download.',
        releasedAt: '2023-03-13T09:00:00Z',
      },
    ],
  },
  {
    name: 'Rate Limiter',
    description:
      'Centralized token-bucket rate limiting consulted by the API gateway on every inbound request.',
    type: ServiceType.GRPC,
    status: ServiceStatus.ACTIVE,
    versions: [
      {
        name: 'v1.0.0',
        description: 'Token bucket.',
        changelog: 'Per-key token bucket limiting.',
        releasedAt: '2022-01-31T09:00:00Z',
      },
      {
        name: 'v1.1.0',
        description: 'Sliding window.',
        changelog: 'Added sliding-window strategy alongside token bucket.',
        releasedAt: '2023-07-03T09:00:00Z',
      },
    ],
  },
];

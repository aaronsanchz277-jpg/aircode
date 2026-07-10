export const DEFAULT_LAYER_PATTERNS: Record<string, RegExp[]> = {
  presentation: [
    /(?:^|\/)(?:components|pages|views|screens|ui|layouts|containers)\//i,
    /(?:^|\/)(?:controllers|routers|handlers|endpoints)\//i,
  ],
  application: [
    /(?:^|\/)(?:services|usecases|use-cases|actions|commands|orchestrators)\//i,
  ],
  domain: [
    /(?:^|\/)(?:domain|entities|models|value-objects|aggregates)\//i,
  ],
  infrastructure: [
    /(?:^|\/)(?:infrastructure|infra|adapters|gateways|repositories|dao|mappers|persistence)\//i,
    /(?:^|\/)(?:clients|external|config|database)\//i,
  ],
  shared: [
    /(?:^|\/)(?:shared|common|utils|helpers|lib|core|constants|types)\//i,
  ],
};

export const DEFAULT_PRIORITY = ['infrastructure', 'domain', 'application', 'presentation', 'shared'];

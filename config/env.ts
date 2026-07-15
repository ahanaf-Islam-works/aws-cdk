export const env = {
  dev: 'dev',
  stg: 'stg',
  prod: 'prod',
} as const;

export type EnvironmentName = (typeof env)[keyof typeof env];
export const appName = 'app-namer';
export const ROOT_DOMAIN_NAME = 'app-name.com';
export const BE_TECH_STACK = 'django';
export const PORT = 8000;

export const github = {
  githubOwner: '',
  githubRepository: '',
};

const SHARED_HOSTED_ZONE_ID = process.env.CDK_HOSTED_ZONE_ID;

interface EnvironmentConfig {
  /** AWS account ID this environment deploys into */
  account: string | undefined;

  /** AWS region this environment deploys into */
  region: string | undefined;

  /** Environment name */
  envName: EnvironmentName;

  /** Whether this is the production environment */
  isProd: boolean;

  /** Frontend domain */
  domainName?: string;

  /** API domain */
  apiDomainName?: string;

  /** Root/apex domain */
  rootDomainName?: string;

  /**
   * Existing Route 53 Hosted Zone ID.
   * All environments share the same hosted zone.
   */
  parentHostedZoneId?: string;
}

export const environments: Record<EnvironmentName, EnvironmentConfig> = {
  [env.dev]: {
    account: process.env.CDK_DEV_ACCOUNT,
    region: process.env.CDK_DEV_REGION,
    envName: env.dev,
    isProd: false,
    domainName: `dev.${ROOT_DOMAIN_NAME}`,
    apiDomainName: `dev.api.${ROOT_DOMAIN_NAME}`,
    rootDomainName: ROOT_DOMAIN_NAME,
    parentHostedZoneId: SHARED_HOSTED_ZONE_ID,
  },

  [env.stg]: {
    account: process.env.CDK_STG_ACCOUNT,
    region: process.env.CDK_STG_REGION,
    envName: env.stg,
    isProd: false,
    domainName: `stg.${ROOT_DOMAIN_NAME}`,
    apiDomainName: `stg.api.${ROOT_DOMAIN_NAME}`,
    rootDomainName: ROOT_DOMAIN_NAME,
    parentHostedZoneId: SHARED_HOSTED_ZONE_ID,
  },

  [env.prod]: {
    account: process.env.CDK_PROD_ACCOUNT,
    region: process.env.CDK_PROD_REGION,
    envName: env.prod,
    isProd: true,
    domainName: `www.${ROOT_DOMAIN_NAME}`,
    apiDomainName: `api.${ROOT_DOMAIN_NAME}`,
    rootDomainName: ROOT_DOMAIN_NAME,
    parentHostedZoneId: SHARED_HOSTED_ZONE_ID,
  },
};

export const getEnvironmentConfig = (envName: EnvironmentName) => {
  const config = environments[envName];

  if (!config) {
    throw new Error(
      `Unknown environment "${envName}". Valid environments: ${Object.keys(environments).join(
        ', ',
      )}`,
    );
  }

  if (!config.account) {
    throw new Error(
      `Missing AWS account for "${envName}". Set CDK_${envName.toUpperCase()}_ACCOUNT.`,
    );
  }

  if (!config.region) {
    throw new Error(
      `Missing AWS region for "${envName}". Set CDK_${envName.toUpperCase()}_REGION.`,
    );
  }

  return {
    ...config,
    account: config.account,
    region: config.region,
  };
};

export type EnvironmentConfigType = ReturnType<typeof getEnvironmentConfig>;

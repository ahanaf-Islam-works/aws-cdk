import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';

import { appName } from '../config/env';

export interface SsmStackProps {
  envName: string;

  databaseUrl: string;
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUsername: string;

  dbSecret: secretsmanager.ISecret;

  mediaBucket: s3.IBucket;
  frontendBucket: s3.IBucket;

  ecrRepository: ecr.IRepository;

  distribution: cloudfront.IDistribution;

  djangoSecretKey: string;

  allowedHosts: string;

  corsAllowedOrigins: string;

  logLevel?: string;

  openAiApiKey?: string;

  geminiApiKey?: string;

  jwtSecret?: string;
}

export class SsmStack extends Construct {
  constructor(scope: Construct, id: string, props: SsmStackProps) {
    super(scope, id);

    const prefix = `/${appName}/${props.envName}`;

    const parameters = {
      DATABASE_URL: props.databaseUrl,

      DB_HOST: props.dbHost,

      DB_PORT: props.dbPort,

      DB_NAME: props.dbName,

      DB_USERNAME: props.dbUsername,

      DB_SECRET_NAME: props.dbSecret.secretName,

      AWS_REGION: cdk.Stack.of(this).region,

      ENVIRONMENT: props.envName,

      LOG_LEVEL: props.logLevel ?? 'INFO',

      DJANGO_SECRET_KEY: props.djangoSecretKey,

      ALLOWED_HOSTS: props.allowedHosts,

      CORS_ALLOWED_ORIGINS: props.corsAllowedOrigins,

      MEDIA_BUCKET: props.mediaBucket.bucketName,

      FRONTEND_BUCKET: props.frontendBucket.bucketName,

      CLOUDFRONT_URL: `https://${props.distribution.distributionDomainName}`,

      ECR_REPOSITORY_URI: props.ecrRepository.repositoryUri,

      OPENAI_API_KEY: props.openAiApiKey ?? '',

      GEMINI_API_KEY: props.geminiApiKey ?? '',

      JWT_SECRET: props.jwtSecret ?? '',
    };

    Object.entries(parameters).forEach(([key, value]) => {
      new ssm.StringParameter(this, key, {
        parameterName: `${prefix}/${key}`,
        stringValue: value,
      });
    });
  }
}

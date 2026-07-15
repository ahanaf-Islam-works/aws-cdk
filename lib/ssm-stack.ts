import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';

import { appName, EnvironmentName } from '../config/env';

export interface SsmStackProps {
  envName: EnvironmentName;
  mediaBucket: s3.IBucket;
  frontendBucket: s3.IBucket;
  ecrRepository: ecr.IRepository;
  distribution: cloudfront.IDistribution;
  djangoSecretKey: string;
  allowedHosts: string;
  corsAllowedOrigins: string;
  logLevel: string;
  geminiApiKey: string;
  jwtSecret: string;
  vpcId: string;
  privateSubnetId: string;
  lambdaSecurityGroupId: string;
  apiUrl: string;
}

export class SsmStack extends Construct {
  constructor(scope: Construct, id: string, props: SsmStackProps) {
    super(scope, id);

    const bePrefix = `/${appName}/${props.envName}`;

    const fePrefix = bePrefix + '/fe/VITE';

    const beParameters = {
      AWS_REGION: cdk.Stack.of(this).region,

      ENVIRONMENT: props.envName,

      LOG_LEVEL: props.logLevel,

      DJANGO_SECRET_KEY: props.djangoSecretKey,

      ALLOWED_HOSTS: props.allowedHosts,

      CORS_ALLOWED_ORIGINS: props.corsAllowedOrigins,

      MEDIA_BUCKET: props.mediaBucket.bucketName,

      FRONTEND_BUCKET: props.frontendBucket.bucketName,

      CLOUDFRONT_URL: `https://${props.distribution.distributionDomainName}`,

      ECR_REPOSITORY_URI: props.ecrRepository.repositoryUri,

      GEMINI_API_KEY: props.geminiApiKey,

      JWT_SECRET: props.jwtSecret,

      VPC_ID: props.vpcId,

      PRIVATE_SUBNET_ID: props.privateSubnetId,

      LAMBDA_SECURITY_GROUP_ID: props.lambdaSecurityGroupId,
    };

    const fePrameters = {
      API_URL: props.apiUrl,
    };

    Object.entries(beParameters).forEach(([key, value]) => {
      new ssm.StringParameter(this, key, {
        parameterName: `${bePrefix}/${key}`,
        stringValue: value,
      });
    });

    Object.entries(fePrameters).forEach(([key, value]) => {
      new ssm.StringParameter(this, key, {
        parameterName: `${fePrefix}_${key}`,
        stringValue: value,
      });
    });
  }
}

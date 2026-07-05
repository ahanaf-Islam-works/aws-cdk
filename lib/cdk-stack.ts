import { VpcStack } from './vpc-stack';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { SecurityGroupStack } from './security-group-stack';
import { S3Stack } from './s3-stack';
import { EcrStack } from './ecr-stack';
import { RdsPostgres } from './rds-stack';
import { appName } from '../config/env';
import { Ec2Stack } from './ec2-stack';
import { AlbStack } from './alb-stack';
import { CloudFrontStack } from './cloudfront-stack';
import { SsmStack } from './ssm-stack';
export interface MainStackProps extends cdk.StackProps {
  envName: string;
}

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const vpcStack = new VpcStack(this, 'vpc', {
      envName: envName,
    });

    const sgStack = new SecurityGroupStack(this, 'SecurityGroups', {
      envName: envName,
      vpc: vpcStack.vpc,
    });

    const s3Stack = new S3Stack(this, 'S3', { envName });

    const ecrStack = new EcrStack(this, 'Ecr', { envName });

    const rds = new RdsPostgres(this, 'Rds', {
      envName,
      vpc: vpcStack.vpc,
      securityGroup: sgStack.databaseSecurityGroup,
      dbName: `${appName}_${envName}_db`.replace(/-/g, '_'),
      dbUserName: `${appName}_${envName}_admin`.replace(/-/g, '_'),
    });

    const ec2Stack = new Ec2Stack(this, 'Ec2', {
      envName,
      vpc: vpcStack.vpc,
      ec2SecurityGroup: sgStack.ec2SecurityGroup,
      repository: ecrStack.repository,
      dbSecret: rds.dbSecret,
      containerPort: 8000,
    });

    ec2Stack.instance.node.addDependency(rds.database);

    const albStack = new AlbStack(this, 'Alb', {
      envName,
      vpc: vpcStack.vpc,
      albSecurityGroup: sgStack.albSecurityGroup,
      ec2Instance: ec2Stack.instance,
      containerPort: 8000,
      healthCheckPath: '/health/',
    });

    const cloudFrontStack = new CloudFrontStack(this, 'CloudFront', {
      envName,
      frontendBucket: s3Stack.frontendBucket,
      mediaBucket: s3Stack.mediaBucket,
      alb: albStack.alb,
      // certificate: myAcmCertificate, // must be in us-east-1 for CloudFront
      // domainNames: [props.domainName],
    });

    new SsmStack(this, 'Ssm', {
      envName,
      databaseUrl: rds.databaseUrl,
      dbHost: rds.host,
      dbPort: rds.port,
      dbName: rds.dbName,
      dbUsername: rds.userName,
      dbSecret: rds.dbSecret,
      mediaBucket: s3Stack.mediaBucket,
      frontendBucket: s3Stack.frontendBucket,
      ecrRepository: ecrStack.repository,
      distribution: cloudFrontStack.distribution,
      // NOTE: don't hardcode secrets. Pull these from env vars set by your
      // CI pipeline (or better, from Secrets Manager) at synth time.
      djangoSecretKey: process.env.DJANGO_SECRET_KEY ?? '',
      // No custom domain yet, so fall back to CloudFront's default domain.
      // Once you add a domain: allowedHosts: `${apiDomainName},${domainName}`
      allowedHosts: cloudFrontStack.distribution.distributionDomainName,
      corsAllowedOrigins: `https://${cloudFrontStack.distribution.distributionDomainName}`,
      openAiApiKey: process.env.OPENAI_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      jwtSecret: process.env.JWT_SECRET,
    });
  }
}

import { VpcStack } from './vpc-stack';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { SecurityGroupStack } from './security-group-stack';
import { S3Stack } from './s3-stack';
import { EcrStack } from './ecr-stack';
import { RdsPostgres } from './rds-stack';
import { appName } from '../config/env';
import { EcsStack } from './ecs-stack';
import { AlbStack } from './alb-stack';
import { CloudFrontStack } from './cloudfront-stack';
import { SsmStack } from './ssm-stack';
import { IamStack } from './iam-stack';
import { Ec2Stack } from './ec2-stack';
import { EcsClusterStack } from './ecs-cluster-stack';
export interface MainStackProps extends cdk.StackProps {
  envName: string;
}

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const vpc = new VpcStack(this, 'Vpc', {
      envName,
    });

    const sg = new SecurityGroupStack(this, 'SecurityGroups', {
      envName,
      vpc: vpc.vpc,
    });

    const s3 = new S3Stack(this, 'S3', {
      envName,
    });

    const ecrStack = new EcrStack(this, 'Ecr', {
      envName,
    });

    const rds = new RdsPostgres(this, 'Rds', {
      envName,
      vpc: vpc.vpc,
      securityGroup: sg.databaseSecurityGroup,
      dbName: `${appName}_${envName}_db`.replace(/-/g, '_'),
      dbUserName: `${appName}_${envName}_admin`.replace(/-/g, '_'),
    });

    const iamRoles = new IamStack(this, 'Iam', {
      envName,
      dbSecret: rds.dbSecret,
      mediaBucket: s3.mediaBucket,
      ecrRepository: ecrStack.repository,
    });

    const ecsCluster = new EcsClusterStack(this, 'EcsCluster', {
      envName,
      vpc: vpc.vpc,
    });

    const ec2 = new Ec2Stack(this, 'Ec2', {
      envName,
      vpc: vpc.vpc,
      ec2SecurityGroup: sg.ecsSecurityGroup,
      instanceRole: iamRoles.instanceRole,
      clusterName: ecsCluster.cluster.clusterName,
    });

    const ecs = new EcsStack(this, 'Ecs', {
      envName,
      cluster: ecsCluster.cluster,
      capacityProvider: ec2.capacityProvider,
      repository: ecrStack.repository,
      executionRole: iamRoles.executionRole,
      taskRole: iamRoles.taskRole,
      containerPort: 8000,
      dbSecret: rds.dbSecret,
    });

    ecs.service.node.addDependency(rds.database);

    const albStack = new AlbStack(this, 'Alb', {
      envName,
      vpc: vpc.vpc,
      albSecurityGroup: sg.albSecurityGroup,
      ecsService: ecs.service,
      containerName: ecs.containerName,
      containerPort: 8000,
      healthCheckPath: '/health/',
    });

    const cloudFrontStack = new CloudFrontStack(this, 'CloudFront', {
      envName,
      frontendBucket: s3.frontendBucket,
      mediaBucket: s3.mediaBucket,
      alb: albStack.alb,
    });

    new SsmStack(this, 'Ssm', {
      envName,
      mediaBucket: s3.mediaBucket,
      frontendBucket: s3.frontendBucket,
      ecrRepository: ecrStack.repository,
      distribution: cloudFrontStack.distribution,
      djangoSecretKey: process.env.DJANGO_SECRET_KEY ?? '',
      allowedHosts: cloudFrontStack.distribution.distributionDomainName,
      corsAllowedOrigins: `https://${cloudFrontStack.distribution.distributionDomainName}`,
      geminiApiKey: process.env.GEMINI_API_KEY,
      jwtSecret: process.env.JWT_SECRET,
      vpcId: vpc.vpc.vpcId,
      lambdaSecurityGroupId: sg.lambdaSecurityGroup.securityGroupId,
      privateSubnetId: vpc.vpc.privateSubnets[0].subnetId,
      apiUrl: `https://${cloudFrontStack.distribution.distributionDomainName}/api`,
    });
  }
}

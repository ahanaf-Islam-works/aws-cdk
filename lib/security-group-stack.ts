import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { appName, BE_TECH_STACK } from '../config/env';

export interface SecurityGroupStackProps {
  envName: string;
  vpc: ec2.IVpc;
}

export class SecurityGroupStack extends Construct {
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly managementSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupStackProps) {
    super(scope, id);

    this.lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      `${appName}-lambda-sg-${props.envName}`,
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security Group for Lambda',
      },
    );

    this.albSecurityGroup = new ec2.SecurityGroup(this, `${appName}-alb-sg-${props.envName}`, {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Security Group for ALB',
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');

    this.ecsSecurityGroup = new ec2.SecurityGroup(this, `${appName}-ecs-sg-${props.envName}`, {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Security Group for ECS EC2 instances',
    });
    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcpRange(32768, 65535),
      'Allow HTTP from ALB',
    );

    this.ecsSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(8000),
      `Allow Lambda to access server`,
    );

    this.managementSecurityGroup = new ec2.SecurityGroup(
      this,
      `${appName}-management-sg-${props.envName}`,
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security Group for Management EC2',
      },
    );

    this.databaseSecurityGroup = new ec2.SecurityGroup(
      this,
      `${appName}-database-sg-${props.envName}`,
      {
        vpc: props.vpc,
        allowAllOutbound: false,
        description: 'Security Group for PostgreSQL',
      },
    );
    this.databaseSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from ECS',
    );
    this.databaseSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from Lambda',
    );
    this.databaseSecurityGroup.addIngressRule(
      this.managementSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from Management EC2',
    );

    [
      this.albSecurityGroup,
      this.ecsSecurityGroup,
      this.lambdaSecurityGroup,
      this.managementSecurityGroup,
      this.databaseSecurityGroup,
    ].forEach((sg) => {
      cdk.Tags.of(sg).add('Project', appName);
      cdk.Tags.of(sg).add('Environment', props.envName);
      cdk.Tags.of(sg).add('ManagedBy', 'AWS CDK');
    });
  }
}

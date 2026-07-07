import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { appName } from '../config/env';
import * as cdk from 'aws-cdk-lib';

export interface SecurityGroupStackPorps {
  envName: string;
  vpc: ec2.IVpc;
}

export class SecurityGroupStack extends Construct {
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly managementSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupStackPorps) {
    super(scope, id);

    /* ALB security group */
    this.albSecurityGroup = new ec2.SecurityGroup(this, `${appName}-alb-sg-${props.envName}`, {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Security group for application load balancer',
    });

    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    this.albSecurityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS');

    /* EC2 security group */
    this.ec2SecurityGroup = new ec2.SecurityGroup(this, `${appName}-ec2-sg-${props.envName}`, {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Security Group for Django EC2',
    });

    this.ec2SecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(8000),
      'Allow Django traffic from ALB',
    );

    this.ec2SecurityGroup.addEgressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(8000),
      'Allow Lambda to reach django app directly',
    );

    /* Lambda Security group */
    this.lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      `${appName}-lambda-sg-${props.envName}`,
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security Group for lambda',
      },
    );

    /* Management security group */
    this.managementSecurityGroup = new ec2.SecurityGroup(
      this,
      `${appName}-management-sg-${props.envName}`,
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Management EC2 Security Group',
      },
    );

    /* Database security groups */
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
      this.ec2SecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from Django EC2',
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

    /* Tags */
    const securityGroups = [
      this.albSecurityGroup,
      this.ec2SecurityGroup,
      this.lambdaSecurityGroup,
      this.managementSecurityGroup,
      this.databaseSecurityGroup,
    ];

    securityGroups.forEach((sg) => {
      cdk.Tags.of(sg).add('Project', appName);
      cdk.Tags.of(sg).add('Environment', props.envName);
      cdk.Tags.of(sg).add('ManagedBy', 'AWS CDK');
    });
  }
}

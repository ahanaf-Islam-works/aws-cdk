import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { appName } from '../config/env';

export interface AlbStackProps {
  envName: string;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
  ecsService: ecs.Ec2Service;
  containerName: string;
  containerPort: number;
  healthCheckPath?: string;
}

export class AlbStack extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly listener: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id);

    this.alb = new elbv2.ApplicationLoadBalancer(this, `${appName}-alb-${props.envName}`, {
      loadBalancerName: `${appName}-${props.envName}-alb`,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    this.listener = this.alb.addListener(`${appName}-listener-${props.envName}`, {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
    });

    this.listener.addTargets(`${appName}-targets-${props.envName}`, {
      port: props.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [
        props.ecsService.loadBalancerTarget({
          containerName: props.containerName,
          containerPort: props.containerPort,
        }),
      ],
      healthCheck: {
        path: props.healthCheckPath ?? '/health/',
        healthyHttpCodes: '200-399',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
    });

    cdk.Tags.of(this.alb).add('Project', appName);
    cdk.Tags.of(this.alb).add('Environment', props.envName);
    cdk.Tags.of(this.alb).add('ManagedBy', 'AWS CDK');
  }
}

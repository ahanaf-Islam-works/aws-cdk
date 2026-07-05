import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { appName } from '../config/env';

export interface AlbStackProps {
  envName: string;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.SecurityGroup;
  ec2Instance: ec2.Instance;
  containerPort?: number;
  healthCheckPath?: string;
}

export class AlbStack extends Construct {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly listener: elbv2.ApplicationListener;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id);

    const port = props.containerPort ?? 8000;

    this.alb = new elbv2.ApplicationLoadBalancer(this, `${appName}-alb-${props.envName}`, {
      loadBalancerName: `${appName}-${props.envName}-alb`,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, `${appName}-tg-${props.envName}`, {
      targetGroupName: `${appName}-${props.envName}-tg`,
      vpc: props.vpc,
      port,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      targets: [new elbv2targets.InstanceTarget(props.ec2Instance, port)],
      healthCheck: {
        path: props.healthCheckPath ?? '/health/',
        port: 'traffic-port',
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: '200-399',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    this.listener = this.alb.addListener(`${appName}-listener-${props.envName}`, {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [this.targetGroup],
    });

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
    });

    cdk.Tags.of(this.alb).add('Project', appName);
    cdk.Tags.of(this.alb).add('Environment', props.envName);
    cdk.Tags.of(this.alb).add('ManagedBy', 'AWS CDK');
  }
}

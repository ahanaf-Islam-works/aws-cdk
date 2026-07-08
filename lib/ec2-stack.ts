import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { appName } from '../config/env';

export interface Ec2StackProps {
  envName: string;
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.ISecurityGroup;
  instanceRole: iam.IRole;
  clusterName: string;
}
export class Ec2Stack extends Construct {
  public readonly containerInstance: ec2.Instance;

  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id);

    this.containerInstance = new ec2.Instance(this, `${appName}-host-${props.envName}`, {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2023(ecs.AmiHardwareType.ARM),
      securityGroup: props.ec2SecurityGroup,
      role: props.instanceRole,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    this.containerInstance.addUserData(
      `echo ECS_CLUSTER=${props.clusterName} >> /etc/ecs/ecs.config`,
    );

    new cdk.CfnOutput(this, 'BastionHostInstanceId', {
      value: this.containerInstance.instanceId,
    });

    cdk.Tags.of(this).add('Project', appName);
    cdk.Tags.of(this).add('Environment', props.envName);
    cdk.Tags.of(this).add('ManagedBy', 'AWS CDK');
  }
}

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { appName, EnvironmentName } from '../config/env';

export interface Ec2StackProps {
  envName: EnvironmentName;
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.ISecurityGroup;
  instanceRole: iam.IRole;
  clusterName: string;
}
export class Ec2Stack extends Construct {
  public readonly autoScalingGroup: autoscaling.AutoScalingGroup;
  public readonly capacityProvider: ecs.AsgCapacityProvider;

  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id);

    this.autoScalingGroup = new autoscaling.AutoScalingGroup(
      this,
      `${appName}-asg-${props.envName}`,
      {
        vpc: props.vpc,

        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),

        machineImage: ecs.EcsOptimizedImage.amazonLinux2023(ecs.AmiHardwareType.ARM),

        securityGroup: props.ec2SecurityGroup,
        role: props.instanceRole,

        minCapacity: 1,
        desiredCapacity: 1,
        maxCapacity: 2,

        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      },
    );

    this.autoScalingGroup.addUserData(
      `echo ECS_CLUSTER=${props.clusterName} >> /etc/ecs/ecs.config`,
    );

    this.capacityProvider = new ecs.AsgCapacityProvider(this, `${appName}-capacityprovider`, {
      autoScalingGroup: this.autoScalingGroup,
      enableManagedScaling: true,
      enableManagedDraining: true,
      enableManagedTerminationProtection: false,
    });

    cdk.Tags.of(this).add('Project', appName);
    cdk.Tags.of(this).add('Environment', props.envName);
    cdk.Tags.of(this).add('ManagedBy', 'AWS CDK');
  }
}

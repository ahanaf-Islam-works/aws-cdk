import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { appName, EnvironmentName } from '../config/env';

export interface EcsClusterProps {
  envName: EnvironmentName;
  vpc: ec2.IVpc;
}

export class EcsClusterStack extends Construct {
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: EcsClusterProps) {
    super(scope, id);

    this.cluster = new ecs.Cluster(this, `${appName}-cluster-${props.envName}`, {
      vpc: props.vpc,
      clusterName: `${appName}-${props.envName}-cluster`,
    });
  }
}

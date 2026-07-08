import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { appName } from '../config/env';

export interface EcsStackProps {
  envName: string;
  cluster: ecs.ICluster;
  repository: ecr.IRepository;
  executionRole: iam.IRole;
  taskRole: iam.IRole;
  containerPort: number;
}
export class EcsStack extends Construct {
  public readonly taskDefinition: ecs.Ec2TaskDefinition;
  public readonly service: ecs.Ec2Service;
  public readonly containerName: string;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id);

    this.containerName = `${appName}-container`;

    this.taskDefinition = new ecs.Ec2TaskDefinition(this, `${appName}-${props.envName}`, {
      executionRole: props.executionRole,
      taskRole: props.taskRole,
      networkMode: ecs.NetworkMode.BRIDGE,
    });

    const container = this.taskDefinition.addContainer(this.containerName, {
      image: ecs.ContainerImage.fromEcrRepository(props.repository),
      cpu: 1024,
      memoryLimitMiB: 1536,
      essential: true,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `${appName}-${props.envName}`,
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
    });

    container.addPortMappings({
      containerPort: props.containerPort,
      hostPort: props.containerPort,
      protocol: ecs.Protocol.TCP,
    });

    this.service = new ecs.Ec2Service(this, `${appName}-service-${props.envName}`, {
      cluster: props.cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: 1,
    });

    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: props.cluster.clusterName,
    });

    new cdk.CfnOutput(this, 'EcsServiceName', {
      value: this.service.serviceName,
    });

    cdk.Tags.of(this).add('Project', appName);
    cdk.Tags.of(this).add('Environment', props.envName);
    cdk.Tags.of(this).add('ManagedBy', 'AWS CDK');
  }
}

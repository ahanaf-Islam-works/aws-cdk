import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { appName, env } from '../config/env';

export interface EcsStackProps {
  envName: string;
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.SecurityGroup;
  repository: ecr.IRepository;
  dbSecret: secretsmanager.ISecret;
  containerPort?: number;
}

export class EcsStack extends Construct {
  public readonly service: ecs.Ec2Service;
  public readonly taskDefinition: ecs.Ec2TaskDefinition;
  public readonly cluster: ecs.Cluster;
  public readonly containerInstance: ec2.Instance;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // 1. Create ECS Cluster in the VPC
    this.cluster = new ecs.Cluster(this, `${appName}-ecs-cluster-${props.envName}`, {
      vpc: props.vpc,
      clusterName: `${appName}-${props.envName}-cluster`,
    });

    // 2. Create Instance Role for the ECS Host
    const instanceRole = new iam.Role(this, `${appName}-ecs-host-role-${props.envName}`, {
      roleName: `${appName}-${props.envName}-ecs-host-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2ContainerServiceforEC2Role',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // 3. Create a Single EC2 Instance as the Capacity Provider
    const ami = ecs.EcsOptimizedImage.amazonLinux2023(ecs.AmiHardwareType.ARM);

    this.containerInstance = new ec2.Instance(this, `${appName}-ecs-instance-${props.envName}`, {
      instanceName: `${appName}-${props.envName}-ecs-host`,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroup: props.ec2SecurityGroup,
      role: instanceRole,
      machineImage: ami,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            encrypted: true,
            deleteOnTermination: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
      detailedMonitoring: true,
      requireImdsv2: true,
      disableApiTermination: props.envName === env.prod,
    });

    // Register instance to ECS cluster
    this.containerInstance.addUserData(
      `echo ECS_CLUSTER=${this.cluster.clusterName} >> /etc/ecs/ecs.config`,
    );

    // 4. Create Task Execution Role
    const executionRole = new iam.Role(this, `${appName}-task-exec-role-${props.envName}`, {
      roleName: `${appName}-${props.envName}-task-execution-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    props.repository.grantPull(executionRole);
    props.dbSecret.grantRead(executionRole);
    executionRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
          'ssm:GetParametersByPath',
          'ssm:DescribeParameters',
        ],
        resources: ['*'],
      }),
    );

    // 5. Create Task Role
    const taskRole = new iam.Role(this, `${appName}-task-role-${props.envName}`, {
      roleName: `${appName}-${props.envName}-task-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // S3 media bucket permission
    const mediaBucket = s3.Bucket.fromBucketName(
      this,
      'MediaBucket',
      `${appName}-${props.envName}-media`.toLowerCase(),
    );
    mediaBucket.grantReadWrite(taskRole);

    // Lambda invoke permission
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [`arn:aws:lambda:${region}:${account}:function:contract-checker-*`],
      }),
    );

    // SSM Parameter Store read permissions
    taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssm:GetParameter',
          'ssm:GetParameters',
          'ssm:GetParametersByPath',
          'ssm:DescribeParameters',
        ],
        resources: ['*'],
      }),
    );

    // DB Secret read permissions
    props.dbSecret.grantRead(taskRole);

    // 6. Create Task Definition (EC2 compatibility, bridge network mode)
    this.taskDefinition = new ecs.Ec2TaskDefinition(this, `${appName}-task-def-${props.envName}`, {
      executionRole,
      taskRole,
      networkMode: ecs.NetworkMode.BRIDGE,
    });

    const containerPort = props.containerPort ?? 8000;
    const container = this.taskDefinition.addContainer(`${appName}-container`, {
      image: ecs.ContainerImage.fromEcrRepository(props.repository),
      memoryLimitMiB: 1536, // Allocate 1.5 GB memory of the t4g.small (which has 2GB)
      cpu: 1024, // Allocate 1 vCPU (t4g.small has 2 vCPUs)
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `${appName}-${props.envName}`,
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
    });

    container.addPortMappings({
      containerPort: containerPort,
      hostPort: containerPort,
    });

    // 7. ECS Service (desiredCount: 1, EC2 launch type)
    this.service = new ecs.Ec2Service(this, `${appName}-ecs-service-${props.envName}`, {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: 1,
    });

    // Outputs & Tags
    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: this.cluster.clusterName,
    });
    new cdk.CfnOutput(this, 'EcsServiceName', {
      value: this.service.serviceName,
    });
    new cdk.CfnOutput(this, 'EcsHostInstanceId', {
      value: this.containerInstance.instanceId,
    });

    cdk.Tags.of(this).add('Project', appName);
    cdk.Tags.of(this).add('Environment', props.envName);
    cdk.Tags.of(this).add('ManagedBy', 'AWS CDK');
  }
}

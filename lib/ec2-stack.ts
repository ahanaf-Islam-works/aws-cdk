import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { appName, env } from '../config/env';
import { createEc2UserData } from '../helpers/user-data';

export interface Ec2StackProps {
  envName: string;
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.SecurityGroup;
  repository: ecr.IRepository;
  dbSecret: secretsmanager.ISecret;
  containerPort?: number;
  instanceType?: ec2.InstanceType;
  diskSize?: number;
}

export class Ec2Stack extends Construct {
  public readonly instance: ec2.Instance;
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    /* Instance role
       - AmazonSSMManagedInstanceCore: access via SSM Session Manager /
         ssm:SendCommand instead of opening SSH
       - ECR pull: docker can fetch the app image
       - Secret read: app can fetch DB credentials at boot
       - SSM Parameter Store read: app can fetch its config/env */
    this.role = new iam.Role(this, `${appName}-ec2-role-${props.envName}`, {
      roleName: `${appName}-${props.envName}-ec2-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    props.repository.grantPull(this.role);
    props.dbSecret.grantRead(this.role);

    this.role.addToPrincipalPolicy(
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

    this.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [
          `arn:aws:lambda:${region}:${cdk.Stack.of(this).account}:function:contract-checker-*`,
        ],
      }),
    );

    const userData = createEc2UserData({
      region,
      ecrRepository: props.repository,
      containerName: appName,
      containerPort: props.containerPort ?? 8000,
    });

    this.instance = new ec2.Instance(this, `${appName}-ec2-${props.envName}`, {
      instanceName: `${appName}-${props.envName}-server`,
      vpc: props.vpc,

      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },

      securityGroup: props.ec2SecurityGroup,
      role: this.role,
      userData,
      userDataCausesReplacement: true,

      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),

      instanceType:
        props.instanceType ?? ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),

      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(props.diskSize ?? 30, {
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

    new cdk.CfnOutput(this, 'Ec2InstanceId', {
      value: this.instance.instanceId,
    });

    cdk.Tags.of(this.instance).add('Project', appName);
    cdk.Tags.of(this.instance).add('Environment', props.envName);
    cdk.Tags.of(this.instance).add('ManagedBy', 'AWS CDK');
  }
}
